import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { commercialService } from '../services/commercial.service';
import { cashSessionService } from '../services/cash-session.service';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// ============================================================================
// Commercial Module — Premium Analytics Routes
// ============================================================================

// GET /api/commercial/analytics — Dashboard KPIs (revenue, COGS, margins, turnover)
router.get('/analytics', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.getAnalytics(req.companyId));
});

// GET /api/commercial/margins?period=30 — Margin analysis by category & product
router.get('/margins', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const period = parseInt(String(req.query.period || '30'));
    res.json(await commercialService.getMarginAnalysis(req.companyId, period));
});

// GET /api/commercial/stock-aging — Stock aging analysis
router.get('/stock-aging', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.getStockAging(req.companyId));
});

// GET /api/commercial/supplier-performance — Supplier performance KPIs
router.get('/supplier-performance', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.getSupplierPerformance(req.companyId));
});

// GET /api/commercial/inventory-turnover?period=90 — Turnover by category
router.get('/inventory-turnover', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const period = parseInt(String(req.query.period || '90'));
    res.json(await commercialService.getInventoryTurnover(req.companyId, period));
});

// GET /api/commercial/sales-report?period=30 — Sales report with charts
router.get('/sales-report', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const period = parseInt(String(req.query.period || '30'));
    res.json(await commercialService.getSalesReport(req.companyId, period));
});

// ── Purchase Orders (Global management) ──────────────────────────────────────

// GET /api/commercial/purchase-orders — List all POs with filters
router.get('/purchase-orders', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.listPurchaseOrders(req.companyId, req.query));
});

// GET /api/commercial/purchase-orders/:id — Get single PO
router.get('/purchase-orders/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.getPurchaseOrderById(req.params.id, req.companyId));
});

// PATCH /api/commercial/purchase-orders/:id/status — Update PO status
router.patch('/purchase-orders/:id/status', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { status } = req.body;
    if (!status) throw ApiError.badRequest('Status obrigatório');
    res.json(await commercialService.updatePurchaseOrderStatus(req.params.id, status, req.companyId));
});

// DELETE /api/commercial/purchase-orders/:id — Delete draft PO
router.delete('/purchase-orders/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    await commercialService.deletePurchaseOrder(req.params.id, req.companyId);
    res.json({ message: 'Ordem de compra eliminada com sucesso' });
});

// ── Accounts Receivable ───────────────────────────────────────────────────────

// GET /api/commercial/accounts-receivable — Customer debts from unpaid invoices
router.get('/accounts-receivable', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.getAccountsReceivable(req.companyId, req.query));
});

// ── Quotations ────────────────────────────────────────────────────────────────

// GET /api/commercial/quotations — List all quotations
router.get('/quotations', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.listQuotations(req.companyId, req.query));
});

// POST /api/commercial/quotations — Create quotation
router.post('/quotations', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const quote = await commercialService.createQuotation(req.body, req.companyId);
    res.status(201).json(quote);
});

// ── Cash Sessions (Turnos de Caixa) ──────────────────────────────────────────

// GET /api/commercial/shift — Turno actual em aberto
router.get('/shift', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const session = await cashSessionService.getCurrentSession(req.companyId);
    res.json(session || null);
});

// GET /api/commercial/shift/summary — Resumo do turno actual (vendas por método)
router.get('/shift/summary', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const summary = await cashSessionService.getDailySummary(req.companyId);
    res.json(summary || null);
});

// POST /api/commercial/shift/open — Abrir turno com fundo de caixa
router.post('/shift/open', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userId = req.userId || '';
    const { openingBalance } = req.body;
    if (openingBalance === undefined || openingBalance === null) throw ApiError.badRequest('Fundo de caixa obrigatório');
    const session = await cashSessionService.openSession(req.companyId, userId, Number(openingBalance));
    res.status(201).json(session);
});

// POST /api/commercial/shift/close — Fechar turno com contagem de caixa
router.post('/shift/close', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userId = req.userId || '';
    const session = await cashSessionService.closeSession(req.companyId, userId, req.body);
    res.json(session);
});

// POST /api/commercial/shift/movement — Registar Sangria ou Suprimento
router.post('/shift/movement', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userId = req.userId || '';
    const movement = await cashSessionService.registerMovement(req.companyId, userId, req.body);
    res.status(201).json(movement);
});

// GET /api/commercial/shift/history — Histórico de turnos fechados
router.get('/shift/history', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const data = await cashSessionService.getHistory(req.companyId, req.query);
    res.json(data);
});

// GET /api/commercial/shift/:id — Detalhes de um turno específico
router.get('/shift/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const session = await cashSessionService.getSessionDetails(req.params.id, req.companyId);
    res.json(session);
});

export default router;
