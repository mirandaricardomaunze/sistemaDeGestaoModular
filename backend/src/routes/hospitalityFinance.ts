import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { hospitalityFinanceService } from '../services/hospitalityFinanceService';
import { ApiError } from '../middleware/error.middleware';
import { requireModule } from '../middleware/module';

const router = Router();
router.use(authenticate, requireModule('HOSPITALITY'));

const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'operator'] as const;
const MANAGER_ROLES = ['super_admin', 'admin', 'manager'] as const;

// ============================================================================
// Dashboard & Trends
// ============================================================================

router.get('/dashboard', authenticate, authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { period = '1m' } = req.query;
    const dashboard = await hospitalityFinanceService.getDashboard(req.companyId, period as string);
    res.json(dashboard);
});

// ============================================================================
// Revenues & Expenses
// ============================================================================

router.get('/revenues', authenticate, authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await hospitalityFinanceService.getRevenues(req.companyId, req.query);
    res.json(result);
});

router.get('/expenses', authenticate, authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await hospitalityFinanceService.getExpenses(req.companyId, req.query);
    res.json(result);
});

router.post('/expenses', authenticate, authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const expense = await hospitalityFinanceService.createExpense(req.companyId, req.body);
    res.status(201).json(expense);
});

router.put('/expenses/:id', authenticate, authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const expense = await hospitalityFinanceService.updateExpense(req.params.id, req.companyId, req.body);
    res.json(expense);
});

router.delete('/expenses/:id', authenticate, authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await hospitalityFinanceService.deleteExpense(req.params.id, req.companyId);
    res.json({ message: 'Expense deleted successfully' });
});

// ============================================================================
// Reports
// ============================================================================

router.get('/reports/profit-loss', authenticate, authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
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

router.get('/reports/by-room', authenticate, authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
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
