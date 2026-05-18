import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { ResultHandler } from '../../utils/result';
import { round2, invalidateCommercialCache } from './shared';

export class SalesTargetService {
    async listTargets(companyId: string, employeeId?: string) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada.');

        const where: Prisma.SalesTargetWhereInput = { companyId, isActive: true };
        if (employeeId) where.employeeId = employeeId;

        const targets = await prisma.salesTarget.findMany({
            where,
            include: { employee: { select: { name: true } } },
            orderBy: { startDate: 'desc' }
        });

        // For each target, calculate current progress
        const targetsWithProgress = await Promise.all(targets.map(async (target) => {
            // Find the user associated with the employee to filter sales correctly
            let userId: string | undefined;
            if (target.employeeId) {
                const emp = await prisma.employee.findUnique({
                    where: { id: target.employeeId },
                    select: { userId: true }
                });
                userId = emp?.userId || undefined;
            }

            const actualSales = await prisma.sale.aggregate({
                where: {
                    companyId,
                    userId: userId,
                    createdAt: { gte: target.startDate, lte: target.endDate },
                    // Assuming sales model has a status field, if not, remove this
                    // status: { not: 'cancelled' } 
                },
                _sum: { total: true }
            });

            const current = Number(actualSales._sum.total || 0);
            const targetValue = Number(target.value);
            const progress = targetValue > 0 ? round2((current / targetValue) * 100) : 0;

            return {
                ...target,
                current,
                progress
            };
        }));

        return ResultHandler.success(targetsWithProgress);
    }

    async createTarget(companyId: string, data: Prisma.SalesTargetUncheckedCreateInput) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada.');

        const target = await prisma.salesTarget.create({
            data: {
                ...data,
                companyId
            }
        });
        invalidateCommercialCache(companyId);
        return ResultHandler.success(target);
    }

    async updateTarget(id: string, companyId: string, data: Prisma.SalesTargetUpdateInput) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada.');

        const target = await prisma.salesTarget.update({
            where: { id, companyId },
            data
        });
        invalidateCommercialCache(companyId);
        return ResultHandler.success(target);
    }

    async deleteTarget(id: string, companyId: string) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada.');

        await prisma.salesTarget.delete({
            where: { id, companyId }
        });
        invalidateCommercialCache(companyId);
        return ResultHandler.success({ message: 'Meta removida com sucesso' });
    }
}

export const salesTargetService = new SalesTargetService();
