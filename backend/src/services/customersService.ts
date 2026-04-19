import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';

export class CustomersService {
    async list(params: any, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const {
            search,
            type,
            isActive,
            sortBy = 'name',
            sortOrder = 'asc'
        } = params;

        const where: any = { companyId };

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { code: { contains: String(search), mode: 'insensitive' } },
                { phone: { contains: String(search) } },
                { email: { contains: String(search), mode: 'insensitive' } }
            ];
        }

        if (type) where.type = type;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const [total, customers] = await Promise.all([
            prisma.customer.count({ where }),
            prisma.customer.findMany({
                where,
                orderBy: { [sortBy as string]: sortOrder },
                skip,
                take: limit
            })
        ]);

        return createPaginatedResponse(customers, page, limit, total);
    }

    async getById(id: string, companyId: string) {
        const customer = await prisma.customer.findFirst({
            where: { id, companyId },
            include: {
                sales: { take: 10, orderBy: { createdAt: 'desc' } },
                invoices: { take: 10, orderBy: { createdAt: 'desc' } }
            }
        });

        if (!customer) throw ApiError.notFound('Cliente não encontrado');
        return customer;
    }

    async create(data: any, companyId: string) {
        const customerCode = data.code || `CLI-${Date.now().toString().slice(-6)}`;
        const { code, ...customerData } = data;

        return prisma.customer.create({
            data: {
                ...customerData,
                code: customerCode,
                phone: customerData.phone || '',
                company: { connect: { id: companyId } }
            }
        });
    }

    async update(id: string, data: any, companyId: string) {
        const updateData: any = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== null) updateData[key] = value;
        }

        const result = await prisma.customer.updateMany({
            where: { id, companyId },
            data: updateData
        });

        if (result.count === 0) throw ApiError.notFound('Cliente não encontrado ou acesso negado');

        const updated = await prisma.customer.findUnique({ where: { id } });
        if (!updated) throw ApiError.notFound('Cliente não encontrado');
        return updated;
    }

    async delete(id: string, companyId: string) {
        const result = await prisma.customer.updateMany({
            where: { id, companyId },
            data: { isActive: false }
        });

        if (result.count === 0) throw ApiError.notFound('Cliente não encontrado ou acesso negado');
        return true;
    }

    async getPurchases(id: string, params: any, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const { startDate, endDate } = params;

        const where: any = {
            customerId: id,
            customer: { companyId }
        };

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(String(startDate));
            if (endDate) where.createdAt.lte = new Date(String(endDate));
        }

        const [total, sales] = await Promise.all([
            prisma.sale.count({ where }),
            prisma.sale.findMany({
                where,
                include: { items: { include: { product: true } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            })
        ]);

        return createPaginatedResponse(sales, page, limit, total);
    }

    async updateBalance(id: string, data: { amount: number, operation: string }, companyId: string) {
        const customer = await prisma.customer.findFirst({
            where: { id, companyId }
        });

        if (!customer) throw ApiError.notFound('Cliente não encontrado');

        let newBalance = Number(customer.currentBalance);
        if (data.operation === 'add') newBalance += data.amount;
        else if (data.operation === 'subtract') newBalance -= data.amount;
        else if (data.operation === 'set') newBalance = data.amount;

        const result = await prisma.customer.updateMany({
            where: { id, companyId },
            data: { currentBalance: newBalance }
        });

        if (result.count === 0) throw ApiError.notFound('Cliente não encontrado ou acesso negado');

        const updated = await prisma.customer.findUnique({ where: { id } });
        if (!updated) throw ApiError.notFound('Cliente não encontrado');
        return updated;
    }
}

export const customersService = new CustomersService();
