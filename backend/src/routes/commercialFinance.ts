import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { commercialFinanceService } from '../services/commercialFinanceService';
import {
    commercialFinancePeriodSchema,
    commercialTransactionSchema,
    commercialTransactionsQuerySchema,
    updateCommercialTransactionSchema,
} from '../validation/commercialFinance';
import { ApiError } from '../middleware/error.middleware';

import { requireModule } from '../middleware/module';

const router = Router();
router.use(authenticate);
router.use(requireModule('COMMERCIAL'));

const FINANCE_ROLES = ['super_admin', 'admin', 'manager'] as const;

// DASHBOARD
router.get('/dashboard', authorize(...FINANCE_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const period = commercialFinancePeriodSchema.parse(req.query.period);
    res.json(await commercialFinanceService.getDashboard(req.companyId, period));
});

// TRANSACTIONS
router.get('/transactions', authorize(...FINANCE_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const query = commercialTransactionsQuerySchema.parse(req.query);
    res.json(await commercialFinanceService.getTransactions(req.companyId, query));
});

router.post('/transactions', authorize(...FINANCE_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = commercialTransactionSchema.parse(req.body);
    res.status(201).json(await commercialFinanceService.createTransaction(req.companyId, validatedData, req.userId, req.userName));
});

router.put('/transactions/:id', authorize(...FINANCE_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = updateCommercialTransactionSchema.parse(req.body);
    res.json(await commercialFinanceService.updateTransaction(req.params.id, req.companyId, validatedData, req.userId, req.userName));
});

router.delete('/transactions/:id', authorize(...FINANCE_ROLES), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    await commercialFinanceService.deleteTransaction(req.params.id, req.companyId, req.userId, req.userName);
    res.json({ message: 'Transação eliminada com sucesso' });
});

export default router;
