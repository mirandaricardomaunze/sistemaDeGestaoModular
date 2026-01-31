import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { BottleStoreService } from '../services/bottle-store.service';
import { BottleReturnsService } from '../services/bottle-returns.service';
import { CashSessionService } from '../services/cash-session.service';
import { CreditSalesService } from '../services/credit-sales.service';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

// ============================================================================
// DASHBOARD
// ============================================================================
router.get('/dashboard', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const range = (req.query.range as string) || '1M';
        const stats = await BottleStoreService.getDashboardStats(authReq.companyId!, range);
        res.json(stats);
    } catch (error: unknown) {
        logger.error('Error fetching bottle store dashboard stats:', error);
        res.status(500).json({ message: 'Erro ao buscar dados do painel da garrafeira' });
    }
});

// ============================================================================
// REPORTS
// ============================================================================
router.get('/reports', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const reportData = await BottleStoreService.getSalesReport(authReq.companyId!, req.query);
        res.json(reportData);
    } catch (error: unknown) {
        logger.error('Error generating bottle store sales report:', error);
        res.status(500).json({ message: 'Erro ao gerar relatório de vendas da garrafeira' });
    }
});

// ============================================================================
// STOCK MOVEMENTS
// ============================================================================
router.get('/movements', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const movements = await BottleStoreService.getStockMovements(authReq.companyId!, req.query);
        res.json(movements);
    } catch (error: unknown) {
        logger.error('Error fetching bottle store movements:', error);
        res.status(500).json({ message: 'Erro ao buscar movimentos de stock' });
    }
});

router.post('/movements', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const movement = await BottleStoreService.recordStockMovement(
            authReq.companyId!,
            authReq.user!.name,
            req.body
        );
        res.status(201).json(movement);
    } catch (error: unknown) {
        logger.error('Error recording bottle store movement:', error);
        res.status(500).json({ message: error.message || 'Erro ao registar movimento de stock' });
    }
});

// ============================================================================
// BOTTLE RETURNS (Vasilhames)
// ============================================================================
router.get('/bottle-returns', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const data = await BottleReturnsService.getMovements(authReq.companyId!, req.query);
        res.json(data);
    } catch (error: unknown) {
        logger.error('Error fetching bottle returns:', error);
        res.status(500).json({ message: 'Erro ao buscar devoluções de vasilhames' });
    }
});

router.get('/bottle-returns/customer/:customerId', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const balance = await BottleReturnsService.getCustomerBalance(
            authReq.companyId!,
            req.params.customerId
        );
        res.json(balance);
    } catch (error: unknown) {
        logger.error('Error fetching customer bottle balance:', error);
        res.status(500).json({ message: 'Erro ao buscar saldo de vasilhames do cliente' });
    }
});

router.get('/bottle-returns/summary', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const summary = await BottleReturnsService.getSummaryByProduct(authReq.companyId!);
        res.json(summary);
    } catch (error: unknown) {
        logger.error('Error fetching bottle returns summary:', error);
        res.status(500).json({ message: 'Erro ao buscar resumo de vasilhames' });
    }
});

router.post('/bottle-returns/deposit', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const data = await BottleReturnsService.recordDeposit(
            authReq.companyId!,
            authReq.user!.name,
            req.body
        );
        res.status(201).json(data);
    } catch (error: unknown) {
        logger.error('Error recording bottle deposit:', error);
        res.status(500).json({ message: error.message || 'Erro ao registar depósito de vasilhame' });
    }
});

router.post('/bottle-returns/return', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const data = await BottleReturnsService.recordReturn(
            authReq.companyId!,
            authReq.user!.name,
            req.body
        );
        res.status(201).json(data);
    } catch (error: unknown) {
        logger.error('Error recording bottle return:', error);
        res.status(500).json({ message: error.message || 'Erro ao registar devolução de vasilhame' });
    }
});

// ============================================================================
// CASH SESSIONS (Caixa)
// ============================================================================
router.get('/cash-session', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const session = await CashSessionService.getCurrentSession(authReq.companyId!);
        res.json(session);
    } catch (error: unknown) {
        logger.error('Error fetching current cash session:', error);
        res.status(500).json({ message: 'Erro ao buscar sessão de caixa atual' });
    }
});

router.get('/cash-session/summary', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const summary = await CashSessionService.getDailySummary(authReq.companyId!);
        res.json(summary);
    } catch (error: unknown) {
        logger.error('Error fetching cash session summary:', error);
        res.status(500).json({ message: 'Erro ao buscar resumo da sessão' });
    }
});

router.get('/cash-session/history', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const history = await CashSessionService.getHistory(authReq.companyId!, req.query);
        res.json(history);
    } catch (error: unknown) {
        logger.error('Error fetching cash session history:', error);
        res.status(500).json({ message: 'Erro ao buscar histórico de caixa' });
    }
});

router.post('/cash-session/open', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const session = await CashSessionService.openSession(
            authReq.companyId!,
            authReq.user!.name,
            req.body.openingBalance || 0
        );
        res.status(201).json(session);
    } catch (error: unknown) {
        logger.error('Error opening cash session:', error);
        res.status(400).json({ message: error.message || 'Erro ao abrir caixa' });
    }
});

router.post('/cash-session/close', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const session = await CashSessionService.closeSession(
            authReq.companyId!,
            authReq.user!.name,
            req.body
        );
        res.json(session);
    } catch (error: unknown) {
        logger.error('Error closing cash session:', error);
        res.status(400).json({ message: error.message || 'Erro ao fechar caixa' });
    }
});

router.post('/cash-session/withdrawal', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const session = await CashSessionService.registerWithdrawal(
            authReq.companyId!,
            req.body.amount
        );
        res.json(session);
    } catch (error: unknown) {
        logger.error('Error registering withdrawal:', error);
        res.status(400).json({ message: error.message || 'Erro ao registar levantamento' });
    }
});

router.post('/cash-session/deposit', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const session = await CashSessionService.registerDeposit(
            authReq.companyId!,
            req.body.amount
        );
        res.json(session);
    } catch (error: unknown) {
        logger.error('Error registering deposit:', error);
        res.status(400).json({ message: error.message || 'Erro ao registar depósito' });
    }
});

// ============================================================================
// CREDIT SALES (Vendas a Crédito)
// ============================================================================
router.get('/credit-sales', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const data = await CreditSalesService.getCreditSales(authReq.companyId!, req.query);
        res.json(data);
    } catch (error: unknown) {
        logger.error('Error fetching credit sales:', error);
        res.status(500).json({ message: 'Erro ao buscar vendas a crédito' });
    }
});

router.get('/credit-sales/debtors', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const report = await CreditSalesService.getDebtorsReport(authReq.companyId!);
        res.json(report);
    } catch (error: unknown) {
        logger.error('Error fetching debtors report:', error);
        res.status(500).json({ message: 'Erro ao buscar relatório de devedores' });
    }
});

router.get('/credit-sales/customer/:customerId', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const summary = await CreditSalesService.getCustomerSummary(
            authReq.companyId!,
            req.params.customerId
        );
        res.json(summary);
    } catch (error: unknown) {
        logger.error('Error fetching customer credit summary:', error);
        res.status(500).json({ message: 'Erro ao buscar resumo de crédito do cliente' });
    }
});

router.get('/credit-sales/:saleId/payments', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const history = await CreditSalesService.getPaymentHistory(
            authReq.companyId!,
            req.params.saleId
        );
        res.json(history);
    } catch (error: unknown) {
        logger.error('Error fetching payment history:', error);
        res.status(500).json({ message: 'Erro ao buscar histórico de pagamentos' });
    }
});

router.post('/credit-sales/pay', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const payment = await CreditSalesService.registerPayment(
            authReq.companyId!,
            authReq.user!.name,
            req.body
        );
        res.status(201).json(payment);
    } catch (error: unknown) {
        logger.error('Error registering credit payment:', error);
        res.status(400).json({ message: error.message || 'Erro ao registar pagamento' });
    }
});

export default router;

