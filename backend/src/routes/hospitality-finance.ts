import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { HospitalityFinanceService } from '../services/hospitality-finance.service';

const router = Router();

// Dashboard data
router.get('/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { period = '1m' } = req.query;
        const dashboard = await HospitalityFinanceService.getDashboard(req.companyId!, period as string);
        res.json(dashboard);
    } catch (error) {
        console.error('Error in finance dashboard:', error);
        res.status(500).json({ message: 'Error fetching finance dashboard' });
    }
});

// Revenues
router.get('/revenues', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const revenues = await HospitalityFinanceService.getRevenues(req.companyId!, req.query);
        res.json(revenues);
    } catch (error) {
        console.error('Error fetching revenues:', error);
        res.status(500).json({ message: 'Error fetching revenues' });
    }
});

// Expenses
router.get('/expenses', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const expenses = await HospitalityFinanceService.getExpenses(req.companyId!, req.query);
        res.json(expenses);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ message: 'Error fetching expenses' });
    }
});

router.post('/expenses', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const expense = await HospitalityFinanceService.createExpense(req.companyId!, req.body);
        res.status(201).json(expense);
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ message: 'Error creating expense' });
    }
});

router.put('/expenses/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const expense = await HospitalityFinanceService.updateExpense(req.params.id, req.companyId!, req.body);
        res.json(expense);
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ message: 'Error updating expense' });
    }
});

router.delete('/expenses/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        await HospitalityFinanceService.deleteExpense(req.params.id, req.companyId!);
        res.json({ message: 'Expense deleted successfully' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ message: 'Error deleting expense' });
    }
});

// Reports
router.get('/reports/profit-loss', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'startDate and endDate are required' });
        }
        const report = await HospitalityFinanceService.getProfitLoss(
            req.companyId!,
            startDate as string,
            endDate as string
        );
        res.json(report);
    } catch (error) {
        console.error('Error in profit-loss report:', error);
        res.status(500).json({ message: 'Error generating report' });
    }
});

router.get('/reports/by-room', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await HospitalityFinanceService.getByRoom(
            req.companyId!,
            startDate as string,
            endDate as string
        );
        res.json(report);
    } catch (error) {
        console.error('Error in by-room report:', error);
        res.status(500).json({ message: 'Error generating report' });
    }
});

export default router;
