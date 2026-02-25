import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';
import { pdfService } from './pdfService';

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

        return await prisma.$transaction(async (tx) => {
            // 1. Verify and reserve stock for each item
            for (const item of data.items) {
                const product = await tx.product.findFirst({
                    where: { id: item.productId, companyId }
                });

                if (!product) {
                    throw ApiError.notFound(`Produto não encontrado: ${item.productName || item.productId}`);
                }

                const availableStock = product.currentStock - product.reservedStock;
                if (availableStock < item.quantity) {
                    throw ApiError.badRequest(`Estoque insuficiente para o produto: ${product.name}. Disponível: ${availableStock}, Solicitado: ${item.quantity}`);
                }

                // Reserve the stock
                await tx.product.update({
                    where: { id: product.id },
                    data: { reservedStock: { increment: item.quantity } }
                });
            }

            // 2. Create the order
            const order = await tx.customerOrder.create({
                data: {
                    ...data,
                    orderNumber,
                    companyId,
                    items: {
                        create: data.items.map((item: any) => ({
                            productId: item.productId,
                            productName: item.productName || '',
                            quantity: item.quantity,
                            price: item.unitPrice,
                            total: item.quantity * item.unitPrice
                        }))
                    },
                    transitions: {
                        create: { status: 'created', responsibleName: 'Sistema' }
                    }
                } as any,
                include: { items: true, transitions: true }
            });

            return order;
        });
    }

    async updateStatus(id: string, data: any, companyId: string) {
        const existing = await prisma.customerOrder.findFirst({
            where: { id, companyId },
            include: { items: true }
        });
        if (!existing) throw ApiError.notFound('Encomenda não encontrada');

        const { status, responsibleName, notes } = data;

        // Block multiple cancellations or completions
        if (existing.status === 'cancelled' || existing.status === 'completed' || existing.status === 'delivered') {
            throw ApiError.badRequest(`Esta encomenda já se encontra no estado: ${existing.status}`);
        }

        return await prisma.$transaction(async (tx) => {
            // If the order is cancelled, release the reserved stock
            let cancellationDocUrl = null;
            if (status === 'cancelled') {
                let totalCanceled = 0;
                const itemsToReport = [];

                for (const item of existing.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        // Ensure we don't go below 0 for reserved stock
                        data: { reservedStock: { decrement: item.quantity } }
                    });

                    totalCanceled += item.total.toNumber ? item.total.toNumber() : Number(item.total);
                    itemsToReport.push({
                        productName: item.productName || 'N/A',
                        quantity: item.quantity,
                        total: item.total.toNumber ? item.total.toNumber() : Number(item.total)
                    });
                }

                // Generate standard PDF cancellation document here via pdfService
                const companyInfo = { name: "A Minha Empresa", address: "Localização", nuit: "123456789" }; // this should ideally come from tenant config
                const reportData = {
                    orderNumber: existing.orderNumber,
                    customerName: 'Cliente Associado',
                    responsibleName: responsibleName || 'Sistema',
                    notes: notes,
                    items: itemsToReport,
                    total: totalCanceled
                };

                try {
                    cancellationDocUrl = await pdfService.generateReport(reportData, 'order_cancellation', companyInfo);
                } catch (err) {
                    console.error("Failed to generate cancellation PDF", err);
                }
            }

            // If the order is completed/delivered, deduct from current stock, and release reserved stock
            if (status === 'completed' || status === 'delivered') {
                for (const item of existing.items) {
                    const product = await tx.product.findFirst({ where: { id: item.productId } });
                    if (product) {
                        const newReserved = Math.max(0, product.reservedStock - item.quantity);
                        const newStock = Math.max(0, product.currentStock - item.quantity);

                        await tx.product.update({
                            where: { id: item.productId },
                            data: {
                                reservedStock: newReserved,
                                currentStock: newStock
                            }
                        });

                        // Record stock movement for the sale consummation
                        await tx.stockMovement.create({
                            data: {
                                productId: item.productId,
                                warehouseId: null, // Depending on system logic, maybe order specifies warehouse
                                movementType: 'sale',
                                quantity: -item.quantity,
                                balanceBefore: product.currentStock,
                                balanceAfter: newStock,
                                reason: `Venda via Encomenda ${existing.orderNumber}`,
                                performedBy: responsibleName || 'Sistema',
                                companyId: companyId,
                                originModule: 'inventory',
                                reference: existing.orderNumber
                            }
                        });
                    }
                }
            }

            const updateData: any = {
                status: status as any,
                transitions: {
                    create: { status: status as any, responsibleName: responsibleName || 'Sistema', notes }
                }
            };

            if (cancellationDocUrl) {
                updateData.cancellationDocUrl = cancellationDocUrl;
            }

            await tx.customerOrder.update({
                where: { id },
                data: updateData
            });

            return this.getById(id, companyId);
        });
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
