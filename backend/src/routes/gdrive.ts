import { Router } from 'express';
import { google } from 'googleapis';
import { googleDriveService } from '../services/googleDrive.service';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { backupService } from '../services/backupService';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

const router = Router();

// ── Status ────────────────────────────────────────────────────────────────────

router.get('/status', authenticate, async (req: AuthRequest, res) => {
    res.json({ configured: googleDriveService.isConfigured() });
});

// ── OAuth: start authorization flow ──────────────────────────────────────────
// Admin opens this URL in the browser; Google redirects back to /callback
// with a `code`, which we exchange for a refresh_token.
router.get('/auth', authenticate, authorize('super_admin', 'admin'), (req: AuthRequest, res) => {
    const clientId = process.env.GDRIVE_CLIENT_ID;
    const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
    const redirectUri = process.env.GDRIVE_REDIRECT_URI || 'http://localhost:3001/api/gdrive/callback';

    if (!clientId || !clientSecret) {
        throw ApiError.badRequest('GDRIVE_CLIENT_ID/SECRET não configurados no .env');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',         // required to receive refresh_token
        prompt: 'consent',              // force refresh_token on every consent
        scope: ['https://www.googleapis.com/auth/drive.file'],
    });

    res.json({ url });
});

// ── OAuth: callback — exchange `code` for refresh_token ──────────────────────
router.get('/callback', async (req, res) => {
    const code = String(req.query.code || '');
    if (!code) {
        return res.status(400).send('Falta o parâmetro `code` na URL de callback.');
    }

    const clientId = process.env.GDRIVE_CLIENT_ID;
    const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
    const redirectUri = process.env.GDRIVE_REDIRECT_URI || 'http://localhost:3001/api/gdrive/callback';

    if (!clientId || !clientSecret) {
        return res.status(500).send('GDRIVE_CLIENT_ID/SECRET não configurados.');
    }

    try {
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const { tokens } = await oauth2Client.getToken(code);
        const refreshToken = tokens.refresh_token;

        if (!refreshToken) {
            return res.status(500).send(
                'Google não retornou refresh_token. Revogue o acesso em https://myaccount.google.com/permissions e tente novamente.'
            );
        }

        logger.info('Google Drive OAuth refresh_token obtained');

        // Render the token so the admin can paste it into .env
        res.type('html').send(`
            <html><body style="font-family:system-ui;padding:40px;max-width:720px;margin:auto">
              <h2>✅ Autorização Google Drive concluída</h2>
              <p>Cola este valor no <code>.env</code> do backend e reinicia o servidor:</p>
              <pre style="background:#f4f4f4;padding:16px;border-radius:6px;word-break:break-all">GDRIVE_REFRESH_TOKEN="${refreshToken}"
GDRIVE_ENABLED=true</pre>
              <p>Depois disso, o backup automático às 02:00 fará upload automático para o Drive.</p>
            </body></html>
        `);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Google Drive OAuth callback failed', { message });
        res.status(500).send(`Falha ao trocar code por token: ${message}`);
    }
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

        await googleDriveService.deleteFile(fileId);

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
        const backupDir = path.resolve(process.cwd(), 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

        const localPath = path.join(backupDir, `restore-${Date.now()}-${file.name}`);
        const stream = await googleDriveService.downloadFile(fileId);

        await new Promise<void>((resolve, reject) => {
            const dest = fs.createWriteStream(localPath);
            stream.pipe(dest);
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
