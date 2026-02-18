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

export default router;
