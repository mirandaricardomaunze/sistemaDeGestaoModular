import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all campaigns
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { status, active } = req.query;

        const where: any = {
            companyId: req.companyId // Multi-tenancy isolation
        };

        if (status) {
            where.status = status;
        }

        if (active === 'true') {
            const now = new Date();
            where.status = 'active';
            where.startDate = { lte: now };
            where.endDate = { gte: now };
        }

        const campaigns = await prisma.campaign.findMany({
            where,
            include: {
                _count: { select: { usages: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(campaigns);
    } catch (error) {
        console.error('Get campaigns error:', error);
        res.status(500).json({ error: 'Erro ao buscar campanhas' });
    }
});

// Get campaign by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const campaign = await prisma.campaign.findFirst({
            where: { id: req.params.id, companyId: req.companyId },
            include: {
                usages: {
                    take: 50,
                    orderBy: { usedAt: 'desc' }
                }
            }
        });

        if (!campaign) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        res.json(campaign);
    } catch (error) {
        console.error('Get campaign error:', error);
        res.status(500).json({ error: 'Erro ao buscar campanha' });
    }
});

// Create campaign
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            name,
            description,
            code,
            startDate,
            endDate,
            discountType,
            discountValue,
            minPurchaseAmount,
            maxDiscountAmount,
            maxTotalUses,
            applyToAllProducts
        } = req.body;

        // Check if code already exists
        if (code) {
            const existing = await prisma.campaign.findUnique({
                where: { code }
            });
            if (existing) {
                return res.status(400).json({ error: 'Código de campanha já existe' });
            }
        }

        const campaign = await prisma.campaign.create({
            data: {
                name,
                description,
                code,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                discountType,
                discountValue,
                minPurchaseAmount,
                maxDiscountAmount,
                maxTotalUses,
                applyToAllProducts: applyToAllProducts ?? true,
                status: 'draft',
                companyId: req.companyId // Multi-tenancy isolation
            }
        });

        res.status(201).json(campaign);
    } catch (error) {
        console.error('Create campaign error:', error);
        res.status(500).json({ error: 'Erro ao criar campanha' });
    }
});

// Update campaign
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const updateData = { ...req.body };

        if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
        if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

        // Verify ownership
        const existing = await prisma.campaign.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        const campaign = await prisma.campaign.update({
            where: { id: req.params.id },
            data: updateData
        });

        res.json(campaign);
    } catch (error) {
        console.error('Update campaign error:', error);
        res.status(500).json({ error: 'Erro ao atualizar campanha' });
    }
});

// Activate campaign
router.post('/:id/activate', authenticate, async (req: AuthRequest, res) => {
    try {
        // Verify ownership
        const existing = await prisma.campaign.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        const campaign = await prisma.campaign.update({
            where: { id: req.params.id },
            data: { status: 'active' }
        });

        res.json(campaign);
    } catch (error) {
        console.error('Activate campaign error:', error);
        res.status(500).json({ error: 'Erro ao ativar campanha' });
    }
});

// Pause campaign
router.post('/:id/pause', authenticate, async (req: AuthRequest, res) => {
    try {
        // Verify ownership
        const existing = await prisma.campaign.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        const campaign = await prisma.campaign.update({
            where: { id: req.params.id },
            data: { status: 'paused' }
        });

        res.json(campaign);
    } catch (error) {
        console.error('Pause campaign error:', error);
        res.status(500).json({ error: 'Erro ao pausar campanha' });
    }
});

// Cancel campaign
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
    try {
        // Verify ownership
        const existing = await prisma.campaign.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        const campaign = await prisma.campaign.update({
            where: { id: req.params.id },
            data: { status: 'cancelled' }
        });

        res.json(campaign);
    } catch (error) {
        console.error('Cancel campaign error:', error);
        res.status(500).json({ error: 'Erro ao cancelar campanha' });
    }
});

// Validate promo code
router.post('/validate-code', authenticate, async (req: AuthRequest, res) => {
    try {
        const { code, cartTotal, customerId } = req.body;

        const campaign = await prisma.campaign.findFirst({
            where: { code: code.toUpperCase(), companyId: req.companyId }
        });

        if (!campaign) {
            return res.status(404).json({
                valid: false,
                error: 'Código promocional não encontrado'
            });
        }

        const now = new Date();

        // Check if campaign is active
        if (campaign.status !== 'active') {
            return res.status(400).json({
                valid: false,
                error: 'Esta campanha não está activa'
            });
        }

        // Check dates
        if (now < campaign.startDate || now > campaign.endDate) {
            return res.status(400).json({
                valid: false,
                error: 'Campanha fora do período de validade'
            });
        }

        // Check usage limit
        if (campaign.maxTotalUses && campaign.currentUses >= campaign.maxTotalUses) {
            return res.status(400).json({
                valid: false,
                error: 'Limite de utilizações atingido'
            });
        }

        // Check minimum purchase
        if (campaign.minPurchaseAmount && cartTotal < Number(campaign.minPurchaseAmount)) {
            return res.status(400).json({
                valid: false,
                error: `Compra mínima de ${campaign.minPurchaseAmount} MT necessária`
            });
        }

        // Calculate discount
        let discount = 0;
        if (campaign.discountType === 'percentage') {
            discount = cartTotal * (Number(campaign.discountValue) / 100);
        } else if (campaign.discountType === 'fixed') {
            discount = Number(campaign.discountValue);
        }

        // Apply max discount limit
        if (campaign.maxDiscountAmount && discount > Number(campaign.maxDiscountAmount)) {
            discount = Number(campaign.maxDiscountAmount);
        }

        res.json({
            valid: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                discountType: campaign.discountType,
                discountValue: campaign.discountValue
            },
            discount
        });
    } catch (error) {
        console.error('Validate code error:', error);
        res.status(500).json({ error: 'Erro ao validar código' });
    }
});

// Record campaign usage
router.post('/:id/use', authenticate, async (req: AuthRequest, res) => {
    try {
        const { customerId, customerName, orderId, discount } = req.body;

        // Create usage record
        const usage = await prisma.campaignUsage.create({
            data: {
                campaignId: req.params.id,
                customerId,
                customerName,
                orderId,
                discount
            }
        });

        // Increment usage count
        await prisma.campaign.update({
            where: { id: req.params.id },
            data: { currentUses: { increment: 1 } }
        });

        res.status(201).json(usage);
    } catch (error) {
        console.error('Record usage error:', error);
        res.status(500).json({ error: 'Erro ao registrar uso' });
    }
});

// Get campaign statistics
router.get('/:id/stats', authenticate, async (req: AuthRequest, res) => {
    try {
        const campaign = await prisma.campaign.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });

        if (!campaign) {
            return res.status(404).json({ error: 'Campanha não encontrada' });
        }

        const usages = await prisma.campaignUsage.findMany({
            where: { campaignId: req.params.id }
        });

        const totalDiscount = usages.reduce((sum: number, u: { discount: any }) => sum + Number(u.discount), 0);
        const uniqueCustomers = new Set(usages.filter((u: { customerId: string | null }) => u.customerId).map((u: { customerId: string | null }) => u.customerId)).size;

        res.json({
            totalUses: usages.length,
            totalDiscount,
            uniqueCustomers,
            avgDiscount: usages.length > 0 ? totalDiscount / usages.length : 0,
            remainingUses: campaign.maxTotalUses
                ? campaign.maxTotalUses - campaign.currentUses
                : null
        });
    } catch (error) {
        console.error('Get campaign stats error:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

export default router;
