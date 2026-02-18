import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { crmService } from '../services/crm.service';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

// ============================================================================
// Funnel Stages
// ============================================================================

router.get('/stages', authenticate, async (req: AuthRequest, res) => {
    const stages = await prisma.funnelStage.findMany({
        where: { companyId: req.companyId },
        orderBy: { order: 'asc' }
    });
    res.json(stages);
});

router.post('/stages', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    const stage = await prisma.funnelStage.create({
        data: {
            ...req.body,
            companyId: req.companyId
        }
    });
    res.status(201).json(stage);
});

router.put('/stages/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    const result = await prisma.funnelStage.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: req.body
    });
    if (result.count === 0) {
        throw ApiError.notFound('Estágio não encontrado ou acesso negado');
    }
    const stage = await prisma.funnelStage.findUnique({ where: { id: req.params.id } });
    res.json(stage);
});

router.delete('/stages/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    const result = await prisma.funnelStage.deleteMany({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (result.count === 0) {
        throw ApiError.notFound('Estágio não encontrado');
    }
    res.json({ message: 'Estágio removido' });
});

// ============================================================================
// Opportunities
// ============================================================================

router.get('/opportunities', authenticate, async (req: AuthRequest, res) => {
    const opportunities = await crmService.getOpportunities(req.companyId!);
    res.json(opportunities);
});

router.get('/opportunities/:id', authenticate, async (req: AuthRequest, res) => {
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
        throw ApiError.notFound('Oportunidade não encontrada');
    }

    res.json(opportunity);
});

router.post('/opportunities', authenticate, async (req: AuthRequest, res) => {
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
});

router.put('/opportunities/:id', authenticate, async (req: AuthRequest, res) => {
    const result = await prisma.opportunity.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: req.body
    });
    if (result.count === 0) {
        throw ApiError.notFound('Oportunidade não encontrada ou acesso negado');
    }
    const opportunity = await prisma.opportunity.findUnique({
        where: { id: req.params.id },
        include: {
            stage: true,
            interactions: true
        }
    });
    res.json(opportunity);
});

router.delete('/opportunities/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    const result = await prisma.opportunity.deleteMany({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (result.count === 0) {
        throw ApiError.notFound('Oportunidade não encontrada');
    }
    res.json({ message: 'Oportunidade removida' });
});

// Move opportunity to new stage
router.post('/opportunities/:id/move', authenticate, async (req: AuthRequest, res) => {
    const { newStageId, reason } = req.body;
    const oppId = req.params.id;

    const opp = await prisma.opportunity.findFirst({
        where: { id: oppId, companyId: req.companyId },
        include: { stage: true }
    });

    if (!opp) {
        throw ApiError.notFound('Oportunidade não encontrada');
    }

    const newStage = await prisma.funnelStage.findFirst({
        where: { id: newStageId, companyId: req.companyId }
    });

    if (!newStage) {
        throw ApiError.notFound('Estágio não encontrado');
    }

    // Calculate time in previous stage (days)
    const timeInPreviousStage = Math.ceil(
        (Date.now() - new Date(opp.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Update opportunity and create history
    const [updatedOpp] = await prisma.$transaction([
        prisma.opportunity.update({
            where: { id: oppId }, // Filtered by findFirst above, but could be more explicit
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
});

// ============================================================================
// Interactions
// ============================================================================

router.post('/opportunities/:id/interactions', authenticate, async (req: AuthRequest, res) => {
    // Verify opportunity ownership
    const opp = await prisma.opportunity.findFirst({
        where: { id: req.params.id, companyId: req.companyId }
    });

    if (!opp) {
        throw ApiError.notFound('Oportunidade não encontrada');
    }

    const interaction = await prisma.interaction.create({
        data: {
            opportunityId: req.params.id,
            ...req.body,
            userId: req.userId,
            userName: (req as any).user?.name || 'Utilizador'
        }
    });
    res.status(201).json(interaction);
});

router.get('/opportunities/:id/interactions', authenticate, async (req: AuthRequest, res) => {
    // Verify opportunity ownership
    const opp = await prisma.opportunity.findFirst({
        where: { id: req.params.id, companyId: req.companyId }
    });

    if (!opp) {
        throw ApiError.notFound('Oportunidade não encontrada');
    }

    const interactions = await prisma.interaction.findMany({
        where: { opportunityId: req.params.id },
        orderBy: { createdAt: 'desc' }
    });
    res.json(interactions);
});

export default router;
