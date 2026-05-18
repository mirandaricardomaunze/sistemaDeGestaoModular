import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { bottleStoreFinanceService } from '../services/bottleStoreFinanceService';
import { bottleStoreTransactionSchema, updateBottleStoreTransactionSchema } from '../validation/bottleStoreFinance';
import { ApiError } from '../middleware/error.middleware';

import { requireModule } from '../middleware/module';

const router = Router();
router.use(authenticate);
router.use(requireModule('BOTTLE_STORE'));

const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'operator'] as const;
const MANAGER_ROLES = ['super_admin', 'admin', 'manager'] as const;

// DASHBOARD
router.get('/dashboard', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { period = '1m' } = req.query;
    res.json(await bottleStoreFinanceService.getDashboard(req.companyId, period as string));
});

// TRANSACTIONS
router.get('/transactions', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await bottleStoreFinanceService.getTransactions(req.companyId, req.query));
});

router.post('/transactions', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = bottleStoreTransactionSchema.parse(req.body);
    res.status(201).json(await bottleStoreFinanceService.createTransaction(req.companyId, validatedData));
});

router.put('/transactions/:id', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = updateBottleStoreTransactionSchema.parse(req.body);
    res.json(await bottleStoreFinanceService.updateTransaction(req.params.id, req.companyId, validatedData));
});

router.delete('/transactions/:id', authorize(...MANAGER_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    await bottleStoreFinanceService.deleteTransaction(req.params.id, req.companyId);
    res.json({ message: 'Transação eliminada com sucesso' });
});

export default router;
