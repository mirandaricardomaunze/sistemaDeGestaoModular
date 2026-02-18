import { Router } from 'express';
import { backupService } from '../services/backup.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';

const router = Router();
router.use(authenticate);

router.post('/create', async (req: AuthRequest, res) => {
    const result = await backupService.createBackup(req.companyId);
    if (!result.success) throw ApiError.internal('Erro ao criar backup');
    res.json(result);
});

router.get('/list', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const backups = await backupService.listBackups(req.companyId);
    res.json({ data: backups });
});

export default router;
