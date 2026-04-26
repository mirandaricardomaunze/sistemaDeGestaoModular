import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { fiscalService } from '../services/fiscalService';
import { ivaService } from '../services/ivaService';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// ============================================================================
// Tax Configs
// ============================================================================

router.get('/tax-configs', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const configs = await fiscalService.getTaxConfigs(req.companyId);
    res.json(configs);
});

router.post('/tax-configs', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const config = await prisma.taxConfig.create({
        data: { ...req.body, companyId: req.companyId }
    });
    res.status(201).json(config);
});

router.put('/tax-configs/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await prisma.taxConfig.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: req.body
    });

    if (result.count === 0) throw ApiError.notFound('Configuração não encontrada');

    const config = await prisma.taxConfig.findUnique({ where: { id: req.params.id } });
    res.json(config);
});

// ============================================================================
// IRPS Brackets
// ============================================================================
router.get('/irps-brackets', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { year } = req.query;
    const currentYear = year ? Number(year) : new Date().getFullYear();
    const brackets = await prisma.iRPSBracket.findMany({
        where: {
            year: currentYear, isActive: true,
            OR: [{ companyId: req.companyId }, { companyId: null }]
        },
        orderBy: { minIncome: 'asc' }
    });
    res.json(brackets);
});

router.post('/irps-brackets', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const bracket = await prisma.iRPSBracket.create({
        data: { ...req.body, companyId: req.companyId }
    });
    res.status(201).json(bracket);
});

// ============================================================================
// Tax Retentions
// ============================================================================

router.get('/retentions', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { period, type } = req.query;
    const retentions = await fiscalService.getRetentions(req.companyId, period as string, type as string);
    res.json(retentions);
});

router.post('/retentions', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const retention = await prisma.taxRetention.create({
        data: { ...req.body, companyId: req.companyId }
    });
    res.status(201).json(retention);
});

router.put('/retentions/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await prisma.taxRetention.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: req.body
    });
    if (result.count === 0) throw ApiError.notFound('Retenção não encontrada');
    const retention = await prisma.taxRetention.findUnique({ where: { id: req.params.id } });
    res.json(retention);
});

// ============================================================================
// Fiscal Reports
// ============================================================================

router.get('/reports', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const reports = await prisma.fiscalReport.findMany({
        where: { companyId: req.companyId },
        orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
});

router.post('/reports', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const report = await prisma.fiscalReport.create({
        data: { ...req.body, submittedBy: req.userId, companyId: req.companyId }
    });
    res.status(201).json(report);
});

router.put('/reports/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await prisma.fiscalReport.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: req.body
    });
    if (result.count === 0) throw ApiError.notFound('Relatório não encontrado');
    const report = await prisma.fiscalReport.findUnique({ where: { id: req.params.id } });
    res.json(report);
});

// ============================================================================
// Fiscal Deadlines
// ============================================================================

router.get('/deadlines', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const deadlines = await prisma.fiscalDeadline.findMany({
        where: { companyId: req.companyId },
        orderBy: { dueDate: 'asc' }
    });
    res.json(deadlines);
});

router.post('/deadlines', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const deadline = await prisma.fiscalDeadline.create({
        data: { ...req.body, companyId: req.companyId }
    });
    res.status(201).json(deadline);
});

router.put('/deadlines/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await prisma.fiscalDeadline.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: req.body
    });
    if (result.count === 0) throw ApiError.notFound('Prazo não encontrado');
    const deadline = await prisma.fiscalDeadline.findUnique({ where: { id: req.params.id } });
    res.json(deadline);
});

router.post('/deadlines/:id/complete', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await prisma.fiscalDeadline.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: { status: 'completed', completedAt: new Date(), completedBy: req.userId }
    });
    if (result.count === 0) throw ApiError.notFound('Prazo não encontrado');
    const deadline = await prisma.fiscalDeadline.findUnique({ where: { id: req.params.id } });
    res.json(deadline);
});

// ============================================================================
// Fiscal Metrics for Modules
// ============================================================================

router.get('/metrics/:module', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const metrics = await fiscalService.getModuleFiscalMetrics(req.companyId, req.params.module);
    res.json(metrics);
});

// ============================================================================
// IVA RATES
// ============================================================================

router.get('/iva-rates/dashboard', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await ivaService.getDashboard(req.companyId));
});

router.get('/iva-rates/active', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await ivaService.getActive(req.companyId));
});

router.get('/iva-rates', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await ivaService.list(req.companyId, req.query));
});

router.get('/iva-rates/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await ivaService.getById(req.params.id, req.companyId));
});

router.post('/iva-rates', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const rate = await ivaService.create(req.body, req.companyId);
    res.status(201).json(rate);
});

router.put('/iva-rates/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await ivaService.update(req.params.id, req.body, req.companyId));
});

router.delete('/iva-rates/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await ivaService.delete(req.params.id, req.companyId));
});

export default router;
