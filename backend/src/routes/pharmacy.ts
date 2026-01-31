import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { PharmacyService } from '../services/pharmacy.service';
import {
    createMedicationSchema,
    updateMedicationSchema,
    createBatchSchema,
    createPharmacySaleSchema,
    createPrescriptionSchema,
    createPartnerSchema,
    updatePartnerSchema,
    formatZodError,
    ZodError
} from '../validation';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

const router = Router();
router.use(authenticate);

// MEDICATIONS
router.get('/medications', async (req: Request, res: Response) => {
    try {
        const medications = await PharmacyService.getMedications((req as AuthRequest).companyId!, req.query);
        res.json(medications);
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error fetching medications:', err);
        res.status(500).json({ message: err.message || 'Erro ao buscar medicamentos' });
    }
});

router.post('/medications', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = createMedicationSchema.parse(req.body);

        const medication = await PharmacyService.createMedication(authReq.companyId!, validatedData);

        // Audit log
        await prisma.auditLog.create({
            data: {
                action: 'CREATE',
                entity: 'Medication',
                entityId: medication.id,
                userId: authReq.userId,
                userName: authReq.userName || 'Sistema',
                newData: validatedData as any,
                companyId: authReq.companyId
            }
        });

        logger.info(`Medication created: ${medication.id} by ${authReq.userName}`);
        res.status(201).json(medication);
    } catch (error: unknown) {
        const err = error as Error;
        if (err instanceof ZodError) {
            return res.status(400).json({ message: 'Dados inválidos', details: formatZodError(err) });
        }
        logger.error('Error creating medication:', err);
        res.status(400).json({ message: err.message || 'Erro ao criar medicamento' });
    }
});

router.put('/medications/:id', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = updateMedicationSchema.parse(req.body);

        const medication = await PharmacyService.updateMedication(
            req.params.id,
            authReq.companyId!,
            validatedData
        );

        // Audit log
        await prisma.auditLog.create({
            data: {
                action: 'UPDATE',
                entity: 'Medication',
                entityId: req.params.id,
                userId: authReq.userId,
                userName: authReq.userName || 'Sistema',
                newData: validatedData as any,
                companyId: authReq.companyId
            }
        });

        res.json(medication);
    } catch (error: unknown) {
        const err = error as Error;
        if (err instanceof ZodError) {
            return res.status(400).json({ message: 'Dados inválidos', details: formatZodError(err) });
        }
        logger.error('Error updating medication:', err);
        res.status(500).json({ message: 'Erro ao atualizar medicamento' });
    }
});

router.delete('/medications/:id', async (req: Request, res: Response) => {
    try {
        await PharmacyService.deleteMedication(
            req.params.id,
            (req as AuthRequest).companyId!
        );
        res.json({ message: 'Medicamento eliminado com sucesso' });
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Error deleting medication:', err);
        res.status(400).json({ message: err.message || 'Erro ao eliminar medicamento' });
    }
});

// BATCHES
router.get('/batches', async (req: Request, res: Response) => {
    try {
        const batches = await PharmacyService.getBatches((req as AuthRequest).companyId!, req.query);
        res.json(batches);
    } catch (error: unknown) {
        console.error('Error fetching batches:', error);
        res.status(500).json({ message: 'Erro ao buscar lotes' });
    }
});

router.post('/batches', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = createBatchSchema.parse(req.body);

        const batch = await PharmacyService.createBatch(
            authReq.companyId!,
            validatedData,
            authReq.userName || 'Sistema'
        );

        // Audit log
        await prisma.auditLog.create({
            data: {
                action: 'CREATE',
                entity: 'MedicationBatch',
                entityId: batch.id,
                userId: authReq.userId,
                userName: authReq.userName || 'Sistema',
                newData: validatedData as any,
                companyId: authReq.companyId
            }
        });

        logger.info(`Batch created: ${batch.id} by ${authReq.userName}`);
        res.status(201).json(batch);
    } catch (error: unknown) {
        const err = error as Error;
        if (err instanceof ZodError) {
            return res.status(400).json({ message: 'Dados inválidos', details: formatZodError(err) });
        }
        logger.error('Error creating batch:', err);
        res.status(500).json({ message: err.message || 'Erro ao criar lote' });
    }
});

// PRESCRIPTIONS
router.get('/prescriptions', async (req: Request, res: Response) => {
    try {
        const prescriptions = await PharmacyService.getPrescriptions((req as AuthRequest).companyId!, req.query);
        res.json(prescriptions);
    } catch (error: unknown) {
        logger.error('Error fetching prescriptions:', error);
        res.status(500).json({ message: 'Erro ao buscar receitas' });
    }
});

router.post('/prescriptions', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = createPrescriptionSchema.parse(req.body);

        const prescription = await PharmacyService.createPrescription(authReq.companyId!, validatedData);

        // Audit log
        await prisma.auditLog.create({
            data: {
                action: 'CREATE',
                entity: 'Prescription',
                entityId: prescription.id,
                userId: authReq.userId,
                userName: authReq.userName || 'Sistema',
                newData: validatedData as any,
                companyId: authReq.companyId
            }
        });

        logger.info(`Prescription created: ${prescription.id} by ${authReq.userName}`);
        res.status(201).json(prescription);
    } catch (error: unknown) {
        const err = error as Error;
        if (err instanceof ZodError) {
            return res.status(400).json({ message: 'Dados inválidos', details: formatZodError(err) });
        }
        logger.error('Error creating prescription:', err);
        res.status(500).json({ message: err.message || 'Erro ao criar receita' });
    }
});

// SALES
router.get('/sales', async (req: Request, res: Response) => {
    try {
        const sales = await PharmacyService.getSales((req as AuthRequest).companyId!, req.query);
        res.json(sales);
    } catch (error: unknown) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ message: 'Erro ao buscar vendas' });
    }
});

router.post('/sales', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = createPharmacySaleSchema.parse(req.body);

        // Verificar se medicamentos controlados requerem prescrição
        const items = validatedData.items;
        for (const item of items) {
            const batch = await prisma.medicationBatch.findFirst({
                where: { id: item.batchId },
                include: { medication: { include: { product: true } } }
            });

            if (batch?.medication?.requiresPrescription && !validatedData.prescriptionId) {
                return res.status(400).json({
                    message: `Medicamento "${batch.medication.product?.name || item.batchId}" requer prescrição médica`
                });
            }

            if (batch?.medication?.isControlled && !validatedData.prescriptionId) {
                return res.status(400).json({
                    message: `Medicamento controlado "${batch.medication.product?.name || item.batchId}" requer prescrição médica obrigatória`
                });
            }
        }

        const sale = await PharmacyService.createSale(
            authReq.companyId!,
            validatedData,
            authReq.userName || 'Sistema'
        );

        // Audit log
        await prisma.auditLog.create({
            data: {
                action: 'CREATE',
                entity: 'PharmacySale',
                entityId: sale.id,
                userId: authReq.userId,
                userName: authReq.userName || 'Sistema',
                newData: { saleNumber: sale.saleNumber, total: sale.total, itemCount: items.length } as any,
                companyId: authReq.companyId
            }
        });

        logger.info(`Pharmacy sale created: ${sale.saleNumber} by ${authReq.userName}`);
        res.status(201).json(sale);
    } catch (error: unknown) {
        const err = error as Error;
        if (err instanceof ZodError) {
            return res.status(400).json({ message: 'Dados inválidos', details: formatZodError(err) });
        }
        logger.error('Error creating sale:', err);
        res.status(500).json({ message: err.message || 'Erro ao criar venda' });
    }
});

// STOCK MOVEMENTS
router.get('/stock-movements', async (req: Request, res: Response) => {
    try {
        const movements = await PharmacyService.getStockMovements((req as AuthRequest).companyId!, req.query);
        res.json(movements);
    } catch (error: unknown) {
        console.error('Error fetching stock movements:', error);
        res.status(500).json({ message: 'Erro ao buscar movimentos de stock' });
    }
});

// DASHBOARD ENDPOINTS
router.get('/dashboard/summary', async (req: Request, res: Response) => {
    try {
        const companyId = (req as AuthRequest).companyId!;

        // Get sales summary
        const { data: sales } = await PharmacyService.getSales(companyId, { limit: 1000 });
        const { data: medications } = await PharmacyService.getMedications(companyId, { limit: 1000 });

        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum: number, sale: any) => sum + Number(sale.total || 0), 0);
        const totalPrescriptions = sales.filter((sale: any) => sale.hasPrescription).length;
        const lowStockCount = medications.filter((med: any) => med.isLowStock).length;

        res.json({
            totalSales,
            totalRevenue,
            totalPrescriptions,
            lowStockCount,
            totalMedications: medications.length
        });
    } catch (error: unknown) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ message: 'Erro ao buscar resumo do dashboard' });
    }
});

router.get('/dashboard/sales-chart', async (req: Request, res: Response) => {
    try {
        const companyId = (req as AuthRequest).companyId!;
        const period = req.query.period as string || '7days';

        const { data: sales } = await PharmacyService.getSales(companyId, { limit: 1000 });

        // Calculate date range
        const days = period === '7days' ? 7 : 30;
        const now = new Date();
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        // Group sales by date
        const salesByDate: Record<string, number> = {};
        sales.forEach((sale: any) => {
            const saleDate = new Date(sale.createdAt);
            if (saleDate >= startDate) {
                const dateKey = saleDate.toISOString().split('T')[0];
                salesByDate[dateKey] = (salesByDate[dateKey] || 0) + Number(sale.total || 0);
            }
        });

        // Convert to array format
        const chartData = Object.entries(salesByDate).map(([date, total]) => ({
            date,
            total
        })).sort((a, b) => a.date.localeCompare(b.date));

        res.json(chartData);
    } catch (error: unknown) {
        console.error('Error fetching sales chart:', error);
        res.status(500).json({ message: 'Erro ao buscar gráfico de vendas' });
    }
});

router.get('/dashboard/top-products', async (req: Request, res: Response) => {
    try {
        const companyId = (req as AuthRequest).companyId!;
        const limit = parseInt(req.query.limit as string) || 6;

        const { data: sales } = await PharmacyService.getSales(companyId, { limit: 1000 });

        // Count sales by product
        const productSales: Record<string, { name: string; count: number; revenue: number }> = {};

        sales.forEach((sale: any) => {
            sale.items?.forEach((item: any) => {
                const productName = item.productName || 'Produto Desconhecido';
                if (!productSales[productName]) {
                    productSales[productName] = { name: productName, count: 0, revenue: 0 };
                }
                productSales[productName].count += item.quantity || 0;
                productSales[productName].revenue += Number(item.total || 0);
            });
        });

        // Sort by count and get top N
        const topProducts = Object.values(productSales)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

        res.json(topProducts);
    } catch (error: unknown) {
        console.error('Error fetching top products:', error);
        res.status(500).json({ message: 'Erro ao buscar produtos mais vendidos' });
    }
});

// ============================================================================
// REPORTS ENDPOINTS
// ============================================================================

// Sales Report
router.get('/reports/sales', async (req: Request, res: Response) => {
    try {
        const companyId = (req as AuthRequest).companyId!;
        const { startDate, endDate, groupBy = 'day', page = '1', limit = '50' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { companyId };
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) {
                const end = new Date(endDate as string);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        // Parallel execution for better performance
        const [total, sales] = await Promise.all([
            prisma.pharmacySale.count({ where }),
            prisma.pharmacySale.findMany({
                where,
                include: {
                    customer: true,
                    items: { include: { batch: { include: { medication: { include: { product: true } } } } } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        // Calculate metrics (may need optimization if heavy)
        // Note: For large datasets, summary metrics should ideally be separate or cached
        // For now, we calculate them from the filtered set (before pagination) if total is small, 
        // or using dedicated aggregations for performance.

        const summaryMetrics = await prisma.pharmacySale.aggregate({
            where,
            _sum: { total: true, subtotal: true, discount: true },
            _count: { id: true }
        });

        const totalRevenue = Number(summaryMetrics._sum.total || 0);
        const totalSales = summaryMetrics._count.id;
        const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

        // Group by payment method (using aggregate for speed)
        const byPaymentMethodRaw = await prisma.pharmacySale.groupBy({
            by: ['paymentMethod'],
            where,
            _sum: { total: true },
            _count: { id: true }
        });

        const byPaymentMethod: Record<string, { count: number; total: number }> = {};
        byPaymentMethodRaw.forEach(item => {
            byPaymentMethod[item.paymentMethod || 'cash'] = {
                count: item._count.id,
                total: Number(item._sum.total || 0)
            };
        });

        res.json({
            summary: {
                totalSales,
                totalRevenue,
                avgTicket,
                totalDiscount: Number(summaryMetrics._sum.discount || 0)
            },
            byPaymentMethod,
            data: sales,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + sales.length < total
            }
        });
    } catch (error: unknown) {
        logger.error('Error generating sales report:', error);
        res.status(500).json({ message: 'Erro ao gerar relatório de vendas' });
    }
});

// Stock Report
router.get('/reports/stock', async (req: Request, res: Response) => {
    try {
        const companyId = (req as AuthRequest).companyId!;
        const { lowStock, expiring, expiringDays = '30', page = '1', limit = '50' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Base filter: medications belonging to this company's pharmacy
        const where: any = {
            product: {
                companyId,
                origin_module: 'pharmacy'
            }
        };

        // Handling filters that affect the set before pagination
        if (lowStock === 'true') {
            where.product.currentStock = { lte: 5 }; // Simplified, should ideally use minStock
        }

        const [total, medications] = await Promise.all([
            prisma.medication.count({ where }),
            prisma.medication.findMany({
                where,
                include: {
                    product: true,
                    batches: { where: { status: { not: 'depleted' } }, orderBy: { expiryDate: 'asc' } }
                },
                skip,
                take: limitNum,
                orderBy: { product: { name: 'asc' } }
            })
        ]);

        const expiryThreshold = new Date();
        expiryThreshold.setDate(expiryThreshold.getDate() + parseInt(expiringDays as string));

        let stockData = medications.map(med => {
            const totalStock = med.batches.reduce((sum, b) => sum + b.quantityAvailable, 0);
            const totalValue = med.batches.reduce((sum, b) => sum + (b.quantityAvailable * Number(b.sellingPrice)), 0);
            const nearestExpiry = med.batches[0]?.expiryDate;
            const isLowStock = totalStock <= (med.product?.minStock || 5);
            const isExpiring = nearestExpiry && new Date(nearestExpiry) <= expiryThreshold;

            return {
                id: med.id,
                productId: med.productId,
                name: med.product?.name || 'Desconhecido',
                code: med.product?.code,
                totalStock,
                totalValue,
                minStock: med.product?.minStock || 5,
                isLowStock,
                isExpiring,
                nearestExpiry,
                batchCount: med.batches.length,
                requiresPrescription: med.requiresPrescription,
                isControlled: med.isControlled
            };
        });

        // Calculate global summary metrics (independent of pagination)
        const summaryMetrics = await prisma.medication.aggregate({
            where: { product: { companyId, origin_module: 'pharmacy' } },
            _count: { id: true }
        });

        // For more complex metrics like totalValue or totalItems, we might need a raw query or more processing
        // but for now we'll return what we can easily aggregate.

        res.json({
            summary: {
                totalMedications: summaryMetrics._count.id,
                // These could be approximated or calculated separately if critical
            },
            data: stockData,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + medications.length < total
            }
        });
    } catch (error: unknown) {
        logger.error('Error generating stock report:', error);
        res.status(500).json({ message: 'Erro ao gerar relatório de stock' });
    }
});

// Expiring Stock Report  
router.get('/reports/expiring', async (req: Request, res: Response) => {
    try {
        const companyId = (req as AuthRequest).companyId!;
        const days = parseInt(req.query.days as string) || 30;

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);

        const batches = await prisma.medicationBatch.findMany({
            where: {
                medication: { product: { companyId } },
                status: { not: 'depleted' },
                expiryDate: { lte: expiryDate }
            },
            include: { medication: { include: { product: true } } },
            orderBy: { expiryDate: 'asc' }
        });

        const data = batches.map(b => ({
            batchId: b.id,
            batchNumber: b.batchNumber,
            medicationName: b.medication.product?.name,
            quantity: b.quantityAvailable,
            expiryDate: b.expiryDate,
            daysToExpiry: Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            value: b.quantityAvailable * Number(b.sellingPrice)
        }));

        const expiredCount = data.filter(d => d.daysToExpiry <= 0).length;
        const totalValue = data.reduce((sum, d) => sum + d.value, 0);

        res.json({
            summary: { totalBatches: data.length, expiredCount, totalValue, thresholdDays: days },
            data
        });
    } catch (error: unknown) {
        logger.error('Error generating expiring stock report:', error);
        res.status(500).json({ message: 'Erro ao gerar relatório de validade' });
    }
});

// ============================================================================
// CSV EXPORT ENDPOINTS
// ============================================================================

// Export Sales to CSV
router.get('/export/sales', async (req: Request, res: Response) => {
    try {
        const companyId = (req as AuthRequest).companyId!;
        const { startDate, endDate } = req.query;

        const where: any = { companyId };
        if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate as string) };
        if (endDate) {
            const end = new Date(endDate as string);
            end.setHours(23, 59, 59, 999);
            where.createdAt = { ...where.createdAt, lte: end };
        }

        const sales = await prisma.pharmacySale.findMany({
            where,
            include: { customer: true, items: true },
            orderBy: { createdAt: 'desc' }
        });

        // Generate CSV
        const headers = ['Numero', 'Data', 'Cliente', 'Subtotal', 'Desconto', 'Total', 'Metodo Pagamento', 'Vendedor', 'Itens'];
        const rows = sales.map(s => [
            s.saleNumber,
            new Date(s.createdAt).toISOString().split('T')[0],
            s.customerName || 'Cliente Balcao',
            Number(s.subtotal).toFixed(2),
            Number(s.discount).toFixed(2),
            Number(s.total).toFixed(2),
            s.paymentMethod,
            s.soldBy,
            s.items.length
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=vendas_farmacia_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (error: unknown) {
        logger.error('Error exporting sales:', error);
        res.status(500).json({ message: 'Erro ao exportar vendas' });
    }
});

// Export Stock to CSV
router.get('/export/stock', async (req: Request, res: Response) => {
    try {
        const companyId = (req as AuthRequest).companyId!;

        const medications = await prisma.medication.findMany({
            where: { product: { companyId, origin_module: 'pharmacy' } },
            include: {
                product: true,
                batches: { where: { status: { not: 'depleted' } } }
            }
        });

        const headers = ['Codigo', 'Nome', 'Stock Total', 'Stock Minimo', 'Baixo Stock', 'Requer Prescricao', 'Controlado', 'Lotes Ativos', 'Validade Proxima'];
        const rows = medications.map(med => {
            const totalStock = med.batches.reduce((sum, b) => sum + b.quantityAvailable, 0);
            const nearestExpiry = med.batches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0]?.expiryDate;
            return [
                med.product?.code || '',
                med.product?.name || '',
                totalStock,
                med.product?.minStock || 5,
                totalStock <= (med.product?.minStock || 5) ? 'Sim' : 'Nao',
                med.requiresPrescription ? 'Sim' : 'Nao',
                med.isControlled ? 'Sim' : 'Nao',
                med.batches.length,
                nearestExpiry ? new Date(nearestExpiry).toISOString().split('T')[0] : 'N/A'
            ];
        });

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=stock_farmacia_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (error: unknown) {
        logger.error('Error exporting stock:', error);
        res.status(500).json({ message: 'Erro ao exportar stock' });
    }
});

// PARTNERS
router.get('/partners', async (req: Request, res: Response) => {
    try {
        const partners = await PharmacyService.getPartners((req as AuthRequest).companyId!, req.query);
        res.json(partners);
    } catch (error: unknown) {
        logger.error('Error fetching partners:', error);
        res.status(500).json({ message: 'Erro ao buscar parceiros' });
    }
});

router.post('/partners', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = createPartnerSchema.parse(req.body);
        const partner = await PharmacyService.createPartner(authReq.companyId!, validatedData);

        // Audit log
        await prisma.auditLog.create({
            data: {
                action: 'CREATE',
                entity: 'PharmacyPartner',
                entityId: partner.id,
                userId: authReq.userId,
                userName: authReq.userName || 'Sistema',
                newData: validatedData as any,
                companyId: authReq.companyId
            }
        });

        res.status(201).json(partner);
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: 'Dados inválidos', details: formatZodError(error) });
        }
        logger.error('Error creating partner:', error);
        res.status(500).json({ message: 'Erro ao criar parceiro' });
    }
});

router.put('/partners/:id', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = updatePartnerSchema.parse(req.body);
        const partner = await PharmacyService.updatePartner(req.params.id, authReq.companyId!, validatedData);

        // Audit log
        await prisma.auditLog.create({
            data: {
                action: 'UPDATE',
                entity: 'PharmacyPartner',
                entityId: req.params.id,
                userId: authReq.userId,
                userName: authReq.userName || 'Sistema',
                newData: validatedData as any,
                companyId: authReq.companyId
            }
        });

        res.json(partner);
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: 'Dados inválidos', details: formatZodError(error) });
        }
        logger.error('Error updating partner:', error);
        res.status(500).json({ message: 'Erro ao atualizar parceiro' });
    }
});

router.delete('/partners/:id', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        await PharmacyService.deletePartner(req.params.id, authReq.companyId!);
        res.json({ message: 'Parceiro removido com sucesso' });
    } catch (error: unknown) {
        logger.error('Error deleting partner:', error);
        res.status(500).json({ message: 'Erro ao remover parceiro' });
    }
});

export default router;
