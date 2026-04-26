import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { restaurantFinanceService } from '../services/restaurantFinanceService';
import { restaurantTransactionSchema, updateRestaurantTransactionSchema } from '../validation/restaurantFinance';
import { ApiError } from '../middleware/error.middleware';

import { requireModule } from '../middleware/module';

const router = Router();
router.use(authenticate);
router.use(requireModule('RESTAURANT'));

// DASHBOARD
router.get('/dashboard', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { period = '1m' } = req.query;
    res.json(await restaurantFinanceService.getDashboard(req.companyId, period as string));
});

// TRANSACTIONS
router.get('/transactions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    res.json(await restaurantFinanceService.getTransactions(req.companyId, req.query));
});

router.post('/transactions', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = restaurantTransactionSchema.parse(req.body);
    res.status(201).json(await restaurantFinanceService.createTransaction(req.companyId, validatedData));
});

router.put('/transactions/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = updateRestaurantTransactionSchema.parse(req.body);
    res.json(await restaurantFinanceService.updateTransaction(req.params.id, req.companyId, validatedData));
});

router.delete('/transactions/:id', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    await restaurantFinanceService.deleteTransaction(req.params.id, req.companyId);
    res.json({ message: 'Transação eliminada com sucesso' });
});

export default router;
