import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { bottleStoreService } from '../services/bottleStoreService';
import { bottleReturnsService } from '../services/bottleReturnsService';
import { cashSessionService } from '../services/cashSessionService';
import { creditSalesService } from '../services/creditSalesService';
import { ApiError } from '../middleware/error.middleware';
import { emitToCompany } from '../lib/socket';

const router = Router();

// ============================================================================
// DASHBOARD & REPORTS
// ============================================================================

router.get('/dashboard', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const range = (req.query.range as string) || '1M';
    const stats = await bottleStoreService.getDashboardStats(req.companyId, range);
    res.json(stats);
});

router.get('/reports', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const reportData = await bottleStoreService.getSalesReport(req.companyId, req.query);
    res.json(reportData);
});

// ============================================================================
// STOCK MOVEMENTS
// ============================================================================

router.get('/movements', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const movements = await bottleStoreService.getStockMovements(req.companyId, req.query);
    res.json(movements);
});

router.post('/movements', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const movement = await bottleStoreService.recordStockMovement(req.companyId, userName, req.body);
    res.status(201).json(movement);
});

// ============================================================================
// BOTTLE RETURNS (Vasilhames)
// ============================================================================

router.get('/bottle-returns', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const data = await bottleReturnsService.getMovements(req.companyId, req.query);
    res.json(data);
});

router.get('/bottle-returns/customer/:customerId', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const balance = await bottleReturnsService.getCustomerBalance(req.companyId, req.params.customerId);
    res.json(balance);
});

router.post('/bottle-returns/deposit', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const data = await bottleReturnsService.recordDeposit(req.companyId, userName, req.body);

    // Socket Notification: Bottle Deposit
    emitToCompany(req.companyId, 'bottlestore:bottle_update', {
        type: 'deposit',
        customer: req.body.customerId,
        timestamp: new Date()
    });

    res.status(201).json(data);
});

router.post('/bottle-returns/return', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const data = await bottleReturnsService.recordReturn(req.companyId, userName, req.body);
    res.status(201).json(data);
});

router.get('/bottle-returns/summary', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { customerId } = req.query;
    if (!customerId) throw ApiError.badRequest('customerId é obrigatório');
    const summary = await bottleReturnsService.getCustomerBalance(req.companyId, customerId as string);
    res.json(summary);
});

// ============================================================================
// CASH SESSIONS (Caixa)
// ============================================================================

router.get('/cash-session', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const session = await cashSessionService.getCurrentSession(req.companyId);
    res.json(session);
});

router.get('/cash-session/summary', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const summary = await cashSessionService.getDailySummary(req.companyId);
    res.json(summary);
});

router.post('/cash-session/open', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    if (!req.userId) throw ApiError.unauthorized('Utilizador não autenticado');
    const session = await cashSessionService.openSession(req.companyId, req.userId, req.body.openingBalance);
    res.status(201).json(session);
});

router.post('/cash-session/close', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const session = await cashSessionService.closeSession(req.companyId, userName, req.body);
    res.json(session);
});

router.get('/cash-session/history', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const history = await cashSessionService.getHistory(req.companyId, req.query);
    res.json(history);
});

router.post('/cash-session/withdrawal', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userId = req.userName || 'Sistema';
    const movement = await cashSessionService.registerMovement(req.companyId, userId, { ...req.body, type: 'sangria' });
    res.status(201).json(movement);
});

router.post('/cash-session/deposit', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userId = req.userName || 'Sistema';
    const movement = await cashSessionService.registerMovement(req.companyId, userId, { ...req.body, type: 'suprimento' });
    res.status(201).json(movement);
});

// ============================================================================
// CREDIT SALES (Vendas a Crédito)
// ============================================================================

router.get('/credit-sales', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const data = await creditSalesService.getCreditSales(req.companyId, req.query);
    res.json(data);
});

router.post('/credit-sales/pay', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const payment = await creditSalesService.registerPayment(req.companyId, userName, req.body);
    res.status(201).json(payment);
});

// ============================================================================
// BATCHES -- lotes e validades
// ============================================================================

router.get('/batches', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await bottleStoreService.getBatches(req.companyId, req.query);
    res.json(result);
});

router.get('/batches/expiring', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const days = req.query.days ? Number(req.query.days) : 30;
    const result = await bottleStoreService.getExpiringBatches(req.companyId, days);
    res.json(result);
});

router.post('/batches', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const batch = await bottleStoreService.createBatch(req.companyId, req.body, req.userName || req.userId);
    res.status(201).json(batch);
});

// ============================================================================
// PRICE TIERS -- descontos por volume
// ============================================================================

router.get('/price-tiers', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await bottleStoreService.getPriceTiers(req.companyId, req.query.productId as string);
    res.json(result);
});

router.post('/price-tiers', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const tier = await bottleStoreService.createPriceTier(req.companyId, req.body);
    res.status(201).json(tier);
});

router.delete('/price-tiers/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await bottleStoreService.deletePriceTier(req.companyId, req.params.id);
    res.json({ message: 'Nível de preço eliminado' });
});

// ============================================================================
// Z REPORT
// ============================================================================

router.get('/cash-session/z-report', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const report = await cashSessionService.getZReport(req.companyId);
    res.json(report);
});

router.get('/credit-sales/debtors', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const report = await creditSalesService.getDebtorsReport(req.companyId);
    res.json(report);
});

router.get('/credit-sales/customer/:customerId', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const summary = await creditSalesService.getCustomerSummary(req.companyId, req.params.customerId);
    res.json(summary);
});

router.get('/credit-sales/:saleId/payments', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const history = await creditSalesService.getPaymentHistory(req.companyId, req.params.saleId);
    res.json(history);
});

export default router;
