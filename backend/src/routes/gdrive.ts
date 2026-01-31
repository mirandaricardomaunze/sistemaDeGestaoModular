import { Router } from 'express';
import { googleDriveService } from '../services/googleDrive.service';
import { backupService } from '../services/backup.service';
import { authenticate } from '../middleware/auth';
import { tenantMiddleware } from '../middleware/tenant';

const router = Router();

/**
 * GET /api/gdrive/status
 * Verifica se o Google Drive está configurado
 */
router.get('/status', authenticate, tenantMiddleware, (req, res) => {
    res.json({
        configured: googleDriveService.isConfigured(),
        enabled: process.env.GDRIVE_ENABLED === 'true',
    });
});

/**
 * GET /api/gdrive/auth-url
 * Obtém a URL de autorização do Google
 */
router.get('/auth-url', authenticate, tenantMiddleware, (req, res) => {
    try {
        const authUrl = googleDriveService.getAuthUrl();
        res.json({
            success: true,
            authUrl,
        });
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/gdrive/callback
 * Callback do OAuth2 do Google
 */
router.get('/callback', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code || typeof code !== 'string') {
            return res.status(400).send('Código de autorização não fornecido');
        }

        const result = await googleDriveService.getTokenFromCode(code);

        if (result.success) {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Autorização Concluída</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            max-width: 600px;
                            margin: 50px auto;
                            padding: 20px;
                            text-align: center;
                        }
                        .success {
                            color: #22c55e;
                            font-size: 48px;
                            margin-bottom: 20px;
                        }
                        .code-box {
                            background: #f3f4f6;
                            padding: 15px;
                            border-radius: 8px;
                            margin: 20px 0;
                            word-break: break-all;
                            font-family: monospace;
                        }
                        .instructions {
                            text-align: left;
                            background: #fef3c7;
                            padding: 15px;
                            border-radius: 8px;
                            border-left: 4px solid #f59e0b;
                        }
                    </style>
                </head>
                <body>
                    <div class="success">✅</div>
                    <h1>Autorização Concluída!</h1>
                    <p>Copie o Refresh Token abaixo e adicione no arquivo <strong>.env</strong>:</p>
                    
                    <div class="code-box">
                        ${result.refreshToken}
                    </div>

                    <div class="instructions">
                        <h3>ðŸ“ Próximos Passos:</h3>
                        <ol>
                            <li>Abra o arquivo <code>backend/.env</code></li>
                            <li>Adicione ou atualize a linha:<br>
                                <code>GDRIVE_REFRESH_TOKEN="${result.refreshToken}"</code>
                            </li>
                            <li>Reinicie o servidor backend</li>
                            <li>Pronto! Os backups serão enviados automaticamente para o Google Drive</li>
                        </ol>
                    </div>

                    <p style="margin-top: 30px;">
                        <a href="/backups" style="color: #6366f1; text-decoration: none;">
                            â† Voltar para Backups
                        </a>
                    </p>
                </body>
                </html>
            `);
        } else {
            res.status(500).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Erro na Autorização</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            max-width: 600px;
                            margin: 50px auto;
                            padding: 20px;
                            text-align: center;
                        }
                        .error {
                            color: #ef4444;
                            font-size: 48px;
                            margin-bottom: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="error">âŒ</div>
                    <h1>Erro na Autorização</h1>
                    <p>${result.error}</p>
                    <p style="margin-top: 30px;">
                        <a href="/api/gdrive/auth-url" style="color: #6366f1; text-decoration: none;">
                            â† Tentar Novamente
                        </a>
                    </p>
                </body>
                </html>
            `);
        }
    } catch (error: unknown) {
        res.status(500).send(`Erro: ${error.message}`);
    }
});

/**
 * GET /api/gdrive/backups
 * Lista backups no Google Drive
 */
router.get('/backups', authenticate, tenantMiddleware, async (req, res) => {
    try {
        const companyId = (req as any).companyId;
        const result = await googleDriveService.listBackups(companyId);

        if (result.success) {
            res.json({
                success: true,
                backups: result.files,
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
            });
        }
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/gdrive/upload/:filename
 * Faz upload manual de um backup para o Google Drive
 */
router.post('/upload/:filename', authenticate, tenantMiddleware, async (req, res) => {
    try {
        const { filename } = req.params;
        const path = require('path');
        const companyId = (req as any).companyId;
        const filepath = path.join(backupService.getCompanyBackupPath(companyId), filename);

        const result = await googleDriveService.uploadFile(filepath, filename, companyId);

        if (result.success) {
            res.json({
                success: true,
                message: 'Upload concluído com sucesso',
                fileId: result.fileId,
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
            });
        }
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * DELETE /api/gdrive/:fileId
 * Deleta um backup do Google Drive
 */
router.delete('/:fileId', authenticate, tenantMiddleware, async (req, res) => {
    try {
        const { fileId } = req.params;

        const result = await googleDriveService.deleteFile(fileId);

        if (result.success) {
            res.json({
                success: true,
                message: 'Backup deletado do Google Drive',
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
            });
        }
    } catch (error: unknown) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
