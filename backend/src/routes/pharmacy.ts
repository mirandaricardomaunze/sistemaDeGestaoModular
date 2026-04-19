import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { pharmacyService } from '../services/pharmacyService';
import {
    createMedicationSchema,
    updateMedicationSchema,
    createBatchSchema,
    createPharmacySaleSchema,
    createPrescriptionSchema,
    createPartnerSchema,
    updatePartnerSchema
} from '../validation';
import { ApiError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';
import { emitToCompany } from '../lib/socket';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ============================================================================
// MULTER -- Prescription image uploads
// ============================================================================

const uploadDir = path.join(process.cwd(), 'uploads', 'prescriptions');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const rxStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `rx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
});

const rxUpload = multer({
    storage: rxStorage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
        cb(null, allowed.includes(file.mimetype));
    }
});

const router = Router();
router.use(authenticate);

// ============================================================================
// DASHBOARD SUMMARY
// ============================================================================

router.get('/dashboard', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const companyId = req.companyId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
        totalMedications,
        lowStockCount,
        expiringSoonCount,
        controlledCount,
        salesToday,
        salesThisMonth,
        pendingPrescriptions
    ] = await Promise.all([
        prisma.medication.count({ where: { product: { companyId, originModule: 'pharmacy' } } }),
        prisma.medication.count({ where: { product: { companyId, currentStock: { lte: 5 } } } }),
        prisma.medicationBatch.count({
            where: {
                companyId,
                status: { not: 'depleted' },
                expiryDate: { lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }
            }
        }),
        prisma.medication.count({ where: { product: { companyId }, isControlled: true } }),
        prisma.pharmacySale.aggregate({
            where: { companyId, createdAt: { gte: today } },
            _sum: { total: true },
            _count: { id: true }
        }),
        prisma.pharmacySale.aggregate({
            where: { companyId, createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) } },
            _sum: { total: true },
            _count: { id: true }
        }),
        prisma.prescription.count({ where: { companyId, status: 'pending' } })
    ]);

    const monthTotal = Number(salesThisMonth._sum.total || 0);
    res.json({
        totalMedications,
        lowStockCount,
        expiringSoonCount,
        expiringCount: expiringSoonCount,      // alias expected by frontend
        controlledCount,
        salesToday: { total: Number(salesToday._sum.total || 0), count: salesToday._count.id },
        salesThisMonth: { total: monthTotal, count: salesThisMonth._count.id },
        monthSales: monthTotal,                // flat alias expected by frontend
        pendingPrescriptions
    });
});

// ============================================================================
// MEDICATIONS
// ============================================================================

router.get('/medications', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await pharmacyService.getMedications(req.companyId, req.query));
});

router.post('/medications', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = createMedicationSchema.parse(req.body);
    res.status(201).json(await pharmacyService.createMedication(req.companyId, validatedData));
});

router.put('/medications/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = updateMedicationSchema.parse(req.body);
    res.json(await pharmacyService.updateMedication(req.params.id, req.companyId, validatedData));
});

router.delete('/medications/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    await pharmacyService.deleteMedication(req.params.id, req.companyId);
    res.json({ message: 'Medicamento eliminado com sucesso' });
});

// ============================================================================
// BATCHES (Lotes)
// ============================================================================

router.get('/batches', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await pharmacyService.getBatches(req.companyId, req.query));
});

router.post('/batches', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = createBatchSchema.parse(req.body);
    res.status(201).json(await pharmacyService.createBatch(req.companyId, validatedData, req.userName || 'Sistema'));
});

router.put('/batches/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const batch = await prisma.medicationBatch.findFirst({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (!batch) throw ApiError.notFound('Lote não encontrado');
    const updated = await prisma.medicationBatch.update({
        where: { id: req.params.id },
        data: req.body,
        include: { medication: { include: { product: true } } }
    });
    res.json(updated);
});

router.delete('/batches/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const batch = await prisma.medicationBatch.findFirst({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (!batch) throw ApiError.notFound('Lote não encontrado');
    if (batch.quantityAvailable > 0) throw ApiError.badRequest('Não é possível eliminar um lote com stock disponível');
    await prisma.medicationBatch.delete({ where: { id: req.params.id } });
    res.json({ message: 'Lote eliminado com sucesso' });
});

// ============================================================================
// SALES (Vendas)
// ============================================================================

router.get('/sales', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await pharmacyService.getSales(req.companyId, req.query));
});

router.post('/sales', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = createPharmacySaleSchema.parse(req.body);
    res.status(201).json(await pharmacyService.createSale(req.companyId, validatedData, req.userName || 'Sistema'));
});

// ============================================================================
// PATIENT HISTORY
// ============================================================================

router.get('/patients/:id/controlled-history', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await pharmacyService.getPatientControlledHistory(req.companyId, req.params.id));
});

// ============================================================================
// PRESCRIPTIONS (Receitas)
// ============================================================================

router.get('/prescriptions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await pharmacyService.getPrescriptions(req.companyId, req.query));
});

// Lookup a single prescription by number (for POS validation)
router.get('/prescriptions/lookup', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { number } = req.query as { number?: string };
    if (!number) throw ApiError.badRequest('Número de receita obrigatório');
    const prescription = await prisma.prescription.findFirst({
        where: { prescriptionNo: number, companyId: req.companyId },
        include: { items: true }
    });
    if (!prescription) throw ApiError.notFound('Receita não encontrada');
    res.json(prescription);
});

router.post('/prescriptions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = createPrescriptionSchema.parse(req.body);
    const result = await pharmacyService.createPrescription(req.companyId, validatedData);
    
    if (result.success && result.data) {
        // Socket Notification: New Prescription
        emitToCompany(req.companyId, 'pharmacy:new_prescription', {
            id: result.data.id,
            patientName: result.data.patientName,
            timestamp: new Date()
        });
    }

    res.status(201).json(result);
});

router.put('/prescriptions/:id/status', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { status } = req.body;
    const prescription = await prisma.prescription.findFirst({ where: { id: req.params.id, companyId: req.companyId } });
    if (!prescription) throw ApiError.notFound('Receita não encontrada');
    const updated = await prisma.prescription.update({ where: { id: req.params.id }, data: { status } });
    res.json(updated);
});

// Upload image for a prescription (replaces any existing one)
router.post('/prescriptions/:id/image', rxUpload.single('image'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    if (!req.file) throw ApiError.badRequest('Nenhum ficheiro recebido. Envie um campo "image".');

    const prescription = await prisma.prescription.findFirst({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (!prescription) {
        // Remove uploaded file since prescription doesn't belong to this company
        fs.unlinkSync(req.file.path);
        throw ApiError.notFound('Receita não encontrada');
    }

    // Delete old image file if it exists
    if (prescription.imageUrl) {
        const oldFile = path.join(process.cwd(), prescription.imageUrl.replace(/^\//, ''));
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    const imageUrl = `/uploads/prescriptions/${req.file.filename}`;
    await prisma.prescription.update({ where: { id: req.params.id }, data: { imageUrl } });

    res.json({ imageUrl, message: 'Imagem da receita guardada com sucesso' });
});

// Delete prescription image
router.delete('/prescriptions/:id/image', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const prescription = await prisma.prescription.findFirst({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (!prescription) throw ApiError.notFound('Receita não encontrada');
    if (!prescription.imageUrl) { res.json({ message: 'Sem imagem' }); return; }

    const filePath = path.join(process.cwd(), prescription.imageUrl.replace(/^\//, ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.prescription.update({ where: { id: req.params.id }, data: { imageUrl: null } });
    res.json({ message: 'Imagem eliminada' });
});

// ============================================================================
// STOCK MOVEMENTS
// ============================================================================

router.get('/stock-movements', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await pharmacyService.getStockMovements(req.companyId, req.query));
});

// ============================================================================
// PARTNERS (Seguradoras / Parcerias)
// ============================================================================

router.get('/partners', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await pharmacyService.getPartners(req.companyId, req.query));
});

router.post('/partners', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = createPartnerSchema.parse(req.body);
    res.status(201).json(await pharmacyService.createPartner(req.companyId, validatedData));
});

router.put('/partners/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = updatePartnerSchema.parse(req.body);
    res.json(await pharmacyService.updatePartner(req.params.id, req.companyId, validatedData));
});

router.delete('/partners/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    await pharmacyService.deletePartner(req.params.id, req.companyId);
    res.json({ message: 'Parceiro eliminado com sucesso' });
});

// ============================================================================
// REPORTS
// ============================================================================

// ============================================================================
// SALES CHART  (period-grouped data for frontend charts)
// ============================================================================

router.get('/sales/chart', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { period = '30days' } = req.query as { period?: string };

    const days = period === '7days' ? 7 : period === '90days' ? 90 : period === '180days' ? 180 : period === '365days' ? 365 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const sales = await prisma.pharmacySale.findMany({
        where: { companyId: req.companyId, createdAt: { gte: since } },
        select: { createdAt: true, total: true },
        orderBy: { createdAt: 'asc' }
    });

    // Group by date
    const grouped: Record<string, number> = {};
    for (const s of sales) {
        const key = s.createdAt.toISOString().slice(0, 10);
        grouped[key] = (grouped[key] || 0) + Number(s.total);
    }
    // Fill all days in range
    const result: { date: string; total: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        result.push({ date: key, total: grouped[key] || 0 });
    }
    res.json(result);
});

// ============================================================================
// TOP PRODUCTS
// ============================================================================

router.get('/sales/top-products', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const limit = parseInt(req.query.limit as string || '6');

    const items = await prisma.pharmacySaleItem.groupBy({
        by: ['productName'],
        where: { sale: { companyId: req.companyId } },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: limit
    });

    res.json(items.map(i => ({
        name: i.productName,
        quantity: i._sum.quantity || 0,
        totalSold: Number(i._sum.total || 0)
    })));
});

// ============================================================================
// SALE REFUND
// ============================================================================

router.post('/sales/:id/refund', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const sale = await prisma.pharmacySale.findFirst({
        where: { id: req.params.id, companyId: req.companyId },
        include: { items: true }
    });
    if (!sale) throw ApiError.notFound('Venda não encontrada');
    if (sale.status === 'refunded') throw ApiError.badRequest('Esta venda já foi devolvida');

    const { reason } = req.body;

    await prisma.$transaction(async (tx) => {
        // Restore stock for each batch
        for (const item of sale.items) {
            if (item.batchId) {
                await tx.medicationBatch.update({
                    where: { id: item.batchId },
                    data: { quantityAvailable: { increment: item.quantity } }
                });
                const batch = await tx.medicationBatch.findUnique({
                    where: { id: item.batchId },
                    include: { medication: true }
                });
                if (batch) {
                    await tx.product.update({
                        where: { id: batch.medication.productId },
                        data: { currentStock: { increment: item.quantity } }
                    });
                }
            }
        }

        await tx.pharmacySale.update({
            where: { id: sale.id },
            data: { status: 'refunded', notes: `Devolvida: ${reason || 'Sem motivo'}` }
        });
    });

    res.json({ message: 'Venda devolvida com sucesso' });
});

// ============================================================================
// PATIENT PROFILE (Allergies, Chronic Conditions)
// ============================================================================

router.get('/patients/:id/profile', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const customer = await prisma.customer.findFirst({
        where: { id: req.params.id, companyId: req.companyId },
        select: { id: true, name: true, phone: true, email: true, bloodType: true, allergies: true, chronicConditions: true, emergencyContact: true, patientNotes: true }
    });
    if (!customer) throw ApiError.notFound('Paciente não encontrado');
    res.json(customer);
});

router.put('/patients/:id/profile', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { bloodType, allergies, chronicConditions, emergencyContact, patientNotes } = req.body;
    const updated = await prisma.customer.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: { bloodType, allergies: allergies || [], chronicConditions: chronicConditions || [], emergencyContact, patientNotes }
    });
    if (updated.count === 0) throw ApiError.notFound('Paciente não encontrado');
    res.json({ message: 'Perfil actualizado com sucesso' });
});

router.get('/patients/:id/medication-history', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [sales, total] = await Promise.all([
        prisma.pharmacySale.findMany({
            where: { companyId: req.companyId, customerId: req.params.id, status: { not: 'refunded' } },
            include: {
                items: { include: { batch: { include: { medication: { include: { product: { select: { name: true } } } } } } } },
                prescription: { select: { prescriptionNo: true, prescriberName: true } }
            },
            orderBy: { createdAt: 'desc' },
            skip, take: Number(limit)
        }),
        prisma.pharmacySale.count({ where: { companyId: req.companyId, customerId: req.params.id, status: { not: 'refunded' } } })
    ]);

    res.json({ data: sales, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
});

// ============================================================================
// DRUG INTERACTIONS
// ============================================================================

router.get('/interactions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { medicationId } = req.query;
    const where: any = { companyId: req.companyId };
    if (medicationId) {
        where.OR = [{ medicationAId: medicationId }, { medicationBId: medicationId }];
    }
    const interactions = await prisma.drugInteraction.findMany({
        where,
        include: {
            medicationA: { include: { product: { select: { name: true } } } },
            medicationB: { include: { product: { select: { name: true } } } }
        }
    });
    res.json(interactions);
});

router.post('/interactions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { medicationAId, medicationBId, severity, description, mechanism, management } = req.body;
    if (!medicationAId || !medicationBId || !severity || !description) throw ApiError.badRequest('Campos obrigatórios em falta');
    // Check both meds belong to company
    const [medA, medB] = await Promise.all([
        prisma.medication.findFirst({ where: { id: medicationAId, product: { companyId: req.companyId } } }),
        prisma.medication.findFirst({ where: { id: medicationBId, product: { companyId: req.companyId } } })
    ]);
    if (!medA || !medB) throw ApiError.notFound('Medicamento não encontrado');
    const existing = await prisma.drugInteraction.findUnique({ where: { medicationAId_medicationBId: { medicationAId, medicationBId } } });
    if (existing) throw ApiError.badRequest('Interacção já registada');
    const interaction = await prisma.drugInteraction.create({ data: { medicationAId, medicationBId, severity, description, mechanism, management, companyId: req.companyId } });
    res.status(201).json(interaction);
});

router.delete('/interactions/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    await prisma.drugInteraction.deleteMany({ where: { id: req.params.id, companyId: req.companyId } });
    res.json({ message: 'Interacção eliminada' });
});

// Check interactions for a cart (list of medicationIds)
router.post('/interactions/check', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { medicationIds } = req.body as { medicationIds: string[] };
    if (!medicationIds || medicationIds.length < 2) return res.json([]);

    const interactions = await prisma.drugInteraction.findMany({
        where: {
            companyId: req.companyId,
            OR: medicationIds.flatMap(id =>
                medicationIds.filter(other => other !== id).map(other => ({
                    medicationAId: id, medicationBId: other
                }))
            )
        },
        include: {
            medicationA: { include: { product: { select: { name: true } } } },
            medicationB: { include: { product: { select: { name: true } } } }
        }
    });
    res.json(interactions);
});

// ============================================================================
// NARCOTIC REGISTER
// ============================================================================

router.get('/narcotic-register', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { startDate, endDate, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { companyId: req.companyId };
    if (startDate || endDate) {
        where.registerDate = {};
        if (startDate) where.registerDate.gte = new Date(startDate as string);
        if (endDate) { const e = new Date(endDate as string); e.setHours(23,59,59,999); where.registerDate.lte = e; }
    }
    const [records, total] = await Promise.all([
        prisma.narcoticRegister.findMany({ where, orderBy: { registerDate: 'desc' }, skip, take: Number(limit) }),
        prisma.narcoticRegister.count({ where })
    ]);
    res.json({ data: records, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
});

router.post('/narcotic-register', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { registerDate, medicationId, medicationName, batchNumber, openingBalance, received, dispensed, returned, destroyed, notes } = req.body;
    const closingBalance = openingBalance + (received || 0) - (dispensed || 0) + (returned || 0) - (destroyed || 0);
    const discrepancy = closingBalance < 0 ? Math.abs(closingBalance) : 0;
    const record = await prisma.narcoticRegister.create({
        data: {
            registerDate: new Date(registerDate), medicationId, medicationName, batchNumber,
            openingBalance, received: received || 0, dispensed: dispensed || 0,
            returned: returned || 0, destroyed: destroyed || 0,
            closingBalance: Math.max(0, closingBalance), discrepancy,
            notes, verifiedBy: req.userName || 'Sistema', companyId: req.companyId
        }
    });

    // Socket Notification: Narcotic Alert (High sensitivity)
    emitToCompany(req.companyId, 'pharmacy:narcotic_alert', {
        message: `Novo registo de narcótico: ${medicationName}`,
        dispensed: dispensed || 0,
        timestamp: new Date()
    });

    res.status(201).json(record);
});

router.put('/narcotic-register/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { received, dispensed, returned, destroyed, notes } = req.body;
    const existing = await prisma.narcoticRegister.findFirst({ where: { id: req.params.id, companyId: req.companyId } });
    if (!existing) throw ApiError.notFound('Registo não encontrado');
    const closingBalance = existing.openingBalance + (received ?? existing.received) - (dispensed ?? existing.dispensed)
        + (returned ?? existing.returned) - (destroyed ?? existing.destroyed);
    const discrepancy = closingBalance < 0 ? Math.abs(closingBalance) : 0;
    const updated = await prisma.narcoticRegister.update({
        where: { id: req.params.id },
        data: {
            received: received ?? existing.received, dispensed: dispensed ?? existing.dispensed,
            returned: returned ?? existing.returned, destroyed: destroyed ?? existing.destroyed,
            closingBalance: Math.max(0, closingBalance), discrepancy, notes: notes ?? existing.notes,
            verifiedBy: req.userName || existing.verifiedBy
        }
    });
    res.json(updated);
});

// ============================================================================
// BATCH RECALLS
// ============================================================================

router.get('/recalls', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { status, page = 1, limit = 20 } = req.query;
    const where: any = { companyId: req.companyId };
    if (status) where.status = status;
    const [records, total] = await Promise.all([
        prisma.batchRecall.findMany({
            where, include: { medication: { include: { product: { select: { name: true, code: true } } } } },
            orderBy: { recallDate: 'desc' },
            skip: (Number(page) - 1) * Number(limit), take: Number(limit)
        }),
        prisma.batchRecall.count({ where })
    ]);
    res.json({ data: records, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
});

router.post('/recalls', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { medicationId, batchNumbers, reason, severity, issuedBy, recallDate, notes } = req.body;
    if (!medicationId || !batchNumbers || !reason) throw ApiError.badRequest('Campos obrigatórios em falta');
    const med = await prisma.medication.findFirst({ where: { id: medicationId, product: { companyId: req.companyId } } });
    if (!med) throw ApiError.notFound('Medicamento não encontrado');
    const lastRecall = await prisma.batchRecall.findFirst({ where: { companyId: req.companyId }, orderBy: { createdAt: 'desc' }, select: { recallNumber: true } });
    const nextNum = lastRecall ? parseInt(lastRecall.recallNumber.replace('REC-', '')) + 1 : 1;
    const recallNumber = `REC-${String(nextNum).padStart(5, '0')}`;
    // Count affected units
    const batches = await prisma.medicationBatch.findMany({ where: { medicationId, batchNumber: { in: batchNumbers }, companyId: req.companyId as string } });
    const affectedUnits = batches.reduce((s, b) => s + b.quantityAvailable, 0);
    const recall = await prisma.batchRecall.create({
        data: { recallNumber, medicationId, batchNumbers, reason, severity: severity || 'voluntary', issuedBy: issuedBy || req.userName || 'Sistema', recallDate: new Date(recallDate || Date.now()), affectedUnits, notes, companyId: req.companyId }
    });
    res.status(201).json(recall);
});

router.put('/recalls/:id/resolve', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { recoveredUnits, actionTaken } = req.body;
    const recall = await prisma.batchRecall.findFirst({ where: { id: req.params.id, companyId: req.companyId } });
    if (!recall) throw ApiError.notFound('Recall não encontrado');
    const updated = await prisma.batchRecall.update({
        where: { id: req.params.id },
        data: { status: 'resolved', recoveredUnits: recoveredUnits || 0, actionTaken, resolvedAt: new Date() }
    });
    res.json(updated);
});

// Find sales containing recalled batches (for customer notification)
router.get('/recalls/:id/affected-sales', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const recall = await prisma.batchRecall.findFirst({ where: { id: req.params.id, companyId: req.companyId } });
    if (!recall) throw ApiError.notFound('Recall não encontrado');
    const batches = await prisma.medicationBatch.findMany({ where: { batchNumber: { in: recall.batchNumbers }, medicationId: recall.medicationId } });
    const batchIds = batches.map(b => b.id);
    const sales = await prisma.pharmacySale.findMany({
        where: { companyId: req.companyId, items: { some: { batchId: { in: batchIds } } } },
        include: { customer: { select: { id: true, name: true, phone: true, email: true } }, items: { where: { batchId: { in: batchIds } } } }
    });
    res.json(sales);
});

// ============================================================================
// PARTNER INVOICES (Billing to insurance/convenio)
// ============================================================================

router.get('/partner-invoices', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { partnerId, status, page = 1, limit = 20 } = req.query;
    const where: any = { companyId: req.companyId };
    if (partnerId) where.partnerId = partnerId;
    if (status) where.status = status;
    const [invoices, total] = await Promise.all([
        prisma.partnerInvoice.findMany({
            where, include: { partner: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            skip: (Number(page) - 1) * Number(limit), take: Number(limit)
        }),
        prisma.partnerInvoice.count({ where })
    ]);
    res.json({ data: invoices, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
});

router.post('/partner-invoices/generate', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { partnerId, periodStart, periodEnd, dueDate } = req.body;
    if (!partnerId || !periodStart || !periodEnd) throw ApiError.badRequest('Campos obrigatórios em falta');
    const partner = await prisma.pharmacyPartner.findFirst({ where: { id: partnerId, companyId: req.companyId } });
    if (!partner) throw ApiError.notFound('Parceiro não encontrado');
    const start = new Date(periodStart); const end = new Date(periodEnd); end.setHours(23,59,59,999);
    // Aggregate insurance amounts from sales in this period for this partner
    const sales = await prisma.pharmacySale.findMany({
        where: { companyId: req.companyId, partnerId, status: { not: 'refunded' }, createdAt: { gte: start, lte: end } },
        select: { id: true, saleNumber: true, insuranceAmount: true }
    });
    if (sales.length === 0) throw ApiError.badRequest('Nenhuma venda encontrada neste período para este parceiro');
    const totalAmount = sales.reduce((s, sale) => s + Number(sale.insuranceAmount), 0);
    const saleIds = sales.map(s => s.id);
    const lastInv = await prisma.partnerInvoice.findFirst({ where: { companyId: req.companyId }, orderBy: { createdAt: 'desc' }, select: { invoiceNumber: true } });
    const nextNum = lastInv ? parseInt(lastInv.invoiceNumber.replace('PI-', '')) + 1 : 1;
    const invoiceNumber = `PI-${String(nextNum).padStart(6, '0')}`;
    const invoice = await prisma.partnerInvoice.create({
        data: { invoiceNumber, partnerId, periodStart: start, periodEnd: end, totalAmount, saleIds, dueDate: dueDate ? new Date(dueDate) : null, companyId: req.companyId }
    });
    res.status(201).json(invoice);
});

router.put('/partner-invoices/:id/payment', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { amount } = req.body;
    const inv = await prisma.partnerInvoice.findFirst({ where: { id: req.params.id, companyId: req.companyId } });
    if (!inv) throw ApiError.notFound('Fatura não encontrada');
    const newPaid = Number(inv.paidAmount) + Number(amount);
    const newStatus: any = newPaid >= Number(inv.totalAmount) ? 'paid' : 'partial';
    const updated = await prisma.partnerInvoice.update({
        where: { id: req.params.id },
        data: { paidAmount: newPaid, status: newStatus, paidAt: newStatus === 'paid' ? new Date() : null }
    });
    res.json(updated);
});

// ============================================================================
// RX LABEL DATA
// ============================================================================

router.get('/sales/:id/label-data', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const sale = await prisma.pharmacySale.findFirst({
        where: { id: req.params.id, companyId: req.companyId },
        include: {
            customer: { select: { name: true, phone: true } },
            prescription: { select: { prescriptionNo: true, prescriberName: true, prescriberCRM: true, diagnosis: true } },
            items: {
                include: {
                    batch: {
                        include: { medication: { include: { product: { select: { name: true } } } } }
                    }
                }
            }
        }
    });
    if (!sale) throw ApiError.notFound('Venda não encontrada');
    // Mark label as printed
    await prisma.pharmacySale.update({ where: { id: req.params.id }, data: { labelPrinted: true } });
    res.json(sale);
});

// ============================================================================
// STOCK RECONCILIATION
// ============================================================================

// Get current stock snapshot (for reconciliation form)
router.get('/stock-reconciliation/snapshot', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const medications = await prisma.medication.findMany({
        where: { product: { companyId: req.companyId, originModule: 'pharmacy' } },
        include: {
            product: { select: { name: true, code: true, currentStock: true } },
            batches: { where: { status: { not: 'depleted' } }, select: { id: true, batchNumber: true, quantityAvailable: true, expiryDate: true } }
        },
        orderBy: { product: { name: 'asc' } }
    });
    res.json(medications.map(m => ({
        medicationId: m.id,
        name: m.product.name,
        code: m.product.code,
        systemStock: m.product.currentStock,
        batches: m.batches
    })));
});

// Submit physical count (adjust stock based on variance)
router.post('/stock-reconciliation', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { counts, notes } = req.body as {
        counts: Array<{ medicationId: string; physicalCount: number; systemStock: number }>;
        notes?: string;
    };
    if (!counts || !Array.isArray(counts)) throw ApiError.badRequest('counts obrigatório');

    const results: Array<{ medicationId: string; variance: number; adjusted: boolean }> = [];
    await prisma.$transaction(async (tx) => {
        for (const entry of counts) {
            const variance = entry.physicalCount - entry.systemStock;
            if (variance === 0) {
                results.push({ medicationId: entry.medicationId, variance: 0, adjusted: false });
                continue;
            }
            // Get medication to find productId
            const med = await tx.medication.findFirst({
                where: { id: entry.medicationId, product: { companyId: req.companyId } },
                include: { product: true }
            });
            if (!med) continue;
            // Adjust product stock to match physical count
            await tx.product.update({
                where: { id: med.productId },
                data: { currentStock: Math.max(0, entry.physicalCount) }
            });
            // Log stock movement
            await tx.stockMovement.create({
                data: {
                    productId: med.productId,
                    companyId: req.companyId,
                    movementType: 'adjustment',
                    quantity: Math.abs(variance),
                    balanceBefore: entry.systemStock,
                    balanceAfter: Math.max(0, entry.physicalCount),
                    reason: `Reconciliação: físico ${entry.physicalCount}, sistema ${entry.systemStock}, variação ${variance > 0 ? '+' : ''}${variance}${notes ? `. ${notes}` : ''}`,
                    performedBy: req.userName || 'Sistema',
                    originModule: 'pharmacy'
                }
            });
            results.push({ medicationId: entry.medicationId, variance, adjusted: true });
        }
    });

    res.json({ message: 'Reconciliação concluída', results, adjustedCount: results.filter(r => r.adjusted).length });
});

// ============================================================================
// REPORTS
// ============================================================================

router.get('/reports/sales', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { companyId: req.companyId, status: { not: 'refunded' } };
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) { const e = new Date(endDate as string); e.setHours(23, 59, 59, 999); where.createdAt.lte = e; }
    }

    const [sales, total, byPaymentMethod] = await Promise.all([
        prisma.pharmacySale.findMany({
            where,
            include: {
                customer: { select: { id: true, name: true } },
                items: {
                    include: {
                        batch: { select: { costPrice: true, sellingPrice: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit)
        }),
        prisma.pharmacySale.count({ where }),
        prisma.pharmacySale.groupBy({ by: ['paymentMethod'], where, _sum: { total: true }, _count: { id: true } })
    ]);

    // Compute profitability per sale
    const enrichedSales = sales.map(s => {
        const cost = s.items.reduce((sum, item) => sum + Number(item.batch?.costPrice || 0) * item.quantity, 0);
        const revenue = Number(s.total);
        const profit = revenue - cost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return { ...s, cost, profit, margin: Math.round(margin * 10) / 10 };
    });

    // Aggregate summary
    const totalRevenue = enrichedSales.reduce((s, x) => s + Number(x.total), 0);
    const totalCost = enrichedSales.reduce((s, x) => s + x.cost, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgTicket = enrichedSales.length > 0 ? totalRevenue / enrichedSales.length : 0;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    res.json({
        data: enrichedSales,
        summary: {
            totalRevenue,
            totalCost,
            totalProfit,
            totalTransactions: total,
            avgTicket: Math.round(avgTicket * 100) / 100,
            margin: Math.round(avgMargin * 10) / 10,
            byPaymentMethod
        },
        pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) }
    });
});

router.get('/reports/expiring', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const days = parseInt(req.query.days as string || '90');
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const batches = await prisma.medicationBatch.findMany({
        where: { companyId: req.companyId, status: { not: 'depleted' }, expiryDate: { lte: cutoff } },
        include: { medication: { include: { product: true } } },
        orderBy: { expiryDate: 'asc' }
    });
    res.json(batches);
});

router.get('/reports/stock', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { page = 1, limit = 100, lowStock } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { product: { companyId: req.companyId, originModule: 'pharmacy' } };

    const [medications, total] = await Promise.all([
        prisma.medication.findMany({
            where,
            include: {
                product: true,
                batches: { where: { status: { not: 'depleted' } }, orderBy: { expiryDate: 'asc' } }
            },
            orderBy: { product: { name: 'asc' } },
            skip,
            take: Number(limit)
        }),
        prisma.medication.count({ where })
    ]);

    let data = medications.map(m => {
        const totalStock = m.product.currentStock;
        const isLowStock = totalStock <= (m.product.minStock || 5);
        const totalValue = totalStock * Number(m.product.price);
        const totalCost = totalStock * Number(m.product.costPrice || 0);
        const nearestBatch = m.batches[0];
        const daysToExpiry = nearestBatch
            ? Math.ceil((new Date(nearestBatch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;
        return { ...m, totalStock, isLowStock, totalValue, totalCost, daysToExpiry };
    });

    if (lowStock === 'true') data = data.filter(m => m.isLowStock);

    const summary = {
        totalProducts: total,
        totalStock: data.reduce((s, m) => s + m.totalStock, 0),
        lowStockCount: data.filter(m => m.isLowStock).length,
        totalValue: data.reduce((s, m) => s + m.totalValue, 0),
        totalCost: data.reduce((s, m) => s + m.totalCost, 0)
    };

    res.json({ data, summary, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
});

// ============================================================================
// REPORTS: TOP CUSTOMERS
// ============================================================================

router.get('/reports/top-customers', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { startDate, endDate, limit = 10 } = req.query;

    const where: any = { companyId: req.companyId, status: { not: 'refunded' }, customerId: { not: null } };
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) { const e = new Date(endDate as string); e.setHours(23,59,59,999); where.createdAt.lte = e; }
    }

    const grouped = await prisma.pharmacySale.groupBy({
        by: ['customerId', 'customerName'],
        where,
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: Number(limit)
    });

    res.json(grouped.map(g => ({
        customerId: g.customerId,
        customerName: g.customerName,
        totalSpent: Number(g._sum.total || 0),
        transactions: g._count.id
    })));
});

// ============================================================================
// REPORTS: SUPPLIER ANALYSIS
// ============================================================================

router.get('/reports/suppliers', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');

    // Get batches grouped by supplier with cost data
    const batches = await prisma.medicationBatch.findMany({
        where: { companyId: req.companyId, supplier: { not: null } },
        include: { medication: { include: { product: { select: { name: true, code: true } } } } },
        orderBy: { receivedDate: 'desc' }
    });

    // Group by supplier
    const supplierMap: Record<string, { supplier: string; totalBatches: number; totalUnits: number; totalCost: number; medications: Set<string> }> = {};
    for (const b of batches) {
        const key = b.supplier!;
        if (!supplierMap[key]) supplierMap[key] = { supplier: key, totalBatches: 0, totalUnits: 0, totalCost: 0, medications: new Set() };
        supplierMap[key].totalBatches++;
        supplierMap[key].totalUnits += b.quantity;
        supplierMap[key].totalCost += Number(b.costPrice) * b.quantity;
        supplierMap[key].medications.add(b.medication.product.name);
    }

    res.json(Object.values(supplierMap).map(s => ({
        ...s,
        medications: Array.from(s.medications),
        medicationCount: s.medications.size
    })).sort((a, b) => b.totalCost - a.totalCost));
});

// ============================================================================
// PRICE HISTORY (via batch history)
// ============================================================================

router.get('/medications/:id/price-history', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');

    const medication = await prisma.medication.findFirst({
        where: { id: req.params.id, product: { companyId: req.companyId } }
    });
    if (!medication) throw ApiError.notFound('Medicamento não encontrado');

    const batches = await prisma.medicationBatch.findMany({
        where: { medicationId: req.params.id },
        select: { batchNumber: true, receivedDate: true, costPrice: true, sellingPrice: true, quantity: true, supplier: true, invoiceNumber: true },
        orderBy: { receivedDate: 'asc' }
    });

    // Build price history: detect price changes
    const history = batches.map(b => ({
        date: b.receivedDate,
        batchNumber: b.batchNumber,
        costPrice: Number(b.costPrice),
        sellingPrice: Number(b.sellingPrice),
        quantity: b.quantity,
        supplier: b.supplier,
        invoiceNumber: b.invoiceNumber,
        margin: Number(b.sellingPrice) > 0
            ? Math.round(((Number(b.sellingPrice) - Number(b.costPrice)) / Number(b.sellingPrice)) * 1000) / 10
            : 0
    }));

    res.json(history);
});

// ============================================================================
// INTELLIGENT ALERTS
// ============================================================================

router.get('/alerts', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');

    const now = new Date();
    const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const in90days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const [
        criticalExpiry,
        warningExpiry,
        lowStockMeds,
        outOfStockMeds,
        activeRecalls,
        pendingPrescriptions,
        narcoticDiscrepancies,
        belowReorderMeds
    ] = await Promise.all([
        // Expiring in < 30 days
        prisma.medicationBatch.findMany({
            where: { companyId: req.companyId, status: { not: 'depleted' }, expiryDate: { lte: in30days, gte: now } },
            include: { medication: { include: { product: { select: { name: true, code: true } } } } },
            orderBy: { expiryDate: 'asc' },
            take: 10
        }),
        // Expiring in 30-90 days
        prisma.medicationBatch.findMany({
            where: { companyId: req.companyId, status: { not: 'depleted' }, expiryDate: { gt: in30days, lte: in90days } },
            include: { medication: { include: { product: { select: { name: true, code: true } } } } },
            orderBy: { expiryDate: 'asc' },
            take: 10
        }),
        // Low stock
        prisma.medication.findMany({
            where: { product: { companyId: req.companyId, currentStock: { gt: 0 } } },
            include: { product: { select: { name: true, code: true, currentStock: true, minStock: true } } },
            take: 20
        }).then(meds => meds.filter(m => m.product.currentStock > 0 && m.product.currentStock <= (m.product.minStock || 5))),
        // Out of stock
        prisma.medication.findMany({
            where: { product: { companyId: req.companyId, currentStock: 0 } },
            include: { product: { select: { name: true, code: true, currentStock: true } } },
            take: 10
        }),
        // Active recalls
        prisma.batchRecall.findMany({
            where: { companyId: req.companyId, status: 'active' },
            include: { medication: { include: { product: { select: { name: true } } } } },
            take: 5
        }),
        // Pending prescriptions
        prisma.prescription.count({ where: { companyId: req.companyId, status: 'pending' } }),
        // Narcotic discrepancies (last 7 days)
        prisma.narcoticRegister.findMany({
            where: { companyId: req.companyId, discrepancy: { gt: 0 }, registerDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            orderBy: { registerDate: 'desc' },
            take: 5
        }),
        // Below reorder point
        prisma.medication.findMany({
            where: { product: { companyId: req.companyId } },
            include: { product: { select: { name: true, code: true, currentStock: true } } }
        }).then(meds => meds.filter(m => m.product.currentStock <= m.reorderPoint))
    ]);

    const alerts = [];

    // CRITICAL: Out of stock
    for (const m of outOfStockMeds) {
        alerts.push({ type: 'out_of_stock', severity: 'critical', title: 'Sem Stock', message: `${m.product.name} está sem stock`, medicationId: m.id, productName: m.product.name });
    }

    // CRITICAL: Expiring in < 30 days
    for (const b of criticalExpiry) {
        const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        alerts.push({ type: 'expiring_critical', severity: 'critical', title: 'Validade Crítica', message: `Lote ${b.batchNumber} de ${b.medication.product.name} expira em ${days} dias`, batchId: b.id, productName: b.medication.product.name, expiryDate: b.expiryDate });
    }

    // CRITICAL: Active recalls
    for (const r of activeRecalls) {
        alerts.push({ type: 'recall', severity: 'critical', title: 'Recall Activo', message: `Recall ${r.recallNumber} -- ${r.medication.product.name}: ${r.reason}`, recallId: r.id, productName: r.medication.product.name });
    }

    // CRITICAL: Narcotic discrepancies
    for (const n of narcoticDiscrepancies) {
        alerts.push({ type: 'narcotic_discrepancy', severity: 'critical', title: 'Discrepância Narcóticos', message: `${n.medicationName} -- discrepância de ${n.discrepancy} unidades em ${new Date(n.registerDate).toLocaleDateString('pt-BR')}`, registerId: n.id });
    }

    // WARNING: Low stock
    for (const m of lowStockMeds) {
        alerts.push({ type: 'low_stock', severity: 'warning', title: 'Stock Baixo', message: `${m.product.name}: ${m.product.currentStock} unidades (mínimo: ${m.product.minStock || 5})`, medicationId: m.id, productName: m.product.name });
    }

    // WARNING: Expiring in 30-90 days
    for (const b of warningExpiry) {
        const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        alerts.push({ type: 'expiring_warning', severity: 'warning', title: 'Validade Próxima', message: `Lote ${b.batchNumber} de ${b.medication.product.name} expira em ${days} dias`, batchId: b.id, productName: b.medication.product.name, expiryDate: b.expiryDate });
    }

    // INFO: Pending prescriptions
    if (pendingPrescriptions > 0) {
        alerts.push({ type: 'pending_prescriptions', severity: 'info', title: 'Receitas Pendentes', message: `${pendingPrescriptions} receita(s) aguardam dispensa` });
    }

    // INFO: Below reorder point
    for (const m of belowReorderMeds) {
        if (m.product.currentStock <= m.reorderPoint) {
            alerts.push({ type: 'reorder', severity: 'info', title: 'Ponto de Reposição', message: `${m.product.name}: stock ${m.product.currentStock} ≤ ponto de reposição ${m.reorderPoint}`, medicationId: m.id, productName: m.product.name, reorderQuantity: m.reorderQuantity });
        }
    }

    res.json({
        alerts,
        summary: {
            critical: alerts.filter(a => a.severity === 'critical').length,
            warning: alerts.filter(a => a.severity === 'warning').length,
            info: alerts.filter(a => a.severity === 'info').length,
            total: alerts.length
        }
    });
});

// ============================================================================
// REORDER SUGGESTIONS (Supplier integration)
// ============================================================================

router.get('/reorder-suggestions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');

    const medications = await prisma.medication.findMany({
        where: { product: { companyId: req.companyId, originModule: 'pharmacy' } },
        include: {
            product: {
                include: { supplier: { select: { id: true, name: true, email: true, phone: true } } }
            }
        }
    });

    const suggestions = medications
        .filter(m => m.product.currentStock <= m.reorderPoint)
        .map(m => ({
            medicationId: m.id,
            productId: m.product.id,
            productCode: m.product.code,
            productName: m.product.name,
            currentStock: m.product.currentStock,
            reorderPoint: m.reorderPoint,
            reorderQuantity: m.reorderQuantity,
            supplier: m.product.supplier,
            estimatedCost: m.reorderQuantity * Number(m.product.costPrice || 0),
            urgency: m.product.currentStock === 0 ? 'critical' : m.product.currentStock <= Math.floor(m.reorderPoint / 2) ? 'high' : 'medium'
        }))
        .sort((a, b) => (a.urgency === 'critical' ? -3 : a.urgency === 'high' ? -1 : 0) - (b.urgency === 'critical' ? -3 : b.urgency === 'high' ? -1 : 0));

    const totalEstimatedCost = suggestions.reduce((s, x) => s + x.estimatedCost, 0);

    res.json({ suggestions, totalEstimatedCost, count: suggestions.length });
});

export default router;
