import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { dashboardService } from '../services/dashboard.service';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.get('/metrics', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    res.json(await dashboardService.getMetrics(req.companyId));
});

router.get('/charts/sales', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { period } = req.query;
    res.json(await dashboardService.getSalesChart(req.companyId, period as string));
});

router.get('/charts/top-products', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { limit = '10', period } = req.query;
    res.json(await dashboardService.getTopProducts(req.companyId, parseInt(limit as string), period as string));
});

router.get('/recent-activity', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { limit = '10' } = req.query;
    res.json(await dashboardService.getRecentActivity(req.companyId, parseInt(limit as string)));
});

router.get('/charts/categories', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { period = '30' } = req.query;
    res.json(await dashboardService.getCategoryStats(req.companyId, parseInt(period as string)));
});

router.get('/charts/payment-methods', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { period = '30' } = req.query;
    res.json(await dashboardService.getPaymentMethodsBreakdown(req.companyId, parseInt(period as string)));
});

export default router;
