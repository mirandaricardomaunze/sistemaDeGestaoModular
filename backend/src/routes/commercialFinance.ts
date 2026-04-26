import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { commercialFinanceService } from '../services/commercialFinanceService';
import { commercialTransactionSchema, updateCommercialTransactionSchema } from '../validation/commercialFinance';
import { ApiError } from '../middleware/error.middleware';

import { requireModule } from '../middleware/module';

const router = Router();
router.use(authenticate);
router.use(requireModule('COMMERCIAL'));

// DASHBOARD
router.get('/dashboard', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { period = '1m' } = req.query;
    res.json(await commercialFinanceService.getDashboard(req.companyId, period as string));
});

// TRANSACTIONS
router.get('/transactions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await commercialFinanceService.getTransactions(req.companyId, req.query));
});

router.post('/transactions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = commercialTransactionSchema.parse(req.body);
    res.status(201).json(await commercialFinanceService.createTransaction(req.companyId, validatedData));
});

router.put('/transactions/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = updateCommercialTransactionSchema.parse(req.body);
    res.json(await commercialFinanceService.updateTransaction(req.params.id, req.companyId, validatedData));
});

router.delete('/transactions/:id', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    await commercialFinanceService.deleteTransaction(req.params.id, req.companyId);
    res.json({ message: 'Transação eliminada com sucesso' });
});

export default router;
