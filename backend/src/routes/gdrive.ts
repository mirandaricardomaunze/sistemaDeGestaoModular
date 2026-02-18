import { Router } from 'express';
import { googleDriveService } from '../services/googleDrive.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';

const router = Router();

router.get('/status', authenticate, async (req: AuthRequest, res) => {
    res.json({ configured: googleDriveService.isConfigured() });
});

router.get('/backups', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await googleDriveService.listBackups(req.companyId);
    res.json(result);
});

export default router;
