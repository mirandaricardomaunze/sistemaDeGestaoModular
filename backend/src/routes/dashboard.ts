import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { dashboardService } from '../services/dashboardService';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.get('/metrics', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { warehouseId } = req.query;
    res.json(await dashboardService.getMetrics(req.companyId, warehouseId as string));
});

router.get('/charts/sales', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { period, warehouseId } = req.query;
    res.json(await dashboardService.getSalesChart(req.companyId, period as string, warehouseId as string));
});

router.get('/charts/top-products', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { limit = '10', period, warehouseId } = req.query;
    res.json(await dashboardService.getTopProducts(req.companyId, parseInt(limit as string), period as string, warehouseId as string));
});

router.get('/recent-activity', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { limit = '10', warehouseId } = req.query;
    res.json(await dashboardService.getRecentActivity(req.companyId, parseInt(limit as string), warehouseId as string));
});

router.get('/charts/categories', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { period = '30', warehouseId } = req.query;
    res.json(await dashboardService.getCategoryStats(req.companyId, parseInt(period as string), warehouseId as string));
});

router.get('/charts/payment-methods', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { period = '30', warehouseId } = req.query;
    res.json(await dashboardService.getPaymentMethodsBreakdown(req.companyId, parseInt(period as string), warehouseId as string));
});

export default router;
