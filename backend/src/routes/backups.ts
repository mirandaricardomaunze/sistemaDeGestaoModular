import path from 'path';
import { Router } from 'express';
import { backupService } from '../services/backupService';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate);
router.use(authorize('admin')); // All backup operations require admin

router.post('/create', asyncHandler(async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await backupService.createBackup(req.companyId);
    if (!result.success) throw ApiError.internal('Erro ao criar backup');
    res.json(result);
}));

router.get('/list', asyncHandler(async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const backups = await backupService.listBackups(req.companyId);
    res.json({ backups }); // Frontend expects { backups: [...] }
}));

router.get('/stats', asyncHandler(async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const stats = await backupService.getBackupStats(req.companyId);
    res.json({ stats });
}));

router.get('/download/:filename', asyncHandler(async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { filename } = req.params;
    const basePath = path.resolve(backupService.getCompanyBackupPath(req.companyId));
    const filepath = path.resolve(path.join(basePath, filename));

    if (!filepath.startsWith(basePath + path.sep) && filepath !== basePath) {
        throw ApiError.badRequest('Nome de arquivo inválido');
    }

    res.download(filepath);
}));

router.delete('/:filename', asyncHandler(async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { filename } = req.params;
    const result = await backupService.deleteBackup(filename, req.companyId);
    if (!result.success) throw ApiError.internal(result.error || 'Erro ao deletar backup');
    res.json(result);
}));

router.post('/restore/:filename', asyncHandler(async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const { filename } = req.params;
    const result = await backupService.restoreBackup(filename, req.companyId);
    if (!result.success) throw ApiError.internal(result.error || 'Erro ao restaurar backup');
    res.json(result);
}));

export default router;
