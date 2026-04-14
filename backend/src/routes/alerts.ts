import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { alertsService } from '../services/alert.service';

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const alerts = await alertsService.list(req.query, req.companyId);
    res.json(alerts);
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const alert = await alertsService.create(req.companyId, req.body);
    res.status(201).json(alert);
});

router.post('/generate', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await alertsService.generate(req.companyId);
    res.json(result);
});

router.post('/generate/:module', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await alertsService.generate(req.companyId, req.params.module);
    res.json(result);
});

router.get('/unread-count', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const counts = await alertsService.getUnreadCount(req.companyId, req.query.module as string);
    res.json(counts);
});

router.get('/summary', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const summary = await alertsService.getSummary(req.companyId);
    res.json(summary);
});

router.patch('/:id/read', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await alertsService.markAsRead(req.params.id, req.companyId);
    if (result.count === 0) throw ApiError.notFound('Alerta não encontrado');
    res.json({ message: 'Alerta marcado como lido' });
});

router.patch('/read-all', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    await alertsService.markAllAsRead(req.companyId, req.body.module);
    res.json({ message: 'Todos os alertas marcados como lidos' });
});

router.patch('/:id/resolve', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await alertsService.resolve(req.params.id, req.companyId);
    if (result.count === 0) throw ApiError.notFound('Alerta não encontrado');
    res.json({ message: 'Alerta resolvido' });
});

router.delete('/clear/resolved', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await alertsService.clearResolved(req.companyId);
    res.json({ message: `${result.count} alerta(s) removido(s)`, count: result.count });
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await alertsService.delete(req.params.id, req.companyId);
    if (result.count === 0) throw ApiError.notFound('Alerta não encontrado');
    res.json({ message: 'Alerta removido' });
});

export default router;
