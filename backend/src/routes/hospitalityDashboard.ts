import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { hospitalityDashboardService } from '../services/hospitalityDashboardService';
import { ApiError } from '../middleware/error.middleware';
import { requireModule } from '../middleware/module';

const router = Router();
router.use(authenticate, requireModule('HOSPITALITY'));

// ============================================================================
// Dashboard Summary & Feed
// ============================================================================

router.get('/summary', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await hospitalityDashboardService.getSummary(req.companyId);
    res.json(result);
});

router.get('/recent-bookings', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const limit = parseInt(String(req.query.limit)) || 5;
    const result = await hospitalityDashboardService.getRecentBookings(req.companyId, limit);
    res.json(result);
});

// ============================================================================
// Metrics & Analysis
// ============================================================================

router.get('/metrics', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const period = String(req.query.period || '1m');
    const result = await hospitalityDashboardService.getMetrics(req.companyId, period);
    res.json(result);
});

// ============================================================================
// Charts Data
// ============================================================================

router.get('/charts/revenue', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const period = String(req.query.period || '1m');
    const result = await hospitalityDashboardService.getRevenueChart(req.companyId, period);
    res.json(result);
});

router.get('/charts/occupancy', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const period = String(req.query.period || '1m');
    const result = await hospitalityDashboardService.getOccupancyChart(req.companyId, period);
    res.json(result);
});

router.get('/charts/room-types', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const period = String(req.query.period || '1m');
    const result = await hospitalityDashboardService.getRoomTypesChart(req.companyId, period);
    res.json(result);
});

router.get('/charts/consumption', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const period = String(req.query.period || '1m');
    const result = await hospitalityDashboardService.getConsumptionChart(req.companyId, period);
    res.json(result);
});

router.get('/reports', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const period = String(req.query.period || '1m');
    const result = await hospitalityDashboardService.getReports(req.companyId, period);
    res.json(result);
});

// I'll leave other chart routes as placeholders or implement them in service if they were heavily used.
// For now, let's keep the most important ones.

export default router;
