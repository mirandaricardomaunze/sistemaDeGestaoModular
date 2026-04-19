import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logisticsFinanceService } from '../services/logisticsFinanceService';
import { logisticsTransactionSchema, updateLogisticsTransactionSchema } from '../validation/logisticsFinance';
import { ApiError } from '../middleware/error.middleware';

const router = Router();
router.use(authenticate);

// DASHBOARD
router.get('/dashboard', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { period = '1m' } = req.query;
    res.json(await logisticsFinanceService.getDashboard(req.companyId, period as string));
});

// TRANSACTIONS
router.get('/transactions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await logisticsFinanceService.getTransactions(req.companyId, req.query));
});

router.post('/transactions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = logisticsTransactionSchema.parse(req.body);
    res.status(201).json(await logisticsFinanceService.createTransaction(req.companyId, validatedData));
});

router.put('/transactions/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = updateLogisticsTransactionSchema.parse(req.body);
    res.json(await logisticsFinanceService.updateTransaction(req.params.id, req.companyId, validatedData));
});

router.delete('/transactions/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    await logisticsFinanceService.deleteTransaction(req.params.id, req.companyId);
    res.json({ message: 'Transação eliminada com sucesso' });
});

export default router;
