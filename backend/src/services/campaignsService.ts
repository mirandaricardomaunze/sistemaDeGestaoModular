import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { Prisma, CampaignStatus } from '@prisma/client';

export interface CampaignListParams {
    status?: CampaignStatus;
    active?: string;
}

export interface CampaignUsageData {
    customerId?: string;
    customerName?: string;
    orderId: string;
    discount: number | string;
}

export class CampaignsService {
    async list(params: CampaignListParams, companyId: string) {
        const { status, active } = params;
        const where: any = { companyId };
        if (status) where.status = status;
        if (active === 'true') {
            const now = new Date();
            where.status = 'active';
            where.startDate = { lte: now };
            where.endDate = { gte: now };
        }
        return prisma.campaign.findMany({
            where,
            include: { _count: { select: { usages: true } } },
            orderBy: { createdAt: 'desc' }
        });
    }

    async getById(id: string, companyId: string) {
        const campaign = await prisma.campaign.findFirst({
            where: { id, companyId },
            include: { usages: { take: 50, orderBy: { usedAt: 'desc' } } }
        });
        if (!campaign) throw ApiError.notFound('Campanha não encontrada');
        return campaign;
    }

    async create(data: Prisma.CampaignUncheckedCreateInput, companyId: string) {
        const { code } = data;
        if (code) {
            const existing = await prisma.campaign.findFirst({
                where: { code: code.toUpperCase(), companyId }
            });
            if (existing) throw ApiError.badRequest('Código de campanha já existe para esta empresa');
        }
        return prisma.campaign.create({
            data: { ...data, companyId, startDate: new Date(data.startDate), endDate: new Date(data.endDate), status: 'draft' }
        });
    }

    async update(id: string, data: Prisma.CampaignUncheckedUpdateInput, companyId: string) {
        const updateData = { ...data };
        if (updateData.startDate && typeof updateData.startDate === 'string') updateData.startDate = new Date(updateData.startDate);
        if (updateData.endDate && typeof updateData.endDate === 'string') updateData.endDate = new Date(updateData.endDate);

        const result = await prisma.campaign.updateMany({
            where: { id, companyId },
            data: updateData
        });
        if (result.count === 0) throw ApiError.notFound('Campanha não encontrada');
        return prisma.campaign.findUnique({ where: { id } });
    }

    async setStatus(id: string, status: CampaignStatus, companyId: string) {
        const result = await prisma.campaign.updateMany({
            where: { id, companyId },
            data: { status }
        });
        if (result.count === 0) throw ApiError.notFound('Campanha não encontrada');
        return prisma.campaign.findUnique({ where: { id } });
    }

    async validateCode(code: string, cartTotal: number, companyId: string) {
        const campaign = await prisma.campaign.findFirst({
            where: { code: code.toUpperCase(), companyId }
        });
        if (!campaign) throw ApiError.notFound('Código promocional não encontrado');

        const now = new Date();
        if (campaign.status !== 'active') throw ApiError.badRequest('Esta campanha não está activa');
        if (now < campaign.startDate || now > campaign.endDate) throw ApiError.badRequest('Campanha fora do período de validade');
        if (campaign.maxTotalUses && campaign.currentUses >= campaign.maxTotalUses) throw ApiError.badRequest('Limite de utilizações atingido. Esta campanha já não está disponível.');
        if (campaign.minPurchaseAmount && cartTotal < Number(campaign.minPurchaseAmount)) throw ApiError.badRequest(`Compra mínima de ${campaign.minPurchaseAmount} MT necessária`);

        let discount = campaign.discountType === 'percentage'
            ? cartTotal * (Number(campaign.discountValue) / 100)
            : Number(campaign.discountValue);

        if (campaign.maxDiscountAmount && discount > Number(campaign.maxDiscountAmount)) discount = Number(campaign.maxDiscountAmount);

        return { valid: true, campaign: { id: campaign.id, name: campaign.name, discountType: campaign.discountType, discountValue: campaign.discountValue }, discount };
    }

    async recordUsage(id: string, data: Prisma.CampaignUsageUncheckedCreateInput, companyId: string) {
        const { customerId, customerName, orderId, discount } = data;
        const usage = await prisma.campaignUsage.create({
            data: { campaignId: id, customerId, customerName, orderId, discount }
        });
        const result = await prisma.campaign.updateMany({
            where: { id, companyId },
            data: { currentUses: { increment: 1 } }
        });
        if (result.count === 0) throw ApiError.notFound('Campanha não encontrada');
        return usage;
    }

    async getStats(id: string, companyId: string) {
        const campaign = await prisma.campaign.findFirst({ where: { id, companyId } });
        if (!campaign) throw ApiError.notFound('Campanha não encontrada');

        const usages = await prisma.campaignUsage.findMany({ where: { campaignId: id } });
        const totalDiscount = usages.reduce((sum, u) => sum + Number(u.discount), 0);
        const uniqueCustomers = new Set(usages.filter(u => u.customerId).map(u => u.customerId)).size;

        return {
            totalUses: usages.length,
            totalDiscount,
            uniqueCustomers,
            avgDiscount: usages.length > 0 ? totalDiscount / usages.length : 0,
            remainingUses: campaign.maxTotalUses ? campaign.maxTotalUses - campaign.currentUses : null
        };
    }
}

export const campaignsService = new CampaignsService();
