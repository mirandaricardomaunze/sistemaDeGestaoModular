import { Prisma, TargetType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { ResultHandler } from '../../utils/result';
import { round2, invalidateCommercialCache } from './shared';

interface TargetFilters {
    employeeId?: string;
    warehouseId?: string;
}

export class SalesTargetService {
    async listTargets(companyId: string, filters: TargetFilters = {}) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada.');

        const where: Prisma.SalesTargetWhereInput = { companyId, isActive: true };
        if (filters.employeeId) where.employeeId = filters.employeeId;
        if (filters.warehouseId) where.warehouseId = filters.warehouseId;

        const targets = await prisma.salesTarget.findMany({
            where,
            include: {
                employee: { select: { id: true, name: true, userId: true } },
                warehouse: { select: { id: true, name: true, code: true } }
            },
            orderBy: { startDate: 'desc' }
        });

        const targetsWithProgress = await Promise.all(targets.map(async (target) => {
            const saleWhere: Prisma.SaleWhereInput = {
                companyId,
                createdAt: { gte: target.startDate, lte: target.endDate },
                voidStatus: { not: 'voided' }
            };
            if (target.employee?.userId) saleWhere.userId = target.employee.userId;
            if (target.warehouseId) saleWhere.warehouseId = target.warehouseId;

            const actualSales = await prisma.sale.aggregate({
                where: saleWhere,
                _sum: { total: true },
                _count: { _all: true }
            });

            const current = Number(actualSales._sum.total || 0);
            const targetValue = Number(target.value);
            const progress = targetValue > 0 ? round2((current / targetValue) * 100) : 0;
            const remaining = round2(Math.max(0, targetValue - current));

            return {
                ...target,
                current,
                progress,
                remaining,
                salesCount: actualSales._count._all
            };
        }));

        return ResultHandler.success(targetsWithProgress);
    }

    async summarize(companyId: string) {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada.');

        const targets = await prisma.salesTarget.findMany({
            where: { companyId, isActive: true },
            include: {
                employee: { select: { id: true, name: true, userId: true } },
                warehouse: { select: { id: true, name: true, code: true } }
            }
        });

        const enriched = await Promise.all(targets.map(async (target) => {
            const saleWhere: Prisma.SaleWhereInput = {
                companyId,
                createdAt: { gte: target.startDate, lte: target.endDate },
                voidStatus: { not: 'voided' }
            };
            if (target.employee?.userId) saleWhere.userId = target.employee.userId;
            if (target.warehouseId) saleWhere.warehouseId = target.warehouseId;

            const agg = await prisma.sale.aggregate({
                where: saleWhere,
                _sum: { total: true }
            });

            return {
                id: target.id,
                type: target.type,
                warehouseId: target.warehouseId,
                warehouseName: target.warehouse?.name ?? null,
                employeeId: target.employeeId,
                employeeName: target.employee?.name ?? null,
                value: Number(target.value),
                current: Number(agg._sum.total || 0)
            };
        }));

        const byType = (['DAILY', 'WEEKLY', 'MONTHLY'] as TargetType[]).map((type) => {
            const items = enriched.filter((t) => t.type === type);
            const target = items.reduce((acc, t) => acc + t.value, 0);
            const actual = items.reduce((acc, t) => acc + t.current, 0);
            return {
                type,
                target: round2(target),
                actual: round2(actual),
                progress: target > 0 ? round2((actual / target) * 100) : 0,
                count: items.length
            };
        });

        const byWarehouseMap = new Map<string, {
            warehouseId: string | null;
            warehouseName: string;
            target: number;
            actual: number;
            count: number;
        }>();
        for (const t of enriched) {
            const key = t.warehouseId ?? '__global__';
            const existing = byWarehouseMap.get(key);
            if (existing) {
                existing.target += t.value;
                existing.actual += t.current;
                existing.count += 1;
            } else {
                byWarehouseMap.set(key, {
                    warehouseId: t.warehouseId,
                    warehouseName: t.warehouseName ?? 'Global (sem filial)',
                    target: t.value,
                    actual: t.current,
                    count: 1
                });
            }
        }
        const byWarehouse = Array.from(byWarehouseMap.values()).map((w) => ({
            ...w,
            target: round2(w.target),
            actual: round2(w.actual),
            progress: w.target > 0 ? round2((w.actual / w.target) * 100) : 0
        }));

        const byOperatorMap = new Map<string, {
            employeeId: string | null;
            employeeName: string;
            target: number;
            actual: number;
            count: number;
        }>();
        for (const t of enriched) {
            const key = t.employeeId ?? '__team__';
            const existing = byOperatorMap.get(key);
            if (existing) {
                existing.target += t.value;
                existing.actual += t.current;
                existing.count += 1;
            } else {
                byOperatorMap.set(key, {
                    employeeId: t.employeeId,
                    employeeName: t.employeeName ?? 'Equipa Global',
                    target: t.value,
                    actual: t.current,
                    count: 1
                });
            }
        }
        const byOperator = Array.from(byOperatorMap.values()).map((o) => ({
            ...o,
            target: round2(o.target),
            actual: round2(o.actual),
            progress: o.target > 0 ? round2((o.actual / o.target) * 100) : 0
        }));

        const totalTarget = enriched.reduce((acc, t) => acc + t.value, 0);
        const totalActual = enriched.reduce((acc, t) => acc + t.current, 0);

        return ResultHandler.success({
            totals: {
                target: round2(totalTarget),
                actual: round2(totalActual),
                progress: totalTarget > 0 ? round2((totalActual / totalTarget) * 100) : 0,
                count: enriched.length
            },
            byType,
            byWarehouse,
            byOperator
        });
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
