import { Router } from 'express';
import { googleDriveService } from '../services/googleDrive.service';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { backupService } from '../services/backupService';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

const router = Router();

// ── Status ────────────────────────────────────────────────────────────────────

router.get('/status', authenticate, async (req: AuthRequest, res) => {
    res.json({ configured: googleDriveService.isConfigured() });
});

// ── List backups on Drive ─────────────────────────────────────────────────────

router.get('/backups', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
    const result = await googleDriveService.listBackups(req.companyId);
    res.json(result);
});

// ── Upload a local backup to Drive ───────────────────────────────────────────

router.post(
    '/upload',
    authenticate,
    authorize('super_admin', 'admin'),
    async (req: AuthRequest, res) => {
        if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
        if (!googleDriveService.isConfigured()) throw ApiError.badRequest('Google Drive não está configurado');

        const { filename } = z.object({ filename: z.string().min(1) }).parse(req.body);

        // Security: only allow files inside the backups directory
        const backupsDir = path.resolve(process.cwd(), 'backups');
        const filePath   = path.resolve(backupsDir, filename);

        if (!filePath.startsWith(backupsDir + path.sep)) {
            throw ApiError.badRequest('Caminho de ficheiro inválido');
        }
        if (!fs.existsSync(filePath)) {
            throw ApiError.notFound('Ficheiro de backup não encontrado');
        }

        const result = await googleDriveService.uploadFile(filePath, filename, req.companyId);

        if (!result.success) {
            throw ApiError.internal(result.error || 'Erro ao fazer upload para o Google Drive');
        }

        res.json({ success: true, fileId: result.fileId, message: 'Backup enviado para o Google Drive com sucesso' });
    }
);

// ── Delete a file from Drive ──────────────────────────────────────────────────

router.delete(
    '/:fileId',
    authenticate,
    authorize('super_admin', 'admin'),
    async (req: AuthRequest, res) => {
        if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
        if (!googleDriveService.isConfigured()) throw ApiError.badRequest('Google Drive não está configurado');

        const { fileId } = req.params;

        // Verify file belongs to this company by checking its presence in the company listing
        const backups = await googleDriveService.listBackups(req.companyId);
        const owned = backups.some(b => b.id === fileId);
        if (!owned) throw ApiError.notFound('Ficheiro não encontrado ou sem permissão de acesso');

        await (googleDriveService as any).drive.files.delete({ fileId });

        res.json({ success: true, message: 'Ficheiro eliminado do Google Drive' });
    }
);

// ── Restore a Drive backup to local + trigger DB restore ─────────────────────

router.post(
    '/restore/:fileId',
    authenticate,
    authorize('super_admin', 'admin'),
    async (req: AuthRequest, res) => {
        if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
        if (!googleDriveService.isConfigured()) throw ApiError.badRequest('Google Drive não está configurado');

        const { fileId } = req.params;

        // Verify ownership
        const backups = await googleDriveService.listBackups(req.companyId);
        const file    = backups.find(b => b.id === fileId);
        if (!file) throw ApiError.notFound('Ficheiro não encontrado ou sem permissão de acesso');

        // Download from Drive to a temp file
        const drive     = (googleDriveService as any).drive;
        const backupDir = path.resolve(process.cwd(), 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

        const localPath = path.join(backupDir, `restore-${Date.now()}-${file.name}`);

        const response = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        await new Promise<void>((resolve, reject) => {
            const dest = fs.createWriteStream(localPath);
            response.data.pipe(dest);
            dest.on('finish', resolve);
            dest.on('error', reject);
        });

        // Run the DB restore using the existing backupService
        const result = await backupService.restoreBackup(localPath, req.companyId!);

        // Clean up temp file
        fs.unlink(localPath, () => {});

        if (!result.success) {
            throw ApiError.internal(result.error || 'Erro ao restaurar backup');
        }

        res.json({ success: true, message: `Backup '${file.name}' restaurado com sucesso a partir do Google Drive` });
    }
);

// ── Clean old Drive backups ───────────────────────────────────────────────────

router.delete(
    '/clean/old',
    authenticate,
    authorize('super_admin', 'admin'),
    async (req: AuthRequest, res) => {
        if (!req.companyId) throw ApiError.badRequest('Empresa não identificada');
        if (!googleDriveService.isConfigured()) throw ApiError.badRequest('Google Drive não está configurado');

        const retentionDays = Math.max(1, parseInt(String(req.query.days || '30')) || 30);
        const result = await googleDriveService.cleanOldBackups(retentionDays, req.companyId);

        if (!result.success) {
            throw ApiError.internal(result.error || 'Erro ao limpar backups antigos');
        }

        res.json({ success: true, deletedCount: result.deletedCount, message: `${result.deletedCount} ficheiros eliminados` });
    }
);

export default router;
