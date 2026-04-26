import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { hospitalityFinanceService } from '../services/hospitalityFinanceService';
import { ApiError } from '../middleware/error.middleware';
import { requireModule } from '../middleware/module';

const router = Router();
router.use(authenticate, requireModule('HOSPITALITY'));

// ============================================================================
// Dashboard & Trends
// ============================================================================

router.get('/dashboard', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { period = '1m' } = req.query;
    const dashboard = await hospitalityFinanceService.getDashboard(req.companyId, period as string);
    res.json(dashboard);
});

// ============================================================================
// Revenues & Expenses
// ============================================================================

router.get('/revenues', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await hospitalityFinanceService.getRevenues(req.companyId, req.query);
    res.json(result);
});

router.get('/expenses', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await hospitalityFinanceService.getExpenses(req.companyId, req.query);
    res.json(result);
});

router.post('/expenses', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const expense = await hospitalityFinanceService.createExpense(req.companyId, req.body);
    res.status(201).json(expense);
});

router.put('/expenses/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const expense = await hospitalityFinanceService.updateExpense(req.params.id, req.companyId, req.body);
    res.json(expense);
});

router.delete('/expenses/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await hospitalityFinanceService.deleteExpense(req.params.id, req.companyId);
    res.json({ message: 'Expense deleted successfully' });
});

// ============================================================================
// Reports
// ============================================================================

router.get('/reports/profit-loss', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        throw ApiError.badRequest('startDate e endDate são obrigatórios');
    }
    const report = await hospitalityFinanceService.getProfitLoss(
        req.companyId,
        startDate as string,
        endDate as string
    );
    res.json(report);
});

router.get('/reports/by-room', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { startDate, endDate } = req.query;
    const report = await hospitalityFinanceService.getByRoom(
        req.companyId,
        startDate as string,
        endDate as string
    );
    res.json(report);
});

export default router;
