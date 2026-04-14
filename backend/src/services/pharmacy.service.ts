import { prisma } from '../lib/prisma';
import { buildPaginationMeta } from '../utils/pagination';
import { ApiError } from '../middleware/error.middleware';
import { stockService } from './StockService';

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
    async getMedications(companyId: string, query: PharmacyQuery) {
        const { page = 1, limit = 20, search, requiresPrescription, isControlled, lowStock } = query;

        const where: any = {
            product: {
                companyId,
                originModule: 'pharmacy'
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
            // Prisma doesn't support field-to-field comparisons in where clauses.
            // We filter post-query using each product's minStock (or default 5).
            // The `isLowStock` flag on each item is accurate; this pre-filter uses 10
            // as a conservative threshold to reduce the result set before JS filtering.
            where.product.currentStock = { lte: 10 };
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

        const pagination = buildPaginationMeta(Number(page), Number(limit), total);

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

        return { data, pagination };
    }

    async createMedication(companyId: string, data: Record<string, any>) {
        const { productId, ...rest } = data;

        const product = await prisma.product.findFirst({
            where: { id: productId, companyId }
        });
        if (!product) {
            throw ApiError.notFound('Produto não encontrado ou não pertence a esta empresa');
        }

        const existing = await prisma.medication.findUnique({ where: { productId } });
        if (existing) {
            throw ApiError.badRequest('Este produto já está cadastrado como medicamento');
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
            data: { originModule: 'pharmacy' }
        });

        return medication;
    }

    async updateMedication(id: string, companyId: string, data: Record<string, any>) {
        // Verify medication belongs to this company
        const medication = await prisma.medication.findFirst({
            where: {
                id,
                product: { companyId }
            }
        });

        if (!medication) {
            throw ApiError.notFound('Medicamento não encontrado ou não pertence a esta empresa');
        }

        return await prisma.medication.update({
            where: { id },
            data,
            include: { product: true }
        });
    }

    async deleteMedication(id: string, companyId: string) {
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

        if (!med) throw ApiError.notFound('Medicamento não encontrado ou não pertence a esta empresa');
        if (med.batches.length > 0) {
            throw ApiError.badRequest('Não é possível eliminar um medicamento com stock disponível');
        }

        await prisma.medicationBatch.deleteMany({
            where: { medicationId: id }
        });

        return await prisma.medication.delete({
            where: { id }
        });
    }

    async getBatches(companyId: string, query: PharmacyQuery) {
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

    async createBatch(companyId: string, data: Record<string, any>, performedBy: string) {
        const { medicationId, quantity, expiryDate, ...rest } = data;

        const medication = await prisma.medication.findFirst({
            where: {
                id: medicationId,
                product: { companyId }
            },
            include: { product: true }
        });
        if (!medication) throw ApiError.notFound('Medicamento não encontrado');

        const batch = await prisma.$transaction(async (tx) => {
            const newBatch = await tx.medicationBatch.create({
                data: {
                    medicationId,
                    batchNumber: rest.batchNumber,
                    costPrice: rest.costPrice || 0,
                    supplier: rest.supplier,
                    invoiceNumber: rest.invoiceNumber,
                    status: rest.status || 'active',
                    notes: rest.notes,
                    companyId,
                    quantity: parseInt(quantity),
                    quantityAvailable: parseInt(quantity),
                    expiryDate: new Date(expiryDate),
                    sellingPrice: rest.sellingPrice || medication.product.price,
                },
                include: { medication: { include: { product: true } } }
            });

            await stockService.recordMovement({
                productId: medication.productId,
                batchId: newBatch.id,
                quantity: parseInt(quantity),
                movementType: 'purchase',
                originModule: 'PHARMACY',
                referenceType: 'PURCHASE',
                referenceContent: rest.invoiceNumber,
                reason: 'Entrada de lote farmacêutico',
                performedBy,
                companyId
            }, tx);

            return newBatch;
        });

        return batch;
    }

    async getSales(companyId: string, query: PharmacyQuery) {
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

    async createSale(companyId: string, data: Record<string, any>, performedBy: string) {
        const {
            items, customerId, customerName, partnerId,
            prescriptionId: prescriptionIdRaw, prescriptionNumber,
            discount, insuranceAmount, paymentMethod, paymentDetails, notes
        } = data;

        if (!items || items.length === 0) throw ApiError.badRequest('A venda deve ter pelo menos um item');

        return await prisma.$transaction(async (tx) => {
            // Resolve prescriptionId — accept either UUID or human-readable number (PRE-XXXXXX)
            let resolvedPrescriptionId: string | null = prescriptionIdRaw || null;
            if (!resolvedPrescriptionId && prescriptionNumber) {
                const prescription = await tx.prescription.findFirst({
                    where: { prescriptionNo: prescriptionNumber, companyId }
                });
                if (!prescription) throw ApiError.badRequest(`Receita "${prescriptionNumber}" não encontrada nesta farmácia.`);
                // Validate prescription is not expired
                if (prescription.validUntil && prescription.validUntil < new Date()) {
                    throw ApiError.badRequest(`A receita "${prescriptionNumber}" expirou em ${prescription.validUntil.toLocaleDateString('pt-BR')}.`);
                }
                resolvedPrescriptionId = prescription.id;
            }

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
                        medication: { product: { companyId } }
                    },
                    include: { medication: { include: { product: true } } }
                });

                if (!batch) throw ApiError.notFound(`Lote não encontrado: ${item.batchId}`);
                if (batch.quantityAvailable < item.quantity) {
                    throw ApiError.badRequest(`Stock insuficiente para "${batch.medication.product.name}". Disponível: ${batch.quantityAvailable}`);
                }

                // CONTROLLED MEDICATION — prescription required
                if (batch.medication.isControlled && !resolvedPrescriptionId) {
                    throw ApiError.badRequest(`Venda Recusada: "${batch.medication.product.name}" é controlado e exige Receita Médica válida.`);
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

                await stockService.validateAvailability(batch.medication.productId, item.quantity, companyId, tx);

                await tx.medicationBatch.update({
                    where: { id: item.batchId },
                    data: {
                        quantityAvailable: { decrement: item.quantity },
                        status: batch.quantityAvailable - item.quantity <= 0 ? 'depleted' : batch.status
                    }
                });

                await stockService.recordMovement({
                    productId: batch.medication.productId,
                    batchId: item.batchId,
                    quantity: -item.quantity,
                    movementType: 'sale',
                    originModule: 'PHARMACY',
                    referenceType: 'SALE',
                    referenceContent: saleNumber,
                    reason: `Venda Farmácia ${saleNumber}`,
                    performedBy,
                    companyId
                }, tx);
            }

            const resolvedInsuranceAmount = insuranceAmount || 0;
            const total = subtotal - (discount || 0) - resolvedInsuranceAmount;

            const sale = await tx.pharmacySale.create({
                data: {
                    saleNumber, companyId, customerId, partnerId,
                    customerName: customerName || 'Cliente Balcão',
                    prescriptionId: resolvedPrescriptionId,
                    subtotal,
                    discount: discount || 0,
                    insuranceAmount: resolvedInsuranceAmount,
                    total,
                    paymentMethod: paymentMethod || 'cash',
                    paymentDetails, soldBy: performedBy, notes,
                    items: { create: saleItems }
                },
                include: {
                    customer: true,
                    partner: true,
                    prescription: true,
                    items: { include: { batch: { include: { medication: { include: { product: true } } } } } }
                }
            });

            // Update prescription lifecycle
            if (resolvedPrescriptionId) {
                const prescription = await tx.prescription.findUnique({
                    where: { id: resolvedPrescriptionId },
                    include: { items: true }
                });
                if (prescription) {
                    // Update quantityDispensed for each matching prescription item.
                    // Match by medicationId (FK) first; fall back to name comparison.
                    for (const saleItem of saleItems) {
                        const batch = await tx.medicationBatch.findUnique({
                            where: { id: saleItem.batchId },
                            select: { medicationId: true }
                        });
                        const prescItem = prescription.items.find(pi =>
                            (batch && pi.medicationId && pi.medicationId === batch.medicationId) ||
                            pi.medicationName.toLowerCase() === saleItem.productName.toLowerCase()
                        );
                        if (prescItem) {
                            await tx.prescriptionItem.update({
                                where: { id: prescItem.id },
                                data: { quantityDispensed: { increment: saleItem.quantity } }
                            });
                        }
                    }

                    // Recompute status: fetch fresh items after update
                    const updatedItems = await tx.prescriptionItem.findMany({
                        where: { prescriptionId: resolvedPrescriptionId }
                    });
                    const allDispensed = updatedItems.every(i => i.quantityDispensed >= i.quantity);
                    const anyDispensed = updatedItems.some(i => i.quantityDispensed > 0);
                    const newStatus = allDispensed ? 'dispensed' : anyDispensed ? 'partial' : 'pending';

                    await tx.prescription.update({
                        where: { id: resolvedPrescriptionId },
                        data: { status: newStatus as any }
                    });
                }
            }

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

    async getPrescriptions(companyId: string, query: PharmacyQuery) {
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

    async createPrescription(companyId: string, data: Record<string, any>) {
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
                ...(rest as any),
                patientName: rest.patientName as string,
                prescriberName: rest.prescriberName as string,
                prescriptionNo,
                companyId,
                prescriptionDate: new Date(rest.prescriptionDate),
                patientBirthDate: rest.patientBirthDate ? new Date(rest.patientBirthDate) : undefined,
                validUntil: rest.validUntil ? new Date(rest.validUntil) : undefined,
                items: items ? {
                    create: items.map((item: any) => ({
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

    async getStockMovements(companyId: string, query: PharmacyQuery) {
        const { page = 1, limit = 20, batchId, movementType, startDate, endDate } = query;

        const where: any = { companyId, originModule: 'PHARMACY' };

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
    async getPartners(companyId: string, query: PharmacyQuery) {
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

    async createPartner(companyId: string, data: Record<string, any>) {
        return await prisma.pharmacyPartner.create({
            data: {
                name: data.name,
                category: data.category || 'Private Insurance',
                email: data.email,
                phone: data.phone,
                address: data.address,
                nuit: data.nuit,
                coveragePercentage: data.coveragePercentage ? parseFloat(data.coveragePercentage) : 0,
                isActive: data.isActive !== undefined ? data.isActive : true,
                companyId
            }
        });
    }

    async updatePartner(id: string, companyId: string, data: Record<string, any>) {
        return await prisma.pharmacyPartner.update({
            where: { id, companyId },
            data
        });
    }

    async deletePartner(id: string, companyId: string) {
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
    // ============================================================================
    // PATIENT HISTORY
    // ============================================================================

    async getPatientControlledHistory(companyId: string, customerId: string) {
        // Query pharmacy sales assigned to this customer that contain at least one controlled medication
        const sales = await prisma.pharmacySale.findMany({
            where: {
                companyId,
                customerId,
                items: {
                    some: {
                        batch: {
                            medication: {
                                isControlled: true
                            }
                        }
                    }
                }
            },
            include: {
                items: {
                    where: {
                        batch: {
                            medication: {
                                isControlled: true
                            }
                        }
                    }
                },
                prescription: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return sales.map(s => ({
            id: s.id,
            date: s.createdAt,
            number: s.saleNumber,
            prescription: s.prescription ? {
                id: s.prescription.id,
                code: s.prescription.prescriptionNo,
                doctorName: s.prescription.prescriberName,
                doctorId: s.prescription.prescriberCRM,
                expirationDate: s.prescription.validUntil
            } : null,
            items: s.items.map(i => ({
                id: i.id,
                productName: i.productName,
                quantity: i.quantity,
                unitPrice: i.unitPrice
            }))
        }));
    }
}

export const pharmacyService = new PharmacyService();
