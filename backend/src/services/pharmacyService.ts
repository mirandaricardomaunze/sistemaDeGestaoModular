import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { buildPaginationMeta } from '../utils/pagination';
import { ApiError } from '../middleware/error.middleware';
import { stockService } from './stockService';
import { ResultHandler } from '../utils/result';

type Nullable<T> = T | null | undefined;

interface MedicationInput {
    productId: string;
    requiresPrescription?: boolean;
    isControlled?: boolean;
    storageTemp?: string;
    concentration?: string;
    dosageForm?: string;
    activeIngredients?: string;
    therapeuticClass?: string;
    contraindications?: string;
    sideEffects?: string;
    interactions?: string;
    notes?: string;
    // Tests and external callers may pass additional medication metadata
    // (e.g. dosage, pharmaceuticalForm) that Prisma accepts without strict typing.
    [key: string]: unknown;
}

interface BatchInput {
    medicationId: string;
    batchNumber: string;
    quantity: number | string;
    expiryDate: string | Date;
    costPrice?: Nullable<number | string>;
    sellingPrice?: Nullable<number | string>;
    supplier?: Nullable<string>;
    invoiceNumber?: Nullable<string>;
    status?: Nullable<string>;
    notes?: Nullable<string>;
}

interface PharmacySaleItemInput {
    batchId?: string;
    medicationId?: string;
    productName?: string;
    quantity: number;
    unitPrice?: Nullable<number | string>;
    total?: Nullable<number | string>;
    discount?: number;
    posologyLabel?: string;
}

interface PharmacySaleInput {
    items: PharmacySaleItemInput[];
    customerId?: Nullable<string>;
    customerName?: Nullable<string>;
    partnerId?: Nullable<string>;
    prescriptionId?: Nullable<string>;
    prescriptionNumber?: Nullable<string>;
    discount?: number;
    insuranceAmount?: number;
    paymentMethod?: string;
    paymentDetails?: Prisma.InputJsonValue;
    notes?: string;
    sessionId?: string;
}

interface PrescriptionInput {
    patientName: string;
    prescriberName: string;
    prescriptionDate: string | Date;
    patientBirthDate?: Nullable<string | Date>;
    validUntil?: Nullable<string | Date>;
    items?: Array<{
        medicationName: string;
        medicationId?: Nullable<string>;
        dosage?: Nullable<string>;
        quantity: number;
        posology?: Nullable<string>;
        duration?: Nullable<string>;
        notes?: Nullable<string>;
    }>;
    [key: string]: unknown;
}

interface PartnerInput {
    name: string;
    category?: Nullable<string>;
    email?: Nullable<string>;
    phone?: Nullable<string>;
    address?: Nullable<string>;
    nuit?: Nullable<string>;
    coveragePercentage?: Nullable<number | string>;
    isActive?: boolean;
}

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

        const productWhere: Prisma.ProductWhereInput = {
            companyId,
            originModule: 'pharmacy'
        };
        if (search) {
            productWhere.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search } }
            ];
        }
        const where: Prisma.MedicationWhereInput & { product: Prisma.ProductWhereInput } = {
            product: productWhere
        };

        if (requiresPrescription === 'true') where.requiresPrescription = true;
        if (isControlled === 'true') where.isControlled = true;

        if (lowStock === 'true') {
            // Prisma doesn't support field-to-field comparisons in where clauses.
            // We filter post-query using each product's minStock (or default 5).
            // The `isLowStock` flag on each item is accurate; this pre-filter uses 10
            // as a conservative threshold to reduce the result set before JS filtering.
            where.product.currentStock = { lte: 10 };
        }

        // Optimized pagination + field selection at DB level
        // We only fetch what list views actually need (no raw description/imageUrl etc.)
        const [medications, total] = await Promise.all([
            prisma.medication.findMany({
                where,
                select: {
                    id: true,
                    productId: true,
                    activeIngredient: true,
                    dosage: true,
                    pharmaceuticalForm: true,
                    requiresPrescription: true,
                    isControlled: true,
                    controlLevel: true,
                    storageTemp: true,
                    product: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            barcode: true,
                            price: true,
                            costPrice: true,
                            currentStock: true,
                            minStock: true,
                            packSize: true
                        }
                    },
                    batches: {
                        where: { status: { not: 'depleted' } },
                        orderBy: { expiryDate: 'asc' },
                        select: {
                            id: true,
                            batchNumber: true,
                            expiryDate: true,
                            quantityAvailable: true,
                            sellingPrice: true,
                            status: true
                        }
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

        return ResultHandler.success({ data, pagination });
    }

    async createMedication(companyId: string, data: MedicationInput) {
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

        return ResultHandler.success(medication);
    }

    async updateMedication(id: string, companyId: string, data: Partial<MedicationInput>) {
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

        const updated = await prisma.medication.update({
            where: { id },
            data,
            include: { product: true }
        });

        return ResultHandler.success(updated, 'Dados do medicamento atualizados');
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

        const deleted = await prisma.medication.delete({
            where: { id }
        });

        return ResultHandler.success(deleted, 'Medicamento removido do catálogo');
    }

    async getBatches(companyId: string, query: PharmacyQuery) {
        const { status, expiringDays, medicationId, page = 1, limit = 50 } = query;

        const where: Prisma.MedicationBatchWhereInput = {
            medication: {
                product: { companyId }
            }
        };
        if (status) where.status = status as Prisma.MedicationBatchWhereInput['status'];
        if (medicationId) where.medicationId = medicationId;

        // Push expiringDays into the SQL where (instead of post-filtering in JS).
        if (expiringDays) {
            const days = parseInt(expiringDays as string);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() + days);
            where.expiryDate = { lte: cutoffDate };
        }

        const [batches, total] = await Promise.all([
            prisma.medicationBatch.findMany({
                where,
                select: {
                    id: true,
                    batchNumber: true,
                    quantity: true,
                    quantityAvailable: true,
                    expiryDate: true,
                    sellingPrice: true,
                    costPrice: true,
                    supplier: true,
                    status: true,
                    medication: {
                        select: {
                            id: true,
                            product: {
                                select: { id: true, name: true, code: true, currentStock: true }
                            }
                        }
                    }
                },
                orderBy: { expiryDate: 'asc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit)
            }),
            prisma.medicationBatch.count({ where })
        ]);

        const pagination = buildPaginationMeta(Number(page), Number(limit), total);
        return ResultHandler.success({ data: batches, pagination });
    }

    async createBatch(companyId: string, data: BatchInput, performedBy: string) {
        const { medicationId, quantity, expiryDate, ...rest } = data;

        const medication = await prisma.medication.findFirst({
            where: {
                id: medicationId,
                product: { companyId }
            },
            include: { product: true }
        });
        if (!medication) throw ApiError.notFound('Medicamento não encontrado');

        const qty = parseInt(String(quantity));
        const batch = await prisma.$transaction(async (tx) => {
            const newBatch = await tx.medicationBatch.create({
                data: {
                    medicationId,
                    batchNumber: rest.batchNumber,
                    costPrice: rest.costPrice ?? 0,
                    supplier: rest.supplier,
                    invoiceNumber: rest.invoiceNumber,
                    status: (rest.status || 'active') as Prisma.MedicationBatchUncheckedCreateInput['status'],
                    notes: rest.notes,
                    companyId,
                    quantity: qty,
                    quantityAvailable: qty,
                    expiryDate: new Date(expiryDate),
                    sellingPrice: rest.sellingPrice ?? medication.product.price,
                },
                include: { medication: { include: { product: true } } }
            });

            await stockService.recordMovement({
                productId: medication.productId,
                batchId: newBatch.id,
                quantity: qty,
                movementType: 'purchase',
                originModule: 'PHARMACY',
                referenceType: 'PURCHASE',
                referenceContent: rest.invoiceNumber ?? undefined,
                reason: 'Entrada de lote farmacêutico',
                performedBy,
                companyId
            }, tx);

            return newBatch;
        });

        return ResultHandler.success(batch, 'Lote registado com sucesso');
    }

    async getSales(companyId: string, query: PharmacyQuery) {
        const { page = 1, limit = 20, startDate, endDate, status, customerId, search } = query;

        const where: Prisma.PharmacySaleWhereInput = { companyId };
        if (status) where.status = status as Prisma.PharmacySaleWhereInput['status'];
        if (customerId) where.customerId = customerId;
        if (search) {
            where.OR = [
                { saleNumber: { contains: search, mode: 'insensitive' } },
                { customer: { name: { contains: search, mode: 'insensitive' } } },
                { customerName: { contains: search, mode: 'insensitive' } },
            ];
        }

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
                select: {
                    id: true,
                    saleNumber: true,
                    customerId: true,
                    customerName: true,
                    subtotal: true,
                    discount: true,
                    insuranceAmount: true,
                    total: true,
                    paymentMethod: true,
                    paymentDetails: true,
                    status: true,
                    soldBy: true,
                    createdAt: true,
                    customer: { select: { id: true, name: true, phone: true } },
                    prescription: { select: { id: true, prescriptionNo: true, status: true } },
                    items: {
                        select: {
                            id: true,
                            quantity: true,
                            unitPrice: true,
                            discount: true,
                            total: true,
                            productName: true,
                            batch: {
                                select: {
                                    id: true,
                                    batchNumber: true,
                                    medication: {
                                        select: {
                                            id: true,
                                            product: { select: { id: true, name: true, code: true } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit)
            }),
            prisma.pharmacySale.count({ where })
        ]);

        return ResultHandler.success({
            data: sales,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }

    async createSale(companyId: string, data: PharmacySaleInput, performedBy: string) {
        const {
            items, customerId, customerName, partnerId,
            prescriptionId: prescriptionIdRaw, prescriptionNumber,
            discount, insuranceAmount, paymentMethod, paymentDetails, notes,
            sessionId // Mandatory for POS sales
        } = data;

        if (!items || items.length === 0) throw ApiError.badRequest('A venda deve ter pelo menos um item');

        const result = await prisma.$transaction(async (tx) => {
            // ====================================================================
            // OPERATIONAL PREREQUISITE: CASH SESSION
            // Ensure sale is linked to an active cash session
            // ====================================================================
            if (!sessionId) {
                throw ApiError.badRequest('Sessão de caixa é obrigatória para vendas POS');
            }
            const session = await tx.cashSession.findFirst({
                where: { id: sessionId, companyId, status: 'open' }
            });
            if (!session) {
                throw ApiError.badRequest('Sessão de caixa não encontrada ou já encerrada');
            }

            // Resolve prescriptionId -- accept either UUID or human-readable number (PRE-XXXXXX)
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

            let computedSubtotal = 0;
            const saleItems: Prisma.PharmacySaleItemUncheckedCreateWithoutSaleInput[] = [];

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

                // CONTROLLED MEDICATION -- prescription required
                if (batch.medication.isControlled && !resolvedPrescriptionId) {
                    throw ApiError.badRequest(`Venda Recusada: "${batch.medication.product.name}" é controlado e exige Receita Médica válida.`);
                }

                // ====================================================================
                // AUTHORITATIVE CALCULATION
                // Use batch.sellingPrice from DB, not client-provided price.
                // ====================================================================
                const dbPrice = Number(batch.sellingPrice);
                const itemTotal = Math.round(dbPrice * item.quantity * 100) / 100;
                const itemDiscount = item.discount || 0;
                const finalItemTotal = Math.round((itemTotal - itemDiscount) * 100) / 100;
                
                computedSubtotal += finalItemTotal;

                saleItems.push({
                    batchId: item.batchId as string,
                    productName: batch.medication.product.name,
                    quantity: item.quantity,
                    unitPrice: dbPrice,
                    discount: itemDiscount,
                    total: finalItemTotal,
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
            const finalSubtotal = Math.round(computedSubtotal * 100) / 100;
            const finalTotal = Math.round((finalSubtotal - (discount || 0) - resolvedInsuranceAmount) * 100) / 100;

            const sale = await tx.pharmacySale.create({
                data: {
                    saleNumber, companyId, customerId, partnerId,
                    customerName: customerName || 'Cliente Balcão',
                    prescriptionId: resolvedPrescriptionId,
                    subtotal: finalSubtotal,
                    discount: discount || 0,
                    insuranceAmount: resolvedInsuranceAmount,
                    total: finalTotal,
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
                        data: { status: newStatus as Prisma.PrescriptionUncheckedUpdateInput['status'] }
                    });
                }
            }

            await tx.transaction.create({
                data: {
                    type: 'income',
                    category: 'Pharmacy Sales',
                    description: `Venda Farmácia: ${saleNumber}`,
                    amount: finalTotal,
                    date: new Date(),
                    status: 'completed',
                    paymentMethod: (paymentMethod || 'cash') as Prisma.TransactionUncheckedCreateInput['paymentMethod'],
                    reference: saleNumber,
                    module: 'pharmacy',
                    companyId
                }
            });

            if (customerId) {
                const pointsEarned = Math.floor(Number(finalTotal) / 100);
                await tx.customer.update({
                    where: { id: customerId },
                    data: {
                        loyaltyPoints: { increment: pointsEarned },
                        totalPurchases: { increment: finalTotal }
                    }
                });
            }

            return sale;
        }, { timeout: 15000 });

        return ResultHandler.success(result, 'Venda concluída com sucesso');
    }

    async getPrescriptions(companyId: string, query: PharmacyQuery) {
        const { page = 1, limit = 20, status, search } = query;

        const where: Prisma.PrescriptionWhereInput = { companyId };
        if (status) where.status = status as Prisma.PrescriptionWhereInput['status'];
        if (search) {
            where.OR = [
                { patientName: { contains: search, mode: 'insensitive' } },
                { prescriberName: { contains: search, mode: 'insensitive' } },
                { prescriptionNo: { contains: search, mode: 'insensitive' } }
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

        return ResultHandler.success({
            data: prescriptions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }

    async createPrescription(companyId: string, data: PrescriptionInput) {
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
                ...(rest as Prisma.PrescriptionUncheckedCreateInput),
                patientName: rest.patientName as string,
                prescriberName: rest.prescriberName as string,
                prescriptionNo,
                companyId,
                prescriptionDate: new Date(rest.prescriptionDate as string),
                patientBirthDate: rest.patientBirthDate ? new Date(rest.patientBirthDate as string) : undefined,
                validUntil: rest.validUntil ? new Date(rest.validUntil as string) : undefined,
                items: items ? {
                    create: items.map((item) => ({
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

        return ResultHandler.success(prescription, 'Receita registada com sucesso');
    }

    async getStockMovements(companyId: string, query: PharmacyQuery) {
        const { page = 1, limit = 20, batchId, movementType, startDate, endDate } = query;

        const where: Prisma.StockMovementWhereInput = { companyId, originModule: 'PHARMACY' };

        if (batchId) where.batchId = batchId;
        if (movementType) where.movementType = movementType as Prisma.StockMovementWhereInput['movementType'];

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

        return ResultHandler.success({
            data: movements,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }

    // PARTNERS
    async getPartners(companyId: string, query: PharmacyQuery) {
        const { search, isActive } = query;

        const where: Prisma.PharmacyPartnerWhereInput = { companyId };
        if (isActive === 'true') where.isActive = true;
        if (isActive === 'false') where.isActive = false;

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { nuit: { contains: search, mode: 'insensitive' } }
            ];
        }

        const partners = await prisma.pharmacyPartner.findMany({
            where,
            orderBy: { name: 'asc' }
        });

        return ResultHandler.success(partners);
    }

    async createPartner(companyId: string, data: PartnerInput) {
        const partner = await prisma.pharmacyPartner.create({
            data: {
                name: data.name,
                category: data.category || 'Private Insurance',
                email: data.email,
                phone: data.phone,
                address: data.address,
                nuit: data.nuit,
                coveragePercentage: data.coveragePercentage ? parseFloat(String(data.coveragePercentage)) : 0,
                isActive: data.isActive !== undefined ? data.isActive : true,
                companyId
            }
        });

        return ResultHandler.success(partner, 'Entidade parceira cadastrada');
    }

    async updatePartner(id: string, companyId: string, data: Partial<PartnerInput>) {
        const updated = await prisma.pharmacyPartner.update({
            where: { id, companyId },
            data: data as Prisma.PharmacyPartnerUncheckedUpdateInput
        });

        return ResultHandler.success(updated, 'Dados da entidade atualizados');
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

        const history = sales.map(s => ({
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

        return ResultHandler.success(history);
    }
}

export const pharmacyService = new PharmacyService();
