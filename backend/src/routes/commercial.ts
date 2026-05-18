import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { commercialService } from '../services/commercialService';
import { invalidateCommercialCache } from '../services/commercial/shared';
import { cashSessionService } from '../services/cashSessionService';
import { predictiveService } from '../services/predictiveService';
import { ApiError } from '../middleware/error.middleware';
import { emitToModule } from '../lib/socket';
import { prisma } from '../lib/prisma';
import { requireModule } from '../middleware/module';
import { cashMovementSchema, cashSessionHistoryQuerySchema, closeSessionSchema, openSessionSchema } from '../validation/cashSession';
import { salesTargetService } from '../services/commercial/salesTarget.service';
import { salesTargetSchema, updateSalesTargetSchema } from '../validation/salesTargets';
import { suppliersService } from '../services/suppliersService';
import { createPurchaseOrderSchema, receivePurchaseOrderSchema } from '../validation';
import {
    createSupplierInvoiceSchema,
    updateSupplierInvoiceStatusSchema,
    listSupplierInvoicesQuerySchema,
    addSupplierInvoicePaymentSchema,
} from '../validation/supplierInvoices';
import {
    accountsReceivableQuerySchema,
    commercialListQuerySchema,
    commercialPeriodQuerySchema,
    commercialWarehouseQuerySchema,
    convertQuotationToInvoiceSchema,
    createCommercialQuotationSchema,
    partialDeliverySchema,
    predictiveSuggestionsSchema,
    purchaseOrderStatusSchema,
    reserveItemSchema,
    salesTargetQuerySchema,
} from '../validation/commercial';

const router = Router();
router.use(authenticate, requireModule('COMMERCIAL'));

const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'operator'] as const;
const POS_ROLES = ['super_admin', 'admin', 'manager', 'operator', 'cashier'] as const;
const MANAGER_ROLES = ['super_admin', 'admin', 'manager'] as const;

// ============================================================================
// Commercial Module -- Premium Analytics Routes
// ============================================================================

// GET /api/commercial/analytics -- Dashboard KPIs
router.get('/analytics', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { userId, warehouseId } = commercialPeriodQuerySchema.parse(req.query);
    res.json(await commercialService.getAnalytics(req.companyId, userId, warehouseId));
});

// GET /api/commercial/margins?period=30&userId=xxx
router.get('/margins', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { period, userId, warehouseId } = commercialPeriodQuerySchema.parse(req.query);
    res.json(await commercialService.getMarginAnalysis(req.companyId, period, userId, warehouseId));
});

// POST /api/commercial/cache/invalidate — força refresh imediato das analytics
router.post('/cache/invalidate', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    invalidateCommercialCache(req.companyId);
    res.json({ message: 'Cache invalidado' });
});

// GET /api/commercial/stock-aging
router.get('/stock-aging', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { warehouseId } = commercialWarehouseQuerySchema.parse(req.query);
    res.json(await commercialService.getStockAging(req.companyId, warehouseId));
});

// GET /api/commercial/supplier-performance
router.get('/supplier-performance', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await commercialService.getSupplierPerformance(req.companyId));
});

// GET /api/commercial/inventory-turnover?period=90
router.get('/inventory-turnover', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { period, warehouseId } = commercialPeriodQuerySchema.parse({ ...req.query, period: req.query.period ?? 90 });
    res.json(await commercialService.getInventoryTurnover(req.companyId, period, warehouseId));
});

// GET /api/commercial/sales-report?period=30&userId=xxx
router.get('/sales-report', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { period, userId, warehouseId } = commercialPeriodQuerySchema.parse(req.query);
    res.json(await commercialService.getSalesReport(req.companyId, period, userId, warehouseId));
});

// GET /api/commercial/warehouse-distribution
router.get('/warehouse-distribution', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await commercialService.getWarehouseDistribution(req.companyId));
});

// GET /api/commercial/predictive/forecast
router.get('/predictive/forecast', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await predictiveService.getInventoryForecast(req.companyId));
});

// POST /api/commercial/predictive/create-orders
router.post('/predictive/create-orders', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { suggestions } = predictiveSuggestionsSchema.parse(req.body);
    res.json(await predictiveService.createDraftOrdersFromSuggestions(req.companyId, suggestions));
});

// ── Purchase Orders ───────────────────────────────────────────────────────────

// GET /api/commercial/purchase-orders -- restricted to manager+
router.get('/purchase-orders', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const query = commercialListQuerySchema.parse(req.query);
    res.json(await commercialService.listPurchaseOrders(req.companyId, query));
});

router.post('/purchase-orders', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
    const validatedData = createPurchaseOrderSchema.parse(req.body);
    if (!validatedData.supplierId) throw ApiError.badRequest('Fornecedor obrigatorio');
    res.status(201).json(await suppliersService.createOrder(validatedData.supplierId, validatedData, req.companyId));
});

router.get('/supplier-invoices', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
    const query = listSupplierInvoicesQuerySchema.parse(req.query);
    res.json(await commercialService.listSupplierInvoices(req.companyId, query));
});

// GET /api/commercial/supplier-invoices/:id
router.get('/supplier-invoices/:id', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
    res.json(await commercialService.getSupplierInvoiceById(req.params.id, req.companyId));
});

// POST /api/commercial/purchase-orders/:id/supplier-invoices
router.post('/purchase-orders/:id/supplier-invoices', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
    const data = createSupplierInvoiceSchema.parse(req.body);

    const result = await commercialService.createSupplierInvoice(
        req.params.id, data, req.companyId, req.userId
    );

    if (result.success && result.data) {
        emitToModule(req.companyId, 'commercial', 'commercial:supplier_invoice_created', {
            id: result.data.id,
            invoiceNumber: result.data.invoiceNumber,
            supplier: result.data.supplier?.name,
            total: result.data.total,
            createdBy: req.userName,
            timestamp: new Date()
        });
    }

    res.status(201).json(result);
});

// PATCH /api/commercial/supplier-invoices/:id/status
router.patch('/supplier-invoices/:id/status', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
    const { status } = updateSupplierInvoiceStatusSchema.parse(req.body);

    const result = await commercialService.updateSupplierInvoiceStatus(req.params.id, status, req.companyId, req.userId);

    if (result.success && result.data) {
        emitToModule(req.companyId, 'commercial', 'commercial:supplier_invoice_status_changed', {
            id: result.data.id,
            invoiceNumber: result.data.invoiceNumber,
            status: result.data.status,
            updatedBy: req.userName,
            timestamp: new Date()
        });
    }

    res.json(result);
});

// GET /api/commercial/supplier-invoices/:id/payments
router.get('/supplier-invoices/:id/payments', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
    res.json(await commercialService.listSupplierInvoicePayments(req.params.id, req.companyId));
});

// POST /api/commercial/supplier-invoices/:id/payments
router.post('/supplier-invoices/:id/payments', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
    const data = addSupplierInvoicePaymentSchema.parse(req.body);

    const result = await commercialService.addSupplierInvoicePayment(req.params.id, data, req.companyId, req.userId);

    if (result.success && result.data) {
        emitToModule(req.companyId, 'commercial', 'commercial:supplier_invoice_payment_added', {
            id: result.data.id,
            invoiceNumber: result.data.invoiceNumber,
            amountPaid: result.data.amountPaid,
            amountDue: result.data.amountDue,
            status: result.data.status,
            updatedBy: req.userName,
            timestamp: new Date()
        });
    }

    res.status(201).json(result);
});

// DELETE /api/commercial/supplier-invoices/:id/payments/:paymentId
router.delete('/supplier-invoices/:id/payments/:paymentId', authorize('super_admin', 'admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');

    const result = await commercialService.deleteSupplierInvoicePayment(req.params.id, req.params.paymentId, req.companyId);

    if (result.success && result.data) {
        emitToModule(req.companyId, 'commercial', 'commercial:supplier_invoice_payment_removed', {
            id: result.data.id,
            invoiceNumber: result.data.invoiceNumber,
            amountPaid: result.data.amountPaid,
            amountDue: result.data.amountDue,
            status: result.data.status,
            updatedBy: req.userName,
            timestamp: new Date()
        });
    }

    res.json(result);
});

// GET /api/commercial/purchase-orders/:id
router.get('/purchase-orders/:id', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await commercialService.getPurchaseOrderById(req.params.id, req.companyId));
});

// PATCH /api/commercial/purchase-orders/:id/status
router.patch('/purchase-orders/:id/status', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { status, warehouseId, approvalId } = purchaseOrderStatusSchema.parse(req.body);
    if (!status) throw ApiError.badRequest('Status obrigatório');

    const result = await commercialService.updatePurchaseOrderStatus(
        req.params.id, status, req.companyId, req.userId, warehouseId, approvalId
    );

    if (result.success && result.data) {
        emitToModule(req.companyId, 'commercial', 'commercial:po_status_changed', {
            id: result.data.id,
            status: result.data.status,
            supplier: (result.data as { supplier?: { name?: string } })?.supplier?.name,
            updatedBy: req.userName,
            timestamp: new Date()
        });
    }

    res.json(result);
});

// PATCH /api/commercial/purchase-orders/:id/partial-delivery
router.patch('/purchase-orders/:id/partial-delivery', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { deliveries, warehouseId } = partialDeliverySchema.parse(req.body);
    if (!deliveries || !Array.isArray(deliveries) || deliveries.length === 0) {
        throw ApiError.badRequest('Lista de entregas parciais é obrigatória');
    }

    const result = await commercialService.registerPartialDelivery(
        req.params.id, deliveries, req.companyId, req.userId, warehouseId
    );

    if (result.success && result.data) {
        emitToModule(req.companyId, 'commercial', 'commercial:po_partial_delivery', {
            id: result.data.id,
            status: result.data.status,
            updatedBy: req.userName,
            timestamp: new Date()
        });
    }

    res.json(result);
});

router.post('/purchase-orders/:id/receive', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada. Faca login novamente.');
    const validatedData = receivePurchaseOrderSchema.parse(req.body);
    await suppliersService.receiveOrder(
        req.params.id,
        validatedData.items,
        req.companyId,
        req.userName || 'Sistema',
        req.userId,
        req.userName,
        validatedData.warehouseId
    );
    res.json({ message: 'Itens recebidos com sucesso' });
});

// DELETE /api/commercial/purchase-orders/:id -- Soft delete (draft only)
router.delete('/purchase-orders/:id', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    await commercialService.deletePurchaseOrder(req.params.id, req.companyId);
    res.json({ message: 'Ordem de compra eliminada com sucesso' });
});

// ── Accounts Receivable ───────────────────────────────────────────────────────

// GET /api/commercial/accounts-receivable
router.get('/accounts-receivable', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const query = accountsReceivableQuerySchema.parse(req.query);
    res.json(await commercialService.getAccountsReceivable(req.companyId, query));
});

// ── Quotations ────────────────────────────────────────────────────────────────

// GET /api/commercial/quotations
router.get('/quotations', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const query = commercialListQuerySchema.parse(req.query);
    res.json(await commercialService.listQuotations(req.companyId, query));
});

// POST /api/commercial/quotations -- Create quotation
router.post('/quotations', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');

    const data = createCommercialQuotationSchema.parse(req.body);
    const result = await commercialService.createQuotation(data, req.companyId, req.userId, req.userName);

    if (result.success && result.data) {
        emitToModule(req.companyId, 'commercial', 'commercial:new_quote', {
            id: result.data.id,
            customer: result.data.customerName,
            total: result.data.total,
            timestamp: new Date()
        });
    }

    res.status(201).json(result);
});

// POST /api/commercial/quotations/:id/convert-to-invoice
router.post('/quotations/:id/convert-to-invoice', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');

    const data = convertQuotationToInvoiceSchema.parse(req.body);
    const result = await commercialService.convertQuotationToInvoice(req.params.id, data, req.companyId, req.userId, req.userName);

    if (result.success && result.data) {
        emitToModule(req.companyId, 'commercial', 'commercial:invoice_created', {
            invoiceId: result.data.id,
            invoiceNumber: result.data.invoiceNumber,
            customer: result.data.customerName,
            total: result.data.total,
            fromQuotation: req.params.id,
            timestamp: new Date()
        });
    }

    res.status(201).json(result);
});

// ── Cash Sessions (Turnos de Caixa) ──────────────────────────────────────────

// GET /api/commercial/shift
router.get('/shift', authorize(...POS_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const session = await cashSessionService.getCurrentSession(req.companyId);
    res.json(session || null);
});

// GET /api/commercial/shift/summary
router.get('/shift/summary', authorize(...POS_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const summary = await cashSessionService.getDailySummary(req.companyId);
    res.json(summary || null);
});

// POST /api/commercial/shift/open
router.post('/shift/open', authorize(...POS_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userId = req.userId || '';
    const { openingBalance, warehouseId, terminalId } = openSessionSchema.parse(req.body);

    // When company has multiple warehouses, require warehouseId
    const warehouseCount = await prisma.warehouse.count({ where: { companyId: req.companyId, isActive: true } });
    if (warehouseCount > 1 && !warehouseId) {
        throw ApiError.badRequest('Seleccione o armazém/loja para abrir o turno');
    }

    const session = await cashSessionService.openSession(req.companyId, userId, openingBalance, warehouseId || undefined, terminalId || undefined);

    emitToModule(req.companyId, 'commercial', 'commercial:shift_opened', {
        id: session.id,
        openedBy: req.userName,
        warehouseId: warehouseId || null,
        timestamp: new Date()
    });

    res.status(201).json(session);
});

// POST /api/commercial/shift/close
router.post('/shift/close', authorize(...POS_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userId = req.userId || '';
    const validated = closeSessionSchema.parse(req.body);
    const session = await cashSessionService.closeSession(req.companyId, userId, validated);
    res.json(session);
});

// POST /api/commercial/shift/movement
router.post('/shift/movement', authorize(...POS_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userId = req.userId || '';
    const validated = cashMovementSchema.parse(req.body);
    const movement = await cashSessionService.registerMovement(req.companyId, userId, validated);
    res.status(201).json(movement);
});

// GET /api/commercial/shift/history
router.get('/shift/history', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const query = cashSessionHistoryQuerySchema.parse(req.query);
    const data = await cashSessionService.getHistory(req.companyId, query);
    res.json(data);
});

// GET /api/commercial/shift/z-report
router.get('/shift/z-report', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const report = await cashSessionService.getZReport(req.companyId);
    res.json(report);
});

// GET /api/commercial/shift/:id/z-report
router.get('/shift/:id/z-report', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const report = await cashSessionService.getZReport(req.companyId, req.params.id);
    res.json(report);
});

// GET /api/commercial/shift/:id
router.get('/shift/:id', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const session = await cashSessionService.getSessionDetails(req.params.id, req.companyId);
    res.json(session);
});

// ── Real-time Stock Reservations ──────────────────────────────────────────

// POST /api/commercial/reserve
router.post('/reserve', authorize(...POS_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { productId, quantity, sessionId, warehouseId } = reserveItemSchema.parse(req.body);

    if (!productId || !quantity) throw ApiError.badRequest('Produto e quantidade são obrigatórios');

    const result = await commercialService.reserveItem({
        productId,
        quantity,
        sessionId,
        warehouseId,
        companyId: req.companyId
    });

    res.status(201).json(result);
});

// POST /api/commercial/release/:id
router.post('/release/:id', authorize(...POS_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await commercialService.releaseItem(req.params.id, req.companyId);
    res.json({ success: true });
});

// ── Sales Targets (Metas) ──────────────────────────────────────────────────

// GET /api/commercial/targets
router.get('/targets', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    const { employeeId } = salesTargetQuerySchema.parse(req.query);
    res.json(await salesTargetService.listTargets(req.companyId!, employeeId));
});

// POST /api/commercial/targets
router.post('/targets', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    const validated = salesTargetSchema.parse(req.body);
    res.json(await salesTargetService.createTarget(req.companyId!, validated));
});

// PATCH /api/commercial/targets/:id
router.patch('/targets/:id', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    const validated = updateSalesTargetSchema.parse(req.body);
    res.json(await salesTargetService.updateTarget(req.params.id, req.companyId!, validated));
});

// DELETE /api/commercial/targets/:id
router.delete('/targets/:id', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    res.json(await salesTargetService.deleteTarget(req.params.id, req.companyId!));
});

export default router;
