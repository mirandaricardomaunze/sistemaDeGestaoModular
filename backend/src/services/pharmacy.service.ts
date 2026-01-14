import { prisma } from '../lib/prisma';

export class PharmacyService {
    static async getMedications(companyId: string, query: any) {
        const { page = 1, limit = 20, search, requiresPrescription, isControlled, lowStock, expiringDays } = query;

        const where: any = {
            product: {
                companyId
            }
        };

        if (search) {
            where.product = {
                companyId,
                OR: [
                    { name: { contains: search as string, mode: 'insensitive' } },
                    { code: { contains: search as string, mode: 'insensitive' } },
                    { barcode: { contains: search as string } }
                ]
            };
        }

        if (requiresPrescription === 'true') where.requiresPrescription = true;
        if (isControlled === 'true') where.isControlled = true;

        // Since we need to calculate totalStock and lowStock status which depend on batches,
        // and these might filter the results (lowStock filter), we have two options:
        // 1. Fetch all, filter/process in memory, then paginate (not ideal for large datasets but simpler for complex filters).
        // 2. Do sophisticated raw queries or multiple steps.

        // Given the current implementation processes in-memory, let's keep it but at least acknowledge the limit.
        // For a more robust solution, we'd need to move lowStock/totalStock into the DB or use more complex Prisma filters.

        const medications = await prisma.medication.findMany({
            where,
            include: {
                product: true,
                batches: {
                    where: { status: { not: 'depleted' } },
                    orderBy: { expiryDate: 'asc' }
                }
            }
        });

        let result = medications.map(med => {
            const totalStock = med.batches.reduce((sum, b) => sum + b.quantityAvailable, 0);
            const nearestExpiry = med.batches[0]?.expiryDate || null;

            if (!med.product) return null;

            const isLowStock = totalStock <= (med.product.minStock || 5);
            const daysToExpiry = nearestExpiry
                ? Math.ceil((new Date(nearestExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;

            return {
                ...med,
                totalStock,
                nearestExpiry,
                isLowStock,
                daysToExpiry,
                alertLevel: daysToExpiry && daysToExpiry <= 30 ? 'critical'
                    : daysToExpiry && daysToExpiry <= 90 ? 'warning' : 'normal'
            };
        }).filter(m => m !== null)
            .sort((a: any, b: any) => a.product.name.localeCompare(b.product.name));

        const total = result.length;
        const metrics = {
            totalMedications: total,
            lowStockItems: result.filter((m: any) => m.isLowStock).length,
            expiringSoon: result.filter((m: any) => m.daysToExpiry && m.daysToExpiry <= 90).length,
            controlledItems: result.filter((m: any) => m.isControlled).length
        };

        const skip = (Number(page) - 1) * Number(limit);
        const paginatedData = result.slice(skip, skip + Number(limit));

        return {
            data: paginatedData,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
                hasMore: skip + Number(limit) < total
            },
            metrics
        };
    }

    static async createMedication(companyId: string, data: any) {
        const { productId, ...rest } = data;

        const product = await prisma.product.findFirst({
            where: { id: productId, companyId }
        });
        if (!product) {
            throw new Error('Produto não encontrado ou não pertence a esta empresa');
        }

        const existing = await prisma.medication.findUnique({ where: { productId } });
        if (existing) {
            throw new Error('Este produto já está cadastrado como medicamento');
        }

        return await prisma.medication.create({
            data: {
                productId,
                ...rest,
                requiresPrescription: rest.requiresPrescription || false,
                isControlled: rest.isControlled || false,
                storageTemp: rest.storageTemp || 'ambiente'
            },
            include: { product: true }
        });
    }

    static async updateMedication(id: string, companyId: string, data: any) {
        // Verify medication belongs to this company
        const medication = await prisma.medication.findFirst({
            where: {
                id,
                product: { companyId }
            }
        });

        if (!medication) {
            throw new Error('Medicamento não encontrado ou não pertence a esta empresa');
        }

        return await prisma.medication.update({
            where: { id },
            data,
            include: { product: true }
        });
    }

    static async deleteMedication(id: string, companyId: string) {
        const med = await prisma.medication.findFirst({
            where: {
                id,
                product: { companyId }
            },
            include: {
                batches: {
                    where: { quantityAvailable: { gt: 0 } }
                }
            }
        });

        if (!med) throw new Error('Medicamento não encontrado ou não pertence a esta empresa');
        if (med.batches.length > 0) {
            throw new Error('Não é possível eliminar um medicamento com stock disponível');
        }

        await prisma.medicationBatch.deleteMany({
            where: { medicationId: id }
        });

        return await prisma.medication.delete({
            where: { id }
        });
    }

    static async getBatches(companyId: string, query: any) {
        const { status, expiringDays, medicationId } = query;

        const where: any = {
            medication: {
                product: { companyId }
            }
        };
        if (status) where.status = status;
        if (medicationId) where.medicationId = medicationId;

        let batches = await prisma.medicationBatch.findMany({
            where,
            include: {
                medication: {
                    include: { product: true }
                }
            },
            orderBy: { expiryDate: 'asc' }
        });

        if (expiringDays) {
            const days = parseInt(expiringDays as string);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() + days);
            batches = batches.filter(b => new Date(b.expiryDate) <= cutoffDate);
        }

        return batches;
    }

    static async createBatch(companyId: string, data: any, performedBy: string) {
        const { medicationId, quantity, expiryDate, ...rest } = data;

        const medication = await prisma.medication.findFirst({
            where: {
                id: medicationId,
                product: { companyId }
            },
            include: { product: true }
        });
        if (!medication) throw new Error('Medicamento não encontrado');

        const batch = await prisma.medicationBatch.create({
            data: {
                medicationId,
                ...rest,
                quantity: parseInt(quantity),
                quantityAvailable: parseInt(quantity),
                expiryDate: new Date(expiryDate),
                sellingPrice: rest.sellingPrice || medication.product.price,
            },
            include: { medication: { include: { product: true } } }
        });

        await prisma.product.update({
            where: { id: medication.productId },
            data: { currentStock: { increment: parseInt(quantity) } }
        });

        await prisma.stockMovement.create({
            data: {
                batchId: batch.id,
                movementType: 'purchase',
                quantity: parseInt(quantity),
                companyId,
                balanceBefore: 0,
                balanceAfter: parseInt(quantity),
                reference: rest.invoiceNumber,
                reason: 'Entrada de lote',
                performedBy
            }
        });

        return batch;
    }

    static async getSales(companyId: string, query: any) {
        const { page = 1, limit = 20, startDate, endDate, status, customerId } = query;

        const where: any = { companyId };
        if (status) where.status = status;
        if (customerId) where.customerId = customerId;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) {
                const end = new Date(endDate as string);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [sales, total] = await Promise.all([
            prisma.pharmacySale.findMany({
                where,
                include: {
                    customer: true,
                    prescription: true,
                    items: {
                        include: { batch: { include: { medication: { include: { product: true } } } } }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit)
            }),
            prisma.pharmacySale.count({ where })
        ]);

        return {
            data: sales,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        };
    }

    static async createSale(companyId: string, data: any, performedBy: string) {
        const { items, customerId, customerName, prescriptionId, discount, paymentMethod, paymentDetails, notes } = data;

        if (!items || items.length === 0) throw new Error('A venda deve ter pelo menos um item');

        const lastSale = await prisma.pharmacySale.findFirst({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            select: { saleNumber: true }
        });
        const nextNumber = lastSale ? parseInt(lastSale.saleNumber.replace('PH-', '')) + 1 : 1;
        const saleNumber = `PH-${String(nextNumber).padStart(6, '0')}`;

        let subtotal = 0;
        const saleItems = [];

        for (const item of items) {
            const batch = await prisma.medicationBatch.findFirst({
                where: {
                    id: item.batchId,
                    medication: {
                        product: { companyId }
                    }
                },
                include: { medication: { include: { product: true } } }
            });

            if (!batch) throw new Error(`Lote não encontrado: ${item.batchId}`);
            if (batch.quantityAvailable < item.quantity) {
                throw new Error(`Stock insuficiente para ${batch.medication.product.name}`);
            }

            const itemTotal = Number(batch.sellingPrice) * item.quantity - (item.discount || 0);
            subtotal += itemTotal;

            saleItems.push({
                batchId: item.batchId,
                productName: batch.medication.product.name,
                quantity: item.quantity,
                unitPrice: batch.sellingPrice,
                discount: item.discount || 0,
                total: itemTotal,
                posologyLabel: item.posologyLabel
            });

            await prisma.medicationBatch.update({
                where: { id: item.batchId },
                data: {
                    quantityAvailable: { decrement: item.quantity },
                    status: batch.quantityAvailable - item.quantity <= 0 ? 'depleted' : batch.status
                }
            });

            await prisma.product.update({
                where: { id: batch.medication.productId },
                data: { currentStock: { decrement: item.quantity } }
            });

            await prisma.stockMovement.create({
                data: {
                    batchId: item.batchId,
                    movementType: 'sale',
                    quantity: item.quantity,
                    companyId,
                    balanceBefore: batch.quantityAvailable,
                    balanceAfter: batch.quantityAvailable - item.quantity,
                    reference: saleNumber,
                    performedBy
                }
            });
        }

        const total = subtotal - (discount || 0);

        const sale = await prisma.pharmacySale.create({
            data: {
                saleNumber, companyId, customerId,
                customerName: customerName || 'Cliente Balcão',
                prescriptionId, subtotal, discount: discount || 0,
                total, paymentMethod: paymentMethod || 'cash',
                paymentDetails, soldBy: performedBy, notes,
                items: { create: saleItems }
            },
            include: {
                customer: true,
                items: { include: { batch: { include: { medication: { include: { product: true } } } } } }
            }
        });

        if (customerId) {
            const pointsEarned = Math.floor(Number(total) / 100);
            await prisma.customer.update({
                where: { id: customerId },
                data: {
                    loyaltyPoints: { increment: pointsEarned },
                    totalPurchases: { increment: total }
                }
            });
        }

        return sale;
    }
}
