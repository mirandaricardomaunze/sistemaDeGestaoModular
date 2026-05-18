import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, authorize } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { approvalThresholdsSchema } from '../validation/approvals';
import { invalidateThresholdsCache } from '../services/approvals/thresholds';

const router = Router();

router.get('/company', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const settings = await prisma.companySettings.findFirst({ where: { companyId: req.companyId } });
    if (!settings) {
        const company = await prisma.company.findUnique({ where: { id: req.companyId } });
        return res.json(await prisma.companySettings.create({
            data: {
                companyName: company?.name ?? 'Minha Empresa',
                tradeName: company?.tradeName,
                nuit: company?.nuit,
                phone: company?.phone,
                email: company?.email,
                address: company?.address,
                businessType: company?.businessType ?? 'retail',
                country: 'Moçambique',
                currency: 'MZN',
                companyId: req.companyId,
            },
        }));
    }
    res.json(settings);
});

router.put('/company', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');

    const ALLOWED_FIELDS = [
        'companyName',
        'tradeName',
        'nuit',
        'phone',
        'email',
        'address',
        'city',
        'province',
        'country',
        'logo',
        'ivaRate',
        'currency',
        'businessType',
        'autoPrintReceipt',
        'bankAccounts',
        'printerType',
        'receiptFooter',
        'receiptHeader',
        'thermalPaperWidth',
        'zipCode',
    ];

    const data: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
        if (key in req.body) data[key] = req.body[key];
    }

    // Backwards compatibility with older frontend payloads that used "state".
    if (!('province' in data) && 'state' in req.body) {
        data.province = req.body.state;
    }

    if ('ivaRate' in data) data.ivaRate = Number(data.ivaRate);
    if ('autoPrintReceipt' in data) data.autoPrintReceipt = Boolean(data.autoPrintReceipt);

    const settings = await prisma.$transaction(async (tx) => {
        const updatedSettings = await tx.companySettings.upsert({
            where: { companyId: req.companyId },
            update: data,
            create: {
                companyName: (data.companyName as string) ?? 'Minha Empresa',
                country: (data.country as string) ?? 'Moçambique',
                currency: (data.currency as string) ?? 'MZN',
                ...data,
                companyId: req.companyId,
            },
        });

        const companyData: Record<string, unknown> = {};
        if ('companyName' in data) companyData.name = data.companyName;
        for (const key of ['tradeName', 'nuit', 'phone', 'email', 'address', 'businessType']) {
            if (key in data) companyData[key] = data[key];
        }
        if (Object.keys(companyData).length > 0) {
            await tx.company.update({
                where: { id: req.companyId },
                data: companyData,
            });
        }

        return updatedSettings;
    });

    res.json(settings);
});

// Approval thresholds (per-company configuration of when actions need manager approval)
router.get('/approval-thresholds', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const settings = await prisma.companySettings.findUnique({
        where: { companyId: req.companyId },
        select: { approvalThresholds: true },
    });
    res.json(settings?.approvalThresholds ?? {});
});

router.put('/approval-thresholds', authenticate, authorize('admin', 'super_admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const validated = approvalThresholdsSchema.parse(req.body);
    const updated = await prisma.companySettings.update({
        where: { companyId: req.companyId },
        data: { approvalThresholds: validated as unknown as Prisma.InputJsonValue },
        select: { approvalThresholds: true },
    });
    invalidateThresholdsCache(req.companyId);
    res.json(updated.approvalThresholds);
});

// Category Management
router.get('/categories', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const categories = await prisma.category.findMany({
        where: { companyId: req.companyId },
        include: { _count: { select: { children: true, products: true } } },
        orderBy: { name: 'asc' }
    });
    
    // Map _count.products to productCount for frontend compatibility
    const mappedCategories = categories.map(cat => ({
        ...cat,
        productCount: cat._count.products,
        _count: undefined // Clean up internal Prisma count if not needed, or keep it
    }));

    res.json(mappedCategories);
});

router.post('/categories', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { name, description, code, parentId, color } = req.body;

    const category = await prisma.category.create({
        data: {
            name,
            description,
            code: code || `CAT-${Date.now()}`,
            parentId,
            color,
            companyId: req.companyId
        }
    });
    res.json(category);
});

router.put('/categories/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { name, description, code, color, parentId } = req.body;
    const category = await prisma.category.updateMany({
        where: { id: req.params.id, companyId: req.companyId },
        data: { name, description, code, color, parentId }
    });
    if (category.count === 0) throw ApiError.notFound('Categoria não encontrada');
    res.json({ message: 'Categoria atualizada' });
});

router.delete('/categories/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const category = await prisma.category.deleteMany({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (category.count === 0) throw ApiError.notFound('Categoria não encontrada');
    res.json({ message: 'Categoria removida' });
});

// Alert Configuration
router.get('/alert-config', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    let config = await prisma.alertConfig.findUnique({ where: { companyId: req.companyId } });
    if (!config) {
        config = await prisma.alertConfig.create({
            data: { companyId: req.companyId }
        });
    }
    res.json(config);
});

router.put('/alert-config', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const {
        lowStockEnabled, expiryEnabled, lowStockThreshold, expiryDays,
        alertEmail, smsEnabled, telegramEnabled, emailEnabled
    } = req.body;
    const safeData = {
        lowStockEnabled, expiryEnabled, lowStockThreshold, expiryDays,
        alertEmail, smsEnabled, telegramEnabled, emailEnabled
    };
    const config = await prisma.alertConfig.upsert({
        where: { companyId: req.companyId },
        update: safeData,
        create: { ...safeData, companyId: req.companyId }
    });
    res.json(config);
});

export default router;
