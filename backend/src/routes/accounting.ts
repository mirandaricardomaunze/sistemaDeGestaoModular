import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { accountingService } from '../services/accountingService';
import {
    AccountSchema,
    BalanceSheetQuerySchema,
    JournalEntrySchema,
    ReportPeriodSchema
} from '../validation/accounting.validation';

const router = Router();

router.get('/accounts', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const accounts = await accountingService.listAccounts(req.companyId);
    res.json({ success: true, data: accounts });
});

router.post('/accounts', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const data = AccountSchema.parse(req.body);
    const account = await accountingService.createAccount(req.companyId, data);
    res.status(201).json({ success: true, data: account });
});

router.post('/accounts/seed-default', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const accounts = await accountingService.seedDefaultChart(req.companyId);
    res.json({ success: true, data: accounts });
});

router.get('/entries', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const parsed = req.query.startDate || req.query.endDate
        ? ReportPeriodSchema.partial().parse(req.query)
        : {};
    const entries = await accountingService.listEntries(req.companyId, parsed);
    res.json({ success: true, data: entries });
});

router.post('/entries', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const data = JournalEntrySchema.parse(req.body);
    const entry = await accountingService.createEntry(req.companyId, req.userId || 'system', data);
    res.status(201).json({ success: true, data: entry });
});

router.get('/reports/trial-balance', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const period = ReportPeriodSchema.parse(req.query);
    const report = await accountingService.getTrialBalance(req.companyId, period.startDate, period.endDate);
    res.json({ success: true, data: report });
});

router.get('/reports/income-statement', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const period = ReportPeriodSchema.parse(req.query);
    const report = await accountingService.getIncomeStatement(req.companyId, period.startDate, period.endDate);
    res.json({ success: true, data: report });
});

router.get('/reports/balance-sheet', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const query = BalanceSheetQuerySchema.parse(req.query);
    const report = await accountingService.getBalanceSheet(req.companyId, query.asOfDate);
    res.json({ success: true, data: report });
});

export default router;
