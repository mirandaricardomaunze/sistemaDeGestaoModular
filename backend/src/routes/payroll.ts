import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { payrollService } from '../services/payrollService';
import { payrollEngine } from '../services/payrollEngine.service';

const router = Router();

router.get('/', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const result = await payrollService.list({ ...req.query }, req.companyId);
    res.json(result);
});

router.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const { employeeId, ...rest } = req.body;
    if (!employeeId) throw ApiError.badRequest('O ID do funcionario e obrigatorio.');
    const result = await payrollService.upsert(employeeId, rest, req.companyId);
    res.json(result);
});

router.post('/preview', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    const result = payrollEngine.calculate(req.body);
    res.json({ success: true, data: result });
});

router.put('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const result = await payrollService.update(req.params.id, req.body, req.companyId);
    res.json(result);
});

router.post('/:id/process', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const result = await payrollService.process(req.params.id, req.companyId);
    res.json(result);
});

router.post('/:id/mark-paid', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa nao identificada');
    const result = await payrollService.pay(req.params.id, req.companyId, req.body?.approvalId);
    res.json(result);
});

export default router;
