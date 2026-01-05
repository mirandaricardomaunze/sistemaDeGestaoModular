import { Router } from 'express';
import { prisma } from '../index';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { CRMService } from '../services/crm.service';

const router = Router();
const crmService = new CRMService(prisma);

// ============================================================================
// Funnel Stages
// ============================================================================

router.get('/stages', authenticate, async (req: AuthRequest, res) => {
    try {
        const stages = await prisma.funnelStage.findMany({
            where: { companyId: req.companyId },
            orderBy: { order: 'asc' }
        });
        res.json(stages);
    } catch (error) {
        console.error('Get stages error:', error);
        res.status(500).json({ error: 'Erro ao buscar estágios' });
    }
});

router.post('/stages', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    try {
        const stage = await prisma.funnelStage.create({
            data: {
                ...req.body,
                companyId: req.companyId
            }
        });
        res.status(201).json(stage);
    } catch (error) {
        console.error('Create stage error:', error);
        res.status(500).json({ error: 'Erro ao criar estágio' });
    }
});

router.put('/stages/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    try {
        const stage = await prisma.funnelStage.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json(stage);
    } catch (error) {
        console.error('Update stage error:', error);
        res.status(500).json({ error: 'Erro ao atualizar estágio' });
    }
});

router.delete('/stages/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    try {
        const result = await prisma.funnelStage.deleteMany({
            where: { id: req.params.id, companyId: req.companyId }
        });
        if (result.count === 0) {
            return res.status(404).json({ error: 'Estágio não encontrado' });
        }
        res.json({ message: 'Estágio removido' });
    } catch (error) {
        console.error('Delete stage error:', error);
        res.status(500).json({ error: 'Erro ao remover estágio' });
    }
});

// ============================================================================
// Opportunities
// ============================================================================

router.get('/opportunities', authenticate, async (req: AuthRequest, res) => {
    try {
        const opportunities = await crmService.getOpportunities(req.companyId!);
        res.json(opportunities);
    } catch (error) {
        console.error('Get opportunities error:', error);
        res.status(500).json({ error: 'Erro ao buscar oportunidades' });
    }
});

router.get('/opportunities/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const opportunity = await prisma.opportunity.findFirst({
            where: { id: req.params.id, companyId: req.companyId },
            include: {
                stage: true,
                customer: true,
                interactions: { orderBy: { createdAt: 'desc' } },
                stageHistory: { orderBy: { changedAt: 'desc' } }
            }
        });

        if (!opportunity) {
            return res.status(404).json({ error: 'Oportunidade não encontrada' });
        }

        res.json(opportunity);
    } catch (error) {
        console.error('Get opportunity error:', error);
        res.status(500).json({ error: 'Erro ao buscar oportunidade' });
    }
});

router.post('/opportunities', authenticate, async (req: AuthRequest, res) => {
    try {
        const opportunity = await prisma.opportunity.create({
            data: {
                ...req.body,
                userId: req.userId,
                companyId: req.companyId
            },
            include: {
                stage: true,
                interactions: true,
                stageHistory: true
            }
        });
        res.status(201).json(opportunity);
    } catch (error) {
        console.error('Create opportunity error:', error);
        res.status(500).json({ error: 'Erro ao criar oportunidade' });
    }
});

router.put('/opportunities/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const opportunity = await prisma.opportunity.update({
            where: { id: req.params.id },
            data: req.body,
            include: {
                stage: true,
                interactions: true
            }
        });
        res.json(opportunity);
    } catch (error) {
        console.error('Update opportunity error:', error);
        res.status(500).json({ error: 'Erro ao atualizar oportunidade' });
    }
});

router.delete('/opportunities/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    try {
        const result = await prisma.opportunity.deleteMany({
            where: { id: req.params.id, companyId: req.companyId }
        });
        if (result.count === 0) {
            return res.status(404).json({ error: 'Oportunidade não encontrada' });
        }
        res.json({ message: 'Oportunidade removida' });
    } catch (error) {
        console.error('Delete opportunity error:', error);
        res.status(500).json({ error: 'Erro ao remover oportunidade' });
    }
});

// Move opportunity to new stage
router.post('/opportunities/:id/move', authenticate, async (req: AuthRequest, res) => {
    try {
        const { newStageId, reason } = req.body;
        const oppId = req.params.id;

        const opp = await prisma.opportunity.findFirst({
            where: { id: oppId, companyId: req.companyId },
            include: { stage: true }
        });

        if (!opp) {
            return res.status(404).json({ error: 'Oportunidade não encontrada' });
        }

        const newStage = await prisma.funnelStage.findFirst({
            where: { id: newStageId, companyId: req.companyId }
        });

        if (!newStage) {
            return res.status(404).json({ error: 'Estágio não encontrado' });
        }

        // Calculate time in previous stage (days)
        const timeInPreviousStage = Math.ceil(
            (Date.now() - new Date(opp.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Update opportunity and create history
        const [updatedOpp] = await prisma.$transaction([
            prisma.opportunity.update({
                where: { id: oppId },
                data: {
                    stageId: newStageId,
                    stageType: newStage.type,
                    stageChangedAt: new Date(),
                    ...(newStage.isClosedStage && { closedAt: new Date() })
                }
            }),
            prisma.stageHistory.create({
                data: {
                    opportunityId: oppId,
                    fromStageId: opp.stageId,
                    fromStageName: opp.stage.name,
                    toStageId: newStageId,
                    toStageName: newStage.name,
                    changedBy: req.userId,
                    reason,
                    timeInPreviousStage
                }
            })
        ]);

        res.json(updatedOpp);
    } catch (error) {
        console.error('Move opportunity error:', error);
        res.status(500).json({ error: 'Erro ao mover oportunidade' });
    }
});

// ============================================================================
// Interactions
// ============================================================================

router.post('/opportunities/:id/interactions', authenticate, async (req: AuthRequest, res) => {
    try {
        const interaction = await prisma.interaction.create({
            data: {
                opportunityId: req.params.id,
                ...req.body,
                userId: req.userId,
                userName: (req as any).user?.name || 'Utilizador'
            }
        });
        res.status(201).json(interaction);
    } catch (error) {
        console.error('Create interaction error:', error);
        res.status(500).json({ error: 'Erro ao criar interação' });
    }
});

router.get('/opportunities/:id/interactions', authenticate, async (req: AuthRequest, res) => {
    try {
        const interactions = await prisma.interaction.findMany({
            where: { opportunityId: req.params.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(interactions);
    } catch (error) {
        console.error('Get interactions error:', error);
        res.status(500).json({ error: 'Erro ao buscar interações' });
    }
});

export default router;
