import { Prisma, PrismaClient } from '@prisma/client';
import { ApiError } from '../middleware/error.middleware';

export class CRMService {
    constructor(private prisma: PrismaClient) { }

    async getOpportunities(companyId: string, filters: { search?: string; stageId?: string; customerId?: string; limit?: number } = {}) {
        const where: Prisma.OpportunityWhereInput = { companyId };

        if (filters.stageId) where.stageId = filters.stageId;
        if (filters.customerId) where.customerId = filters.customerId;

        if (filters.search && typeof filters.search === 'string') {
            const term = filters.search.trim();
            if (term) {
                where.OR = [
                    { title: { contains: term, mode: 'insensitive' } },
                    { customer: { name: { contains: term, mode: 'insensitive' } } }
                ];
            }
        }

        return this.prisma.opportunity.findMany({
            where,
            include: { customer: true, stage: true },
            orderBy: { updatedAt: 'desc' },
            take: filters.limit && filters.limit > 0 && filters.limit <= 100 ? filters.limit : undefined
        });
    }

    async updateOpportunityStage(companyId: string, opportunityId: string, stageId: string) {
        return this.prisma.opportunity.update({
            where: { id: opportunityId, companyId },
            data: { stageId }
        });
    }

    async getCampaigns(companyId: string) {
        return this.prisma.campaign.findMany({
            where: { companyId },
            include: { _count: { select: { usages: true } } },
            orderBy: { createdAt: 'desc' }
        });
    }
}

export const crmService = new CRMService(new PrismaClient());
