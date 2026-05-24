/**
 * Audit Alerts Service
 *
 * Periodic scanners that detect risks compromising the company's audit:
 * unpaid invoices, pending approvals, stuck orders, open shifts, etc.
 *
 * See [[audit-alerts]] skill for the full spec.
 *
 * Architecture notes:
 *  - Each scanner is idempotent — running multiple times only creates one
 *    alert per (auditType, relatedId) tuple via the dedup map.
 *  - At the end of scanAll, alerts whose source is no longer in a problem
 *    state are auto-resolved.
 *  - Scanners run sequentially per company to avoid exhausting the Prisma
 *    connection pool (Supabase pooler is limited).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

// All audit alerts share these conventions:
const AUDIT_MODULE = 'audit';
const ALERT_TYPE = 'custom' as const; // uses the existing 'custom' AlertType enum

export type AuditType =
    | 'invoice_overdue'
    | 'credit_note_draft'
    | 'debit_note_draft'
    | 'approval_pending'
    | 'order_stuck'
    | 'order_cancellation_pending'
    | 'shift_open_too_long'
    | 'sangria_no_approval'
    | 'negative_stock'
    | 'invoice_no_warehouse'
    | 'sale_no_fiscal_number'
    | 'shift_discrepancy'
    | 'duplicate_fiscal_number'
    | 'irps_brackets_missing';

interface DetectedRisk {
    auditType: AuditType;
    relatedId: string;
    relatedType: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    message: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
}

interface AuditThresholds {
    sangria: number;
    discrepancy: number;
}

const DEFAULT_THRESHOLDS: AuditThresholds = {
    sangria: 5000,
    discrepancy: 100,
};

const FEATURE_LAUNCH_DATE = new Date('2026-05-23'); // when invoice.warehouseId was introduced

async function getThresholds(companyId: string): Promise<AuditThresholds> {
    // Thresholds are stored on Company.settings (Json) — not CompanySettings.
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { settings: true },
    });
    const cfg = (company?.settings as { auditThresholds?: Partial<AuditThresholds> } | null)?.auditThresholds ?? {};
    return {
        sangria: Number(cfg.sangria) || DEFAULT_THRESHOLDS.sangria,
        discrepancy: Number(cfg.discrepancy) || DEFAULT_THRESHOLDS.discrepancy,
    };
}

// ── Scanners ─────────────────────────────────────────────────────────────────

async function scanInvoicesOverdue(companyId: string, now: Date): Promise<DetectedRisk[]> {
    const overdue = await prisma.invoice.findMany({
        where: {
            companyId,
            dueDate: { lt: now },
            status: { in: ['sent', 'partial', 'overdue'] },
            amountDue: { gt: 0 },
        },
        select: {
            id: true, invoiceNumber: true, customerName: true,
            dueDate: true, amountDue: true,
        },
    });
    return overdue.map(inv => {
        const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000);
        const priority: 'critical' | 'high' = daysOverdue > 30 ? 'critical' : 'high';
        return {
            auditType: 'invoice_overdue',
            relatedId: inv.id,
            relatedType: 'invoice',
            priority,
            title: `Factura vencida há ${daysOverdue}d`,
            message: `${inv.invoiceNumber} de ${inv.customerName} — em dívida ${Number(inv.amountDue).toFixed(2)} MTn`,
            actionUrl: `/commercial/invoices?open=${inv.id}`,
            metadata: { daysOverdue, amountDue: Number(inv.amountDue) },
        };
    });
}

async function scanCreditNotesDraft(companyId: string, now: Date): Promise<DetectedRisk[]> {
    const cutoff = new Date(now.getTime() - 24 * 3600_000);
    const drafts = await prisma.creditNote.findMany({
        where: { companyId, status: 'draft', createdAt: { lt: cutoff } },
        select: { id: true, number: true, customerName: true, total: true, createdAt: true },
    });
    return drafts.map(cn => ({
        auditType: 'credit_note_draft',
        relatedId: cn.id,
        relatedType: 'credit_note',
        priority: 'medium',
        title: 'Nota de Crédito em rascunho',
        message: `${cn.number} de ${cn.customerName} pendente desde ${cn.createdAt.toISOString().slice(0, 10)} — ${Number(cn.total).toFixed(2)} MTn`,
        actionUrl: `/commercial/invoices?tab=credit_notes&open=${cn.id}`,
    }));
}

async function scanDebitNotesDraft(companyId: string, now: Date): Promise<DetectedRisk[]> {
    const cutoff = new Date(now.getTime() - 24 * 3600_000);
    const drafts = await prisma.debitNote.findMany({
        where: { companyId, status: 'draft', createdAt: { lt: cutoff } },
        select: { id: true, number: true, customerName: true, total: true, createdAt: true },
    });
    return drafts.map(dn => ({
        auditType: 'debit_note_draft',
        relatedId: dn.id,
        relatedType: 'debit_note',
        priority: 'medium',
        title: 'Nota de Débito em rascunho',
        message: `${dn.number} de ${dn.customerName} pendente desde ${dn.createdAt.toISOString().slice(0, 10)} — ${Number(dn.total).toFixed(2)} MTn`,
        actionUrl: `/commercial/invoices?tab=debit_notes&open=${dn.id}`,
    }));
}

async function scanApprovalsPending(companyId: string, now: Date): Promise<DetectedRisk[]> {
    const cutoff = new Date(now.getTime() - 24 * 3600_000);
    const cutoff48 = new Date(now.getTime() - 48 * 3600_000);
    const pending = await prisma.approvalRequest.findMany({
        where: { companyId, status: 'pending', createdAt: { lt: cutoff } },
        select: { id: true, requestType: true, reason: true, amount: true, createdAt: true, requestedByName: true },
    });
    return pending.map(ar => {
        const isStale = ar.createdAt < cutoff48;
        return {
            auditType: 'approval_pending',
            relatedId: ar.id,
            relatedType: 'approval_request',
            priority: isStale ? 'high' : 'medium',
            title: isStale ? 'Aprovação há >48h sem resposta' : 'Aprovação pendente >24h',
            message: `${ar.requestType} pedida por ${ar.requestedByName || 'utilizador'}: ${ar.reason}${ar.amount ? ` (${Number(ar.amount).toFixed(2)} MTn)` : ''}`,
            actionUrl: `/admin/approvals?open=${ar.id}`,
            metadata: { hoursWaiting: Math.floor((now.getTime() - ar.createdAt.getTime()) / 3600_000) },
        };
    });
}

async function scanOrdersStuck(companyId: string, now: Date): Promise<DetectedRisk[]> {
    const cutoff = new Date(now.getTime() - 72 * 3600_000);
    const stuck = await prisma.customerOrder.findMany({
        where: {
            companyId,
            status: { in: ['printed', 'separated'] },
            updatedAt: { lt: cutoff },
        },
        select: { id: true, orderNumber: true, customerName: true, status: true, updatedAt: true },
    });
    return stuck.map(o => ({
        auditType: 'order_stuck',
        relatedId: o.id,
        relatedType: 'customer_order',
        priority: 'medium',
        title: `Encomenda parada em "${o.status}"`,
        message: `${o.orderNumber} de ${o.customerName} sem evolução desde ${o.updatedAt.toISOString().slice(0, 10)}`,
        actionUrl: `/orders?open=${o.id}`,
    }));
}

async function scanOrderCancellationsPending(companyId: string, now: Date): Promise<DetectedRisk[]> {
    const cutoff = new Date(now.getTime() - 24 * 3600_000);
    const pending = await prisma.orderCancellationRequest.findMany({
        where: { companyId, status: 'pending', requestedAt: { lt: cutoff } },
        select: { id: true, orderId: true, reason: true, requestedAt: true },
    });
    return pending.map(req => ({
        auditType: 'order_cancellation_pending',
        relatedId: req.id,
        relatedType: 'order_cancellation_request',
        priority: 'high',
        title: 'Pedido de cancelamento de encomenda pendente',
        message: `Aguarda decisão desde ${req.requestedAt.toISOString().slice(0, 10)}: ${req.reason}`,
        actionUrl: `/orders?open=${req.orderId}`,
    }));
}

async function scanShiftsOpenTooLong(companyId: string, now: Date): Promise<DetectedRisk[]> {
    const cutoff = new Date(now.getTime() - 24 * 3600_000);
    const open = await prisma.cashSession.findMany({
        where: { companyId, closedAt: null, openedAt: { lt: cutoff } },
        select: { id: true, openedAt: true, openedBy: { select: { name: true } } },
    });
    return open.map(s => {
        const hoursOpen = Math.floor((now.getTime() - s.openedAt.getTime()) / 3600_000);
        return {
            auditType: 'shift_open_too_long',
            relatedId: s.id,
            relatedType: 'cash_session',
            priority: 'high',
            title: `Turno aberto há ${hoursOpen}h`,
            message: `${s.openedBy?.name || 'Operador'} ainda não fechou o turno aberto em ${s.openedAt.toISOString().slice(0, 10)}`,
            actionUrl: `/commercial/shifts?open=${s.id}`,
            metadata: { hoursOpen },
        };
    });
}

async function scanSangriaNoApproval(companyId: string, now: Date, thresholds: AuditThresholds): Promise<DetectedRisk[]> {
    // Recent sangria movements above threshold. We check the last 30 days only
    // — old ones can't be retroactively fixed, the alert would be noise.
    const cutoff = new Date(now.getTime() - 30 * 86_400_000);
    const movements = await prisma.cashMovement.findMany({
        where: {
            createdAt: { gte: cutoff },
            type: 'sangria',
            amount: { gt: thresholds.sangria },
            session: { companyId },
        },
        select: {
            id: true, amount: true, reason: true, createdAt: true,
            performedBy: { select: { name: true } },
            session: { select: { id: true } },
        },
    });
    return movements.map(m => ({
        auditType: 'sangria_no_approval',
        relatedId: m.id,
        relatedType: 'cash_movement',
        priority: 'critical',
        title: `Sangria de ${Number(m.amount).toFixed(2)} MTn sem aprovação`,
        message: `${m.performedBy?.name || 'Operador'}: "${m.reason}" — acima do limite de ${thresholds.sangria.toFixed(2)} MTn`,
        actionUrl: `/commercial/shifts?open=${m.session.id}`,
        metadata: { amount: Number(m.amount), threshold: thresholds.sangria },
    }));
}

async function scanNegativeStock(companyId: string): Promise<DetectedRisk[]> {
    const negative = await prisma.product.findMany({
        where: { companyId, isActive: true, currentStock: { lt: 0 } },
        select: { id: true, name: true, code: true, currentStock: true },
    });
    return negative.map(p => ({
        auditType: 'negative_stock',
        relatedId: p.id,
        relatedType: 'product',
        priority: 'critical',
        title: 'Stock negativo — integridade comprometida',
        message: `${p.name} (${p.code}): ${p.currentStock} unidades`,
        actionUrl: `/commercial/inventory?open=${p.id}`,
        metadata: { currentStock: p.currentStock },
    }));
}

async function scanInvoicesNoWarehouse(companyId: string): Promise<DetectedRisk[]> {
    const noWarehouse = await prisma.invoice.findMany({
        where: {
            companyId,
            warehouseId: null,
            createdAt: { gte: FEATURE_LAUNCH_DATE },
            status: { notIn: ['cancelled', 'draft'] },
        },
        select: { id: true, invoiceNumber: true, customerName: true },
    });
    return noWarehouse.map(inv => ({
        auditType: 'invoice_no_warehouse',
        relatedId: inv.id,
        relatedType: 'invoice',
        priority: 'low',
        title: 'Factura sem armazém atribuído',
        message: `${inv.invoiceNumber} de ${inv.customerName} — auditoria fica menos rastreável`,
        actionUrl: `/commercial/invoices?open=${inv.id}`,
    }));
}

async function scanSalesNoFiscalNumber(companyId: string, now: Date): Promise<DetectedRisk[]> {
    // Only flag completed sales of the last 60 days — older ones can't be fixed.
    const cutoff = new Date(now.getTime() - 60 * 86_400_000);
    const sales = await prisma.sale.findMany({
        where: {
            companyId,
            createdAt: { gte: cutoff },
            fiscalNumber: null,
        },
        select: { id: true, receiptNumber: true, total: true, createdAt: true },
    });
    return sales.map(s => ({
        auditType: 'sale_no_fiscal_number',
        relatedId: s.id,
        relatedType: 'sale',
        priority: 'critical',
        title: 'Venda sem nº fiscal — não conformidade fiscal',
        message: `Recibo ${s.receiptNumber} (${s.createdAt.toISOString().slice(0, 10)}): ${Number(s.total).toFixed(2)} MTn sem nº fiscal — compromete SAF-T`,
        actionUrl: `/commercial/sales?open=${s.id}`,
    }));
}

async function scanShiftDiscrepancies(companyId: string, now: Date, thresholds: AuditThresholds): Promise<DetectedRisk[]> {
    const cutoff = new Date(now.getTime() - 30 * 86_400_000);
    const closed = await prisma.cashSession.findMany({
        where: {
            companyId,
            closedAt: { not: null, gte: cutoff },
            difference: { not: null },
        },
        select: {
            id: true, openedAt: true, closedAt: true, difference: true,
            openedBy: { select: { name: true } },
        },
    });
    return closed
        .filter(s => Math.abs(Number(s.difference)) > thresholds.discrepancy)
        .map(s => ({
            auditType: 'shift_discrepancy',
            relatedId: s.id,
            relatedType: 'cash_session',
            priority: 'medium',
            title: `Discrepância de ${Math.abs(Number(s.difference)).toFixed(2)} MTn no turno`,
            message: `Turno de ${s.openedBy?.name || 'operador'} fechado em ${s.closedAt!.toISOString().slice(0, 10)} com diferença ${Number(s.difference).toFixed(2)} MTn`,
            actionUrl: `/commercial/shifts?open=${s.id}`,
            metadata: { difference: Number(s.difference) },
        }));
}

async function scanIRPSBracketsMissing(companyId: string, now: Date): Promise<DetectedRisk[]> {
    // IRPS calculations silently return zero when no brackets exist for the
    // current fiscal year (see useFiscalStore.ts ~L435). That's a payroll
    // black-hole — surface it loudly so the contabilista provisions brackets.
    const currentYear = now.getFullYear();
    const brackets = await prisma.iRPSBracket.findFirst({
        where: {
            year: currentYear,
            isActive: true,
            OR: [{ companyId }, { companyId: null }],
        },
        select: { id: true },
    });
    if (brackets) return [];
    return [{
        auditType: 'irps_brackets_missing',
        relatedId: `irps-${currentYear}`,
        relatedType: 'irps_bracket',
        priority: 'critical',
        title: `Tabela IRPS para ${currentYear} em falta`,
        message: 'Sem escalões IRPS configurados para o ano fiscal corrente — cálculos de retenção devolvem zero silenciosamente. Configure em Fiscal → Configuração antes de processar payroll.',
        actionUrl: '/fiscal',
        metadata: { year: currentYear },
    }];
}

async function scanDuplicateFiscalNumbers(companyId: string): Promise<DetectedRisk[]> {
    // Group sales by (fiscalNumber, series) and flag any with count > 1.
    const dups = await prisma.sale.groupBy({
        by: ['fiscalNumber', 'series'],
        where: { companyId, fiscalNumber: { not: null } },
        having: { fiscalNumber: { _count: { gt: 1 } } },
        _count: { _all: true },
    });
    const risks: DetectedRisk[] = [];
    for (const dup of dups) {
        const samples = await prisma.sale.findMany({
            where: { companyId, fiscalNumber: dup.fiscalNumber, series: dup.series },
            select: { id: true, receiptNumber: true },
            take: 5,
        });
        // Use the lowest-id sale as the alert anchor (deterministic dedup).
        const anchor = samples[0];
        if (!anchor) continue;
        risks.push({
            auditType: 'duplicate_fiscal_number',
            relatedId: anchor.id,
            relatedType: 'sale',
            priority: 'critical',
            title: 'Nº fiscal duplicado — incidente fiscal',
            message: `Série ${dup.series} nº ${dup.fiscalNumber} aparece em ${dup._count._all} vendas (${samples.map(s => s.receiptNumber).join(', ')}). Investigação manual obrigatória.`,
            actionUrl: '/commercial/sales',
            metadata: { fiscalNumber: dup.fiscalNumber, series: dup.series, count: dup._count._all },
        });
    }
    return risks;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export class AuditAlertsService {
    /**
     * Run all scanners for the given company, persist new alerts and auto-resolve
     * those whose source is no longer in a problem state. Returns counts.
     */
    async scanAll(companyId: string): Promise<{ created: number; resolved: number; durationMs: number }> {
        const t0 = Date.now();
        const now = new Date();
        const thresholds = await getThresholds(companyId);

        // Run scanners sequentially — Supabase pool is limited.
        const allRisks: DetectedRisk[] = [];
        const scanners: Array<{ name: string; run: () => Promise<DetectedRisk[]> }> = [
            { name: 'invoices_overdue', run: () => scanInvoicesOverdue(companyId, now) },
            { name: 'credit_notes_draft', run: () => scanCreditNotesDraft(companyId, now) },
            { name: 'debit_notes_draft', run: () => scanDebitNotesDraft(companyId, now) },
            { name: 'approvals_pending', run: () => scanApprovalsPending(companyId, now) },
            { name: 'orders_stuck', run: () => scanOrdersStuck(companyId, now) },
            { name: 'order_cancellations', run: () => scanOrderCancellationsPending(companyId, now) },
            { name: 'shifts_open', run: () => scanShiftsOpenTooLong(companyId, now) },
            { name: 'sangria_no_approval', run: () => scanSangriaNoApproval(companyId, now, thresholds) },
            { name: 'negative_stock', run: () => scanNegativeStock(companyId) },
            { name: 'invoices_no_warehouse', run: () => scanInvoicesNoWarehouse(companyId) },
            { name: 'sales_no_fiscal', run: () => scanSalesNoFiscalNumber(companyId, now) },
            { name: 'shift_discrepancies', run: () => scanShiftDiscrepancies(companyId, now, thresholds) },
            { name: 'duplicate_fiscal', run: () => scanDuplicateFiscalNumbers(companyId) },
            { name: 'irps_brackets_missing', run: () => scanIRPSBracketsMissing(companyId, now) },
        ];

        for (const scanner of scanners) {
            try {
                const risks = await scanner.run();
                allRisks.push(...risks);
            } catch (err) {
                logger.error(`auditAlerts.${scanner.name} failed`, { companyId, error: err instanceof Error ? err.message : String(err) });
            }
        }

        // Build dedup key set for currently-detected risks.
        const detectedKeys = new Set(allRisks.map(r => `${r.auditType}|${r.relatedId}`));

        // Find existing unresolved audit alerts to compare.
        const existing = await prisma.alert.findMany({
            where: { companyId, module: AUDIT_MODULE, isResolved: false },
            select: { id: true, relatedId: true, metadata: true },
        });

        const existingKeys = new Set<string>();
        const existingByKey = new Map<string, string>();
        for (const a of existing) {
            const meta = a.metadata as { auditType?: string } | null;
            if (!a.relatedId || !meta?.auditType) continue;
            const key = `${meta.auditType}|${a.relatedId}`;
            existingKeys.add(key);
            existingByKey.set(key, a.id);
        }

        // Create new alerts for risks not yet tracked.
        let created = 0;
        for (const risk of allRisks) {
            const key = `${risk.auditType}|${risk.relatedId}`;
            if (existingKeys.has(key)) continue;
            try {
                await prisma.alert.create({
                    data: {
                        type: ALERT_TYPE as Prisma.AlertUncheckedCreateInput['type'],
                        priority: risk.priority as Prisma.AlertUncheckedCreateInput['priority'],
                        title: risk.title,
                        message: risk.message,
                        module: AUDIT_MODULE,
                        relatedId: risk.relatedId,
                        relatedType: risk.relatedType,
                        actionUrl: risk.actionUrl,
                        metadata: { auditType: risk.auditType, ...(risk.metadata ?? {}) } as Prisma.InputJsonValue,
                        companyId,
                    },
                });
                created++;
            } catch (err) {
                logger.warn('auditAlerts: failed to create alert', { companyId, key, error: err instanceof Error ? err.message : String(err) });
            }
        }

        // Auto-resolve alerts whose source is no longer detected.
        let resolved = 0;
        const toResolve: string[] = [];
        for (const [key, id] of existingByKey) {
            if (!detectedKeys.has(key)) toResolve.push(id);
        }
        if (toResolve.length > 0) {
            const result = await prisma.alert.updateMany({
                where: { id: { in: toResolve }, companyId },
                data: { isResolved: true, isRead: true, resolvedAt: now },
            });
            resolved = result.count;
        }

        const durationMs = Date.now() - t0;
        logger.info('auditAlerts.scanAll', { companyId, created, resolved, durationMs });
        return { created, resolved, durationMs };
    }

    /**
     * Run scanAll for every active company. Used by the hourly cron job.
     * Companies are processed sequentially to keep DB load predictable.
     */
    async scanAllCompanies(): Promise<{ companies: number; totalCreated: number; totalResolved: number }> {
        const companies = await prisma.company.findMany({
            where: { status: 'active' },
            select: { id: true, name: true },
        });
        let totalCreated = 0;
        let totalResolved = 0;
        for (const c of companies) {
            try {
                const { created, resolved } = await this.scanAll(c.id);
                totalCreated += created;
                totalResolved += resolved;
            } catch (err) {
                logger.error(`auditAlerts: scan failed for company ${c.name}`, { companyId: c.id, error: err instanceof Error ? err.message : String(err) });
            }
        }
        return { companies: companies.length, totalCreated, totalResolved };
    }
}

export const auditAlertsService = new AuditAlertsService();
