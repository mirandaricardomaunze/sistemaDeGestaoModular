import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { FiscalService } from '../services/fiscal.service';

const router = Router();
const fiscalService = new FiscalService(prisma);

// ============================================================================
// Tax Configs
// ============================================================================

router.get('/tax-configs', authenticate, async (req: AuthRequest, res) => {
    try {
        const configs = await fiscalService.getTaxConfigs(req.companyId!);
        res.json(configs);
    } catch (error) {
        console.error('Get tax configs error:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações fiscais' });
    }
});

router.post('/tax-configs', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const config = await prisma.taxConfig.create({
            data: {
                ...req.body,
                companyId: req.companyId
            }
        });
        res.status(201).json(config);
    } catch (error) {
        console.error('Create tax config error:', error);
        res.status(500).json({ error: 'Erro ao criar configuração fiscal' });
    }
});

router.put('/tax-configs/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const config = await prisma.taxConfig.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json(config);
    } catch (error) {
        console.error('Update tax config error:', error);
        res.status(500).json({ error: 'Erro ao atualizar configuração fiscal' });
    }
});

// ============================================================================
// IRPS Brackets
// ============================================================================

router.get('/irps-brackets', authenticate, async (req: AuthRequest, res) => {
    try {
        const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
        const brackets = await prisma.iRPSBracket.findMany({
            where: { year, isActive: true },
            orderBy: { minIncome: 'asc' }
        });
        res.json(brackets);
    } catch (error) {
        console.error('Get IRPS brackets error:', error);
        res.status(500).json({ error: 'Erro ao buscar escalões IRPS' });
    }
});

router.post('/irps-brackets', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const bracket = await prisma.iRPSBracket.create({
            data: req.body
        });
        res.status(201).json(bracket);
    } catch (error) {
        console.error('Create IRPS bracket error:', error);
        res.status(500).json({ error: 'Erro ao criar escalão IRPS' });
    }
});

// ============================================================================
// Tax Retentions
// ============================================================================

router.get('/retentions', authenticate, async (req: AuthRequest, res) => {
    try {
        const { period, type } = req.query;
        const retentions = await fiscalService.getRetentions(req.companyId!, period as string, type as string);
        res.json(retentions);
    } catch (error) {
        console.error('Get retentions error:', error);
        res.status(500).json({ error: 'Erro ao buscar retenções' });
    }
});

router.post('/retentions', authenticate, async (req: AuthRequest, res) => {
    try {
        const retention = await prisma.taxRetention.create({
            data: {
                ...req.body,
                companyId: req.companyId
            }
        });
        res.status(201).json(retention);
    } catch (error) {
        console.error('Create retention error:', error);
        res.status(500).json({ error: 'Erro ao criar retenção' });
    }
});

router.put('/retentions/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const retention = await prisma.taxRetention.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json(retention);
    } catch (error) {
        console.error('Update retention error:', error);
        res.status(500).json({ error: 'Erro ao atualizar retenção' });
    }
});

// ============================================================================
// Fiscal Reports
// ============================================================================

router.get('/reports', authenticate, async (req: AuthRequest, res) => {
    try {
        const reports = await prisma.fiscalReport.findMany({
            where: { companyId: req.companyId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(reports);
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ error: 'Erro ao buscar relatórios fiscais' });
    }
});

router.post('/reports', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    try {
        const report = await prisma.fiscalReport.create({
            data: {
                ...req.body,
                submittedBy: req.userId,
                companyId: req.companyId
            }
        });
        res.status(201).json(report);
    } catch (error) {
        console.error('Create report error:', error);
        res.status(500).json({ error: 'Erro ao criar relatório fiscal' });
    }
});

router.put('/reports/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    try {
        const report = await prisma.fiscalReport.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json(report);
    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ error: 'Erro ao atualizar relatório fiscal' });
    }
});

// ============================================================================
// Fiscal Deadlines
// ============================================================================

router.get('/deadlines', authenticate, async (req: AuthRequest, res) => {
    try {
        const deadlines = await prisma.fiscalDeadline.findMany({
            where: { companyId: req.companyId },
            orderBy: { dueDate: 'asc' }
        });
        res.json(deadlines);
    } catch (error) {
        console.error('Get deadlines error:', error);
        res.status(500).json({ error: 'Erro ao buscar prazos fiscais' });
    }
});

router.post('/deadlines', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const deadline = await prisma.fiscalDeadline.create({
            data: {
                ...req.body,
                companyId: req.companyId
            }
        });
        res.status(201).json(deadline);
    } catch (error) {
        console.error('Create deadline error:', error);
        res.status(500).json({ error: 'Erro ao criar prazo fiscal' });
    }
});

router.put('/deadlines/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const deadline = await prisma.fiscalDeadline.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json(deadline);
    } catch (error) {
        console.error('Update deadline error:', error);
        res.status(500).json({ error: 'Erro ao atualizar prazo fiscal' });
    }
});

router.post('/deadlines/:id/complete', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    try {
        const deadline = await prisma.fiscalDeadline.update({
            where: { id: req.params.id },
            data: {
                status: 'completed',
                completedAt: new Date(),
                completedBy: req.userId
            }
        });
        res.json(deadline);
    } catch (error) {
        console.error('Complete deadline error:', error);
        res.status(500).json({ error: 'Erro ao completar prazo fiscal' });
    }
});

export default router;
