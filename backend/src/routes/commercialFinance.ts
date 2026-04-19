import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { commercialFinanceService } from '../services/commercialFinanceService';
import { commercialTransactionSchema, updateCommercialTransactionSchema } from '../validation/commercial-finance';
import { ApiError } from '../middleware/error.middleware';

const router = Router();
router.use(authenticate);

// DASHBOARD
router.get('/dashboard', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { period = '1m' } = req.query;
    res.json(await commercialFinanceService.getDashboard(req.companyId, period as string));
});

// TRANSACTIONS
router.get('/transactions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await commercialFinanceService.getTransactions(req.companyId, req.query));
});

router.post('/transactions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = commercialTransactionSchema.parse(req.body);
    res.status(201).json(await commercialFinanceService.createTransaction(req.companyId, validatedData));
});

router.put('/transactions/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = updateCommercialTransactionSchema.parse(req.body);
    res.json(await commercialFinanceService.updateTransaction(req.params.id, req.companyId, validatedData));
});

router.delete('/transactions/:id', authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    await commercialFinanceService.deleteTransaction(req.params.id, req.companyId);
    res.json({ message: 'Transação eliminada com sucesso' });
});

export default router;
