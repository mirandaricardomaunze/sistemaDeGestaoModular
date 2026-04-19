import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { commercialService } from '../services/commercialService';
import { cashSessionService } from '../services/cashSessionService';
import { ApiError } from '../middleware/error.middleware';
import { emitToCompany } from '../lib/socket';
import { prisma } from '../lib/prisma';

const router = Router();

// ============================================================================
// Commercial Module -- Premium Analytics Routes
// ============================================================================

// GET /api/commercial/analytics -- Dashboard KPIs
router.get('/analytics', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    res.json(await commercialService.getAnalytics(req.companyId, userId));
});

// GET /api/commercial/margins?period=30&userId=xxx
router.get('/margins', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const period = Math.min(Math.max(parseInt(String(req.query.period || '30')) || 30, 1), 365);
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    res.json(await commercialService.getMarginAnalysis(req.companyId, period, userId));
});

// GET /api/commercial/stock-aging
router.get('/stock-aging', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.getStockAging(req.companyId));
});

// GET /api/commercial/supplier-performance
router.get('/supplier-performance', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.getSupplierPerformance(req.companyId));
});

// GET /api/commercial/inventory-turnover?period=90
router.get('/inventory-turnover', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const period = Math.min(Math.max(parseInt(String(req.query.period || '90')) || 90, 1), 365);
    res.json(await commercialService.getInventoryTurnover(req.companyId, period));
});

// GET /api/commercial/sales-report?period=30&userId=xxx
router.get('/sales-report', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const period = Math.min(Math.max(parseInt(String(req.query.period || '30')) || 30, 1), 365);
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    res.json(await commercialService.getSalesReport(req.companyId, period, userId));
});

// GET /api/commercial/warehouse-distribution
router.get('/warehouse-distribution', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.getWarehouseDistribution(req.companyId));
});

// GET /api/commercial/predictive/forecast
router.get('/predictive/forecast', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { predictiveService } = require('../services/predictiveService');
    res.json(await predictiveService.getInventoryForecast(req.companyId));
});

// POST /api/commercial/predictive/create-orders
router.post('/predictive/create-orders', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { predictiveService } = require('../services/predictiveService');
    res.json(await predictiveService.createDraftOrdersFromSuggestions(req.companyId, req.body.suggestions));
});

// ── Purchase Orders ───────────────────────────────────────────────────────────

// GET /api/commercial/purchase-orders -- restricted to manager+
router.get('/purchase-orders', authenticate, authorize('admin', 'manager', 'commercial'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.listPurchaseOrders(req.companyId, req.query));
});

// GET /api/commercial/purchase-orders/:id
router.get('/purchase-orders/:id', authenticate, authorize('admin', 'manager', 'commercial'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.getPurchaseOrderById(req.params.id, req.companyId));
});

// PATCH /api/commercial/purchase-orders/:id/status
router.patch('/purchase-orders/:id/status', authenticate, authorize('admin', 'manager', 'commercial'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { status } = req.body;
    if (!status) throw ApiError.badRequest('Status obrigatório');

    const result = await commercialService.updatePurchaseOrderStatus(req.params.id, status, req.companyId, req.userId);

    if (result.success && result.data) {
        // Socket notification on PO status change
        emitToCompany(req.companyId, 'commercial:po_status_changed', {
            id: result.data.id,
            status: result.data.status,
            supplier: (result.data as any).supplier?.name,
            updatedBy: req.userName,
            timestamp: new Date()
        });
    }

    res.json(result);
});

// PATCH /api/commercial/purchase-orders/:id/partial-delivery
router.patch('/purchase-orders/:id/partial-delivery', authenticate, authorize('admin', 'manager', 'commercial'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { deliveries } = req.body;
    if (!deliveries || !Array.isArray(deliveries) || deliveries.length === 0) {
        throw ApiError.badRequest('Lista de entregas parciais é obrigatória');
    }

    const result = await commercialService.registerPartialDelivery(req.params.id, deliveries, req.companyId, req.userId);

    if (result.success && result.data) {
        emitToCompany(req.companyId, 'commercial:po_partial_delivery', {
            id: result.data.id,
            status: result.data.status,
            updatedBy: req.userName,
            timestamp: new Date()
        });
    }

    res.json(result);
});

// DELETE /api/commercial/purchase-orders/:id -- Soft delete (draft only)
router.delete('/purchase-orders/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    await commercialService.deletePurchaseOrder(req.params.id, req.companyId);
    res.json({ message: 'Ordem de compra eliminada com sucesso' });
});

// ── Accounts Receivable ───────────────────────────────────────────────────────

// GET /api/commercial/accounts-receivable
router.get('/accounts-receivable', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.getAccountsReceivable(req.companyId, req.query));
});

// ── Quotations ────────────────────────────────────────────────────────────────

// GET /api/commercial/quotations
router.get('/quotations', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await commercialService.listQuotations(req.companyId, req.query));
});

// POST /api/commercial/quotations -- Create quotation
router.post('/quotations', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    const result = await commercialService.createQuotation(req.body, req.companyId);

    if (result.success && result.data) {
        emitToCompany(req.companyId, 'commercial:new_quote', {
            id: result.data.id,
            customer: result.data.customerName,
            total: result.data.total,
            timestamp: new Date()
        });
    }

    res.status(201).json(result);
});

// POST /api/commercial/quotations/:id/convert-to-invoice
router.post('/quotations/:id/convert-to-invoice', authenticate, authorize('admin', 'manager', 'commercial'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    const result = await commercialService.convertQuotationToInvoice(req.params.id, req.body, req.companyId);

    if (result.success && result.data) {
        emitToCompany(req.companyId, 'commercial:invoice_created', {
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
router.get('/shift', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const session = await cashSessionService.getCurrentSession(req.companyId);
    res.json(session || null);
});

// GET /api/commercial/shift/summary
router.get('/shift/summary', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const summary = await cashSessionService.getDailySummary(req.companyId);
    res.json(summary || null);
});

// POST /api/commercial/shift/open
router.post('/shift/open', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userId = req.userId || '';
    const { openingBalance, warehouseId } = req.body;

    if (openingBalance === undefined || openingBalance === null) throw ApiError.badRequest('Fundo de caixa obrigatório');
    const balance = Number(openingBalance);
    if (isNaN(balance) || balance < 0) throw ApiError.badRequest('Fundo de caixa deve ser um valor não negativo');

    // When company has multiple warehouses, require warehouseId
    const warehouseCount = await prisma.warehouse.count({ where: { companyId: req.companyId, isActive: true } });
    if (warehouseCount > 1 && !warehouseId) {
        throw ApiError.badRequest('Seleccione o armazém/loja para abrir o turno');
    }

    const session = await cashSessionService.openSession(req.companyId, userId, balance, warehouseId || undefined, undefined);

    emitToCompany(req.companyId, 'commercial:shift_opened', {
        id: session.id,
        openedBy: req.userName,
        warehouseId: warehouseId || null,
        timestamp: new Date()
    });

    res.status(201).json(session);
});

// POST /api/commercial/shift/close
router.post('/shift/close', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userId = req.userId || '';
    const session = await cashSessionService.closeSession(req.companyId, userId, req.body);
    res.json(session);
});

// POST /api/commercial/shift/movement
router.post('/shift/movement', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userId = req.userId || '';
    const movement = await cashSessionService.registerMovement(req.companyId, userId, req.body);
    res.status(201).json(movement);
});

// GET /api/commercial/shift/history
router.get('/shift/history', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const data = await cashSessionService.getHistory(req.companyId, req.query);
    res.json(data);
});

// GET /api/commercial/shift/:id
router.get('/shift/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const session = await cashSessionService.getSessionDetails(req.params.id, req.companyId);
    res.json(session);
});

// ── Real-time Stock Reservations ──────────────────────────────────────────

// POST /api/commercial/reserve
router.post('/reserve', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { productId, quantity, sessionId } = req.body;
    
    if (!productId || !quantity) throw ApiError.badRequest('Produto e quantidade são obrigatórios');
    
    const result = await commercialService.reserveItem({
        productId,
        quantity: Number(quantity),
        sessionId,
        companyId: req.companyId
    });
    
    res.status(201).json(result);
});

// POST /api/commercial/release/:id
router.post('/release/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await commercialService.releaseItem(req.params.id, req.companyId);
    res.json({ success: true });
});

export default router;
