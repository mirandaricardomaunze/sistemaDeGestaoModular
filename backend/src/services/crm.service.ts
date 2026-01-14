import { PrismaClient } from '@prisma/client';

export class CRMService {
    constructor(private prisma: PrismaClient) { }

    async getOpportunities(companyId: string) {
        return this.prisma.opportunity.findMany({
            where: { companyId },
            include: { customer: true, stage: true },
            orderBy: { updatedAt: 'desc' }
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
