import { prisma } from '../lib/prisma';

export interface PharmacyQuery {
    page?: number;
    limit?: number;
    search?: string;
    requiresPrescription?: string;
    isControlled?: string;
    lowStock?: string;
    expiringDays?: string;
    status?: string;
    medicationId?: string;
    startDate?: string;
    endDate?: string;
    customerId?: string;
    isActive?: string;
    movementType?: string;
    batchId?: string;
}


export class PharmacyService {
    static async getMedications(companyId: string, query: PharmacyQuery) {
        const { page = 1, limit = 20, search, requiresPrescription, isControlled, lowStock } = query;

        const where: any = {
            product: {
                companyId,
                origin_module: 'pharmacy'
            }
        };

        if (search) {
            where.product.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { code: { contains: search as string, mode: 'insensitive' } },
                { barcode: { contains: search as string } }
            ];
        }

        if (requiresPrescription === 'true') where.requiresPrescription = true;
        if (isControlled === 'true') where.isControlled = true;

        if (lowStock === 'true') {
            where.product.currentStock = {
                lte: prisma.product.fields.minStock // This might not work directly in findMany, let's use a default or dynamic check
            };
        }

        // Optimized pagination at DB level
        const [medications, total] = await Promise.all([
            prisma.medication.findMany({
                where,
                include: {
                    product: true,
                    batches: {
                        where: { status: { not: 'depleted' } },
                        orderBy: { expiryDate: 'asc' }
                    }
                },
                orderBy: {
                    product: { name: 'asc' }
                },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit)
            }),
            prisma.medication.count({ where })
        ]);

        const data = medications.map(med => {
            const totalStock = med.product.currentStock;
            const nearestExpiry = med.batches[0]?.expiryDate || null;
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
        });

        // Calculate metrics using aggregations for performance
        const [lowStockCount, expiringSoonCount, controlledCount] = await Promise.all([
            prisma.medication.count({
                where: {
                    product: {
                        companyId,
                        origin_module: 'pharmacy',
                        currentStock: { lte: 5 } // simplified for metric, ideally dynamic
                    }
                }
            }),
            prisma.medicationBatch.count({
                where: {
                    companyId,
                    status: { not: 'depleted' },
                    expiryDate: {
                        lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                    }
                }
            }),
            prisma.medication.count({
                where: {
                    product: { companyId },
                    isControlled: true
                }
            })
        ]);

        return {
            data,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
                hasMore: (Number(page) * Number(limit)) < total
            },
            metrics: {
                totalMedications: total,
                lowStockItems: lowStockCount,
                expiringSoon: expiringSoonCount,
                controlledItems: controlledCount
            }
        };
    }

    static async createMedication(companyId: string, data: Record<string, any>) {
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

        const medication = await prisma.medication.create({
            data: {
                productId,
                ...rest,
                requiresPrescription: rest.requiresPrescription || false,
                isControlled: rest.isControlled || false,
                storageTemp: rest.storageTemp || 'ambiente'
            },
            include: { product: true }
        });

        // Tag product as pharmacy
        await prisma.product.update({
            where: { id: productId },
            data: { origin_module: 'pharmacy' }
        });

        return medication;
    }

    static async updateMedication(id: string, companyId: string, data: Record<string, any>) {
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

    static async getBatches(companyId: string, query: PharmacyQuery) {
        const { status, expiringDays, medicationId } = query;

        const where: Record<string, any> = {
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

    static async createBatch(companyId: string, data: Record<string, any>, performedBy: string) {
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

    static async getSales(companyId: string, query: PharmacyQuery) {
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

    static async createSale(companyId: string, data: Record<string, any>, performedBy: string) {
        const { items, customerId, customerName, partnerId, prescriptionId, discount, paymentMethod, paymentDetails, notes } = data;

        if (!items || items.length === 0) throw new Error('A venda deve ter pelo menos um item');

        return await prisma.$transaction(async (tx) => {
            // Get last sale number within transaction for safety
            const lastSale = await tx.pharmacySale.findFirst({
                where: { companyId },
                orderBy: { createdAt: 'desc' },
                select: { saleNumber: true }
            });
            const nextNumber = lastSale ? parseInt(lastSale.saleNumber.replace('PH-', '')) + 1 : 1;
            const saleNumber = `PH-${String(nextNumber).padStart(6, '0')}`;

            let subtotal = 0;
            const saleItems = [];

            for (const item of items) {
                const batch = await tx.medicationBatch.findFirst({
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

                // Update batch stock
                await tx.medicationBatch.update({
                    where: { id: item.batchId },
                    data: {
                        quantityAvailable: { decrement: item.quantity },
                        status: batch.quantityAvailable - item.quantity <= 0 ? 'depleted' : batch.status
                    }
                });

                // Update product aggregate stock
                await tx.product.update({
                    where: { id: batch.medication.productId },
                    data: { currentStock: { decrement: item.quantity } }
                });

                // Record stock movement
                await tx.stockMovement.create({
                    data: {
                        productId: batch.medication.productId,
                        batchId: item.batchId,
                        movementType: 'sale',
                        quantity: item.quantity,
                        companyId,
                        balanceBefore: batch.quantityAvailable,
                        balanceAfter: batch.quantityAvailable - item.quantity,
                        reference: saleNumber,
                        performedBy,
                        originModule: 'PHARMACY'
                    }
                });
            }

            const total = subtotal - (discount || 0);

            const sale = await tx.pharmacySale.create({
                data: {
                    saleNumber, companyId, customerId, partnerId,
                    customerName: customerName || 'Cliente Balcão',
                    prescriptionId, subtotal, discount: discount || 0,
                    total, paymentMethod: paymentMethod || 'cash',
                    paymentDetails, soldBy: performedBy, notes,
                    items: { create: saleItems }
                },
                include: {
                    customer: true,
                    partner: true,
                    items: { include: { batch: { include: { medication: { include: { product: true } } } } } }
                }
            });

            // 💰 Global Transaction Record
            await tx.transaction.create({
                data: {
                    type: 'income',
                    category: 'Pharmacy Sales',
                    description: `Venda Farmácia: ${saleNumber}`,
                    amount: total,
                    date: new Date(),
                    status: 'completed',
                    paymentMethod: paymentMethod || 'cash',
                    reference: saleNumber,
                    module: 'pharmacy',
                    companyId
                }
            });

            if (customerId) {
                const pointsEarned = Math.floor(Number(total) / 100);
                await tx.customer.update({
                    where: { id: customerId },
                    data: {
                        loyaltyPoints: { increment: pointsEarned },
                        totalPurchases: { increment: total }
                    }
                });
            }

            return sale;
        });
    }

    static async getPrescriptions(companyId: string, query: PharmacyQuery) {
        const { page = 1, limit = 20, status, search } = query;

        const where: Record<string, any> = { companyId };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { patientName: { contains: search as string, mode: 'insensitive' } },
                { prescriberName: { contains: search as string, mode: 'insensitive' } },
                { prescriptionNo: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        const [prescriptions, total] = await Promise.all([
            prisma.prescription.findMany({
                where,
                include: {
                    items: true,
                    sales: { select: { saleNumber: true, createdAt: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit)
            }),
            prisma.prescription.count({ where })
        ]);

        return {
            data: prescriptions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        };
    }

    static async createPrescription(companyId: string, data: Record<string, any>) {
        const { items, ...rest } = data;

        // Generate prescription number
        const lastPrescription = await prisma.prescription.findFirst({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            select: { prescriptionNo: true }
        });
        const nextNumber = lastPrescription ? parseInt(lastPrescription.prescriptionNo.replace('PRE-', '')) + 1 : 1;
        const prescriptionNo = `PRE-${String(nextNumber).padStart(6, '0')}`;

        const prescription = await prisma.prescription.create({
            data: {
                ...rest,
                prescriptionNo,
                companyId,
                prescriptionDate: new Date(rest.prescriptionDate),
                patientBirthDate: rest.patientBirthDate ? new Date(rest.patientBirthDate) : undefined,
                validUntil: rest.validUntil ? new Date(rest.validUntil) : undefined,
                items: items ? {
                    create: items.map((item: {
                        medicationName: string;
                        medicationId?: string;
                        dosage?: string;
                        quantity: number;
                        posology?: string;
                        duration?: string;
                        notes?: string;
                    }) => ({
                        medicationName: item.medicationName,
                        medicationId: item.medicationId,
                        dosage: item.dosage,
                        quantity: item.quantity,
                        posology: item.posology,
                        duration: item.duration,
                        notes: item.notes
                    }))
                } : undefined
            },
            include: { items: true }
        });

        return prescription;
    }

    static async getStockMovements(companyId: string, query: PharmacyQuery) {
        const { page = 1, limit = 20, batchId, movementType, startDate, endDate } = query;

        const where: any = { companyId };

        if (batchId) where.batchId = batchId;
        if (movementType) where.movementType = movementType;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) {
                const end = new Date(endDate as string);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [movements, total] = await Promise.all([
            prisma.stockMovement.findMany({
                where,
                include: {
                    product: true,
                    batch: true
                },
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit)
            }),
            prisma.stockMovement.count({ where })
        ]);

        return {
            data: movements,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        };
    }

    // PARTNERS
    static async getPartners(companyId: string, query: PharmacyQuery) {
        const { search, isActive } = query;

        const where: Record<string, any> = { companyId };
        if (isActive === 'true') where.isActive = true;
        if (isActive === 'false') where.isActive = false;

        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { email: { contains: search as string, mode: 'insensitive' } },
                { nuit: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        return await prisma.pharmacyPartner.findMany({
            where,
            orderBy: { name: 'asc' }
        });
    }

    static async createPartner(companyId: string, data: Record<string, any>) {
        return await prisma.pharmacyPartner.create({
            data: {
                ...data,
                companyId
            }
        });
    }

    static async updatePartner(id: string, companyId: string, data: Record<string, any>) {
        return await prisma.pharmacyPartner.update({
            where: { id, companyId },
            data
        });
    }

    static async deletePartner(id: string, companyId: string) {
        // Soft delete or hard delete? Let's check for sales first
        const salesCount = await prisma.pharmacySale.count({
            where: { partnerId: id }
        });

        if (salesCount > 0) {
            return await prisma.pharmacyPartner.update({
                where: { id, companyId },
                data: { isActive: false }
            });
        }

        return await prisma.pharmacyPartner.delete({
            where: { id, companyId }
        });
    }
}
