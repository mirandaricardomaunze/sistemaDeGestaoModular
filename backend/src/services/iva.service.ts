import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';

export interface CreateIvaRateInput {
    code: string;
    name: string;
    description?: string;
    rate: number;
    isDefault?: boolean;
    applicableCategories?: string[];
    isActive?: boolean;
    effectiveFrom?: string;
    effectiveTo?: string;
}

export class IvaService {

    // =========================================================================
    // LIST
    // =========================================================================

    async list(companyId: string, params: any = {}) {
        const { page, limit, skip } = getPaginationParams(params);
        const where: any = { companyId };
        if (params.isActive !== undefined) where.isActive = params.isActive === 'true' || params.isActive === true;

        const [total, rates] = await Promise.all([
            prisma.ivaRate.count({ where }),
            prisma.ivaRate.findMany({
                where,
                include: {
                    _count: { select: { products: true, invoiceItems: true } }
                },
                orderBy: [{ isDefault: 'desc' }, { rate: 'asc' }],
                skip,
                take: limit,
            }),
        ]);

        return createPaginatedResponse(rates, page, limit, total);
    }

    async getActive(companyId: string) {
        return prisma.ivaRate.findMany({
            where: { companyId, isActive: true },
            orderBy: [{ isDefault: 'desc' }, { rate: 'asc' }],
        });
    }

    async getById(id: string, companyId: string) {
        const rate = await prisma.ivaRate.findFirst({
            where: { id, companyId },
            include: {
                products: { select: { id: true, name: true, code: true, category: true }, take: 10 },
                _count: { select: { products: true, invoiceItems: true } },
            },
        });
        if (!rate) throw ApiError.notFound('Taxa IVA não encontrada');
        return rate;
    }

    // =========================================================================
    // CREATE
    // =========================================================================

    async create(data: CreateIvaRateInput, companyId: string) {
        const existing = await prisma.ivaRate.findFirst({ where: { companyId, code: data.code.toUpperCase() } });
        if (existing) throw ApiError.badRequest(`Taxa com código "${data.code}" já existe`);

        // If this is marked as default, unset current default
        if (data.isDefault) {
            await prisma.ivaRate.updateMany({ where: { companyId, isDefault: true }, data: { isDefault: false } });
        }

        return prisma.ivaRate.create({
            data: {
                code: data.code.toUpperCase(),
                name: data.name,
                description: data.description,
                rate: data.rate,
                isDefault: data.isDefault || false,
                applicableCategories: data.applicableCategories || [],
                isActive: data.isActive ?? true,
                effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
                effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
                companyId,
            },
        });
    }

    // =========================================================================
    // UPDATE
    // =========================================================================

    async update(id: string, data: Partial<CreateIvaRateInput>, companyId: string) {
        const existing = await prisma.ivaRate.findFirst({ where: { id, companyId } });
        if (!existing) throw ApiError.notFound('Taxa IVA não encontrada');

        if (data.code && data.code.toUpperCase() !== existing.code) {
            const conflict = await prisma.ivaRate.findFirst({ where: { companyId, code: data.code.toUpperCase(), id: { not: id } } });
            if (conflict) throw ApiError.badRequest(`Taxa com código "${data.code}" já existe`);
        }

        if (data.isDefault) {
            await prisma.ivaRate.updateMany({ where: { companyId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
        }

        const updateData: any = {};
        if (data.code !== undefined) updateData.code = data.code.toUpperCase();
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.rate !== undefined) updateData.rate = data.rate;
        if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
        if (data.applicableCategories !== undefined) updateData.applicableCategories = data.applicableCategories;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        if (data.effectiveFrom !== undefined) updateData.effectiveFrom = new Date(data.effectiveFrom);
        if (data.effectiveTo !== undefined) updateData.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;

        return prisma.ivaRate.update({ where: { id }, data: updateData });
    }

    // =========================================================================
    // DELETE
    // =========================================================================

    async delete(id: string, companyId: string) {
        const rate = await prisma.ivaRate.findFirst({ where: { id, companyId } });
        if (!rate) throw ApiError.notFound('Taxa IVA não encontrada');

        const usageCount = await prisma.product.count({ where: { ivaRateId: id } });
        if (usageCount > 0) throw ApiError.badRequest(`Taxa em uso em ${usageCount} produto(s). Desactive em vez de eliminar.`);

        await prisma.ivaRate.delete({ where: { id } });
        return { success: true };
    }

    // =========================================================================
    // DASHBOARD / ANALYTICS
    // =========================================================================

    async getDashboard(companyId: string) {
        const [rates, invoiceStats] = await Promise.all([
            prisma.ivaRate.findMany({ where: { companyId }, include: { _count: { select: { products: true } } } }),
            prisma.invoiceItem.groupBy({
                by: ['ivaRateId'],
                where: { invoice: { companyId } },
                _sum: { ivaAmount: true, total: true },
                _count: { id: true },
            }),
        ]);

        const breakdown = rates.map(rate => {
            const inv = invoiceStats.find(s => s.ivaRateId === rate.id);
            return {
                id: rate.id,
                code: rate.code,
                name: rate.name,
                rate: Number(rate.rate),
                isDefault: rate.isDefault,
                isActive: rate.isActive,
                productCount: rate._count.products,
                ivaCollected: Number(inv?._sum?.ivaAmount || 0),
                taxableBase: Number(inv?._sum?.total || 0),
                invoiceItemCount: inv?._count?.id || 0,
            };
        });

        const totalIvaCollected = breakdown.reduce((s, r) => s + r.ivaCollected, 0);

        return {
            summary: {
                totalRates: rates.length,
                activeRates: rates.filter(r => r.isActive).length,
                totalIvaCollected,
                defaultRate: rates.find(r => r.isDefault) || null,
            },
            breakdown,
        };
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /** Resolve the effective IVA rate for a product (product override → ivaRate → companySettings default) */
    async resolveRateForProduct(productId: string, companyId: string): Promise<number> {
        const product = await prisma.product.findFirst({
            where: { id: productId, companyId },
            include: { ivaRate: true },
        });
        if (!product) return 16;
        if (product.taxRate) return Number(product.taxRate);
        if (product.ivaRate?.rate) return Number(product.ivaRate.rate);

        const defaultRate = await prisma.ivaRate.findFirst({ where: { companyId, isDefault: true, isActive: true } });
        if (defaultRate) return Number(defaultRate.rate);

        const settings = await prisma.companySettings.findUnique({ where: { companyId } });
        return Number(settings?.ivaRate || 16);
    }
}

export const ivaService = new IvaService();
