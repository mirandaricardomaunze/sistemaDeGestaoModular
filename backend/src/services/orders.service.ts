import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';

export class OrdersService {
    async list(params: any, companyId: string) {
        const { status, priority, page = '1', limit = '20', sortBy = 'createdAt', sortOrder = 'desc' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { companyId };
        if (status && status !== 'all') where.status = status;
        if (priority && priority !== 'all') where.priority = priority;

        const [total, orders] = await Promise.all([
            prisma.customerOrder.count({ where }),
            prisma.customerOrder.findMany({
                where,
                include: { items: true, transitions: { orderBy: { timestamp: 'asc' } } },
                orderBy: { [sortBy as string]: sortOrder },
                skip,
                take: limitNum
            })
        ]);

        return {
            data: orders,
            pagination: buildPaginationMeta(pageNum, limitNum, total)
        };
    }

    async getById(id: string, companyId: string) {
        const order = await prisma.customerOrder.findFirst({
            where: { id, companyId },
            include: { items: true, transitions: { orderBy: { timestamp: 'asc' } } }
        });
        if (!order) throw ApiError.notFound('Encomenda não encontrada');
        return order;
    }

    async create(data: any, companyId: string) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const count = await prisma.customerOrder.count({ where: { companyId } });
        const orderNumber = `ENC-${dateStr}-${String(count + 1).padStart(4, '0')}`;

        return prisma.customerOrder.create({
            data: {
                ...data,
                orderNumber,
                companyId,
                items: {
                    create: data.items.map((item: any) => ({
                        productId: item.productId, productName: item.productName || '',
                        quantity: item.quantity, price: item.unitPrice,
                        total: item.quantity * item.unitPrice
                    }))
                },
                transitions: {
                    create: { status: 'created', responsibleName: 'Sistema' }
                }
            } as any,
            include: { items: true, transitions: true }
        });
    }

    async updateStatus(id: string, data: any, companyId: string) {
        const existing = await prisma.customerOrder.findFirst({
            where: { id, companyId }
        });
        if (!existing) throw ApiError.notFound('Encomenda não encontrada');

        const { status, responsibleName, notes } = data;

        await prisma.customerOrder.update({
            where: { id },
            data: {
                status: status as any,
                transitions: {
                    create: { status: status as any, responsibleName: responsibleName || 'Sistema', notes }
                }
            }
        });

        return this.getById(id, companyId);
    }

    async update(id: string, data: any, companyId: string) {
        const existing = await prisma.customerOrder.findFirst({
            where: { id, companyId }
        });
        if (!existing) throw ApiError.notFound('Encomenda não encontrada');

        const { deliveryDate, ...updateData } = data;

        await prisma.customerOrder.update({
            where: { id },
            data: {
                ...updateData,
                deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined
            }
        });

        return this.getById(id, companyId);
    }

    async delete(id: string, companyId: string) {
        const result = await prisma.customerOrder.deleteMany({
            where: { id, companyId }
        });
        if (result.count === 0) throw ApiError.notFound('Encomenda não encontrada');
        return true;
    }
}

export const ordersService = new OrdersService();
