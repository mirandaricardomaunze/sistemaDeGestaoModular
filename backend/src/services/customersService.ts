import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse, parseFields } from '../utils/pagination';

const CUSTOMER_FIELD_ALLOWLIST = [
    'id', 'code', 'name', 'type', 'document', 'taxId',
    'phone', 'email', 'address', 'city', 'province',
    'creditLimit', 'currentBalance', 'isActive',
    'createdAt', 'updatedAt'
] as const;

type ListQuery = {
    page?: string | number;
    limit?: string | number;
    search?: string;
    type?: string;
    isActive?: string | boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string;
};

type CustomerInput = {
    code?: string;
    companyId?: string;
    name?: string;
    type?: string;
    document?: string | null;
    taxId?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    creditLimit?: number | string | null;
    currentBalance?: number | string | null;
    isActive?: boolean;
    [key: string]: unknown;
};

type PurchasesQuery = {
    page?: string | number;
    limit?: string | number;
    startDate?: string;
    endDate?: string;
};

export class CustomersService {
    async list(params: ListQuery, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const {
            search,
            type,
            isActive,
            sortBy = 'name',
            sortOrder = 'asc'
        } = params;

        const where: Prisma.CustomerWhereInput = { companyId };

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { code: { contains: String(search), mode: 'insensitive' } },
                { phone: { contains: String(search) } },
                { email: { contains: String(search), mode: 'insensitive' } }
            ];
        }

        if (type) where.type = type as Prisma.EnumCustomerTypeFilter['equals'];
        if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

        const projection = parseFields(params.fields, CUSTOMER_FIELD_ALLOWLIST);
        const findArgs: Prisma.CustomerFindManyArgs = {
            where,
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit
        };
        if (projection) findArgs.select = projection satisfies Prisma.CustomerSelect;

        const [total, customers] = await Promise.all([
            prisma.customer.count({ where }),
            prisma.customer.findMany(findArgs)
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

    async create(data: CustomerInput, companyId: string) {
        const customerCode = data.code || `CLI-${Date.now().toString().slice(-6)}`;
        const { code: _code, companyId: _dataCompanyId, ...customerData } = data;

        return prisma.customer.create({
            data: {
                ...(customerData as Prisma.CustomerCreateInput),
                code: customerCode,
                phone: customerData.phone || '',
                company: { connect: { id: companyId } }
            }
        });
    }

    async update(id: string, data: CustomerInput, companyId: string) {
        const updateData: Prisma.CustomerUpdateInput = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== null) (updateData as Record<string, unknown>)[key] = value;
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

    async getPurchases(id: string, params: PurchasesQuery, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const { startDate, endDate } = params;

        const where: Prisma.SaleWhereInput = {
            customerId: id,
            customer: { companyId }
        };

        if (startDate || endDate) {
            const dateFilter: Prisma.DateTimeFilter = {};
            if (startDate) dateFilter.gte = new Date(String(startDate));
            if (endDate) dateFilter.lte = new Date(String(endDate));
            where.createdAt = dateFilter;
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
