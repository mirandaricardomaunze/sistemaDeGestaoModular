import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { bottleStoreService } from '../services/bottle-store.service';
import { bottleReturnsService } from '../services/bottle-returns.service';
import { cashSessionService } from '../services/cash-session.service';
import { creditSalesService } from '../services/credit-sales.service';
import { ApiError } from '../middleware/error.middleware';

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
    res.status(201).json(data);
});

router.post('/bottle-returns/return', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const data = await bottleReturnsService.recordReturn(req.companyId, userName, req.body);
    res.status(201).json(data);
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
    const userName = req.userName || 'Sistema';
    const session = await cashSessionService.openSession(req.companyId, userName, req.body.openingBalance);
    res.status(201).json(session);
});

router.post('/cash-session/close', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const userName = req.userName || 'Sistema';
    const session = await cashSessionService.closeSession(req.companyId, userName, req.body);
    res.json(session);
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

export default router;
