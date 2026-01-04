import { Router } from 'express';
import { backupService } from '../services/backup.service';

const router = Router();

/**
 * POST /api/backups/create
 * Cria um backup manual do banco de dados
 */
router.post('/create', async (req, res) => {
    try {
        const companyId = (req as any).companyId;
        const result = await backupService.createBackup(companyId);

        if (result.success) {
            res.json({
                success: true,
                message: 'Backup criado com sucesso',
                filename: result.filename,
                size: result.size,
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Erro ao criar backup',
                error: result.error,
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Erro ao criar backup',
            error: error.message,
        });
    }
});

/**
 * GET /api/backups/list
 * Lista todos os backups disponíveis
 */
router.get('/list', async (req, res) => {
    try {
        const companyId = (req as any).companyId;
        const backups = await backupService.listBackups(companyId);

        res.json({
            success: true,
            backups,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Erro ao listar backups',
            error: error.message,
        });
    }
});

/**
 * GET /api/backups/stats
 * Obtém estatísticas dos backups
 */
router.get('/stats', async (req, res) => {
    try {
        const companyId = (req as any).companyId;
        const stats = await backupService.getBackupStats(companyId);

        res.json({
            success: true,
            stats,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Erro ao obter estatísticas',
            error: error.message,
        });
    }
});

/**
 * POST /api/backups/restore/:filename
 * Restaura um backup específico
 * ATENÇÃO: Esta operação substitui TODOS os dados atuais!
 */
router.post('/restore/:filename', async (req, res) => {
    try {
        const { filename } = req.params;

        // Validar nome do arquivo
        if (!filename.startsWith('backup-') || !filename.endsWith('.sql')) {
            return res.status(400).json({
                success: false,
                message: 'Nome de arquivo inválido',
            });
        }

        const companyId = (req as any).companyId;
        const result = await backupService.restoreBackup(filename, companyId);

        if (result.success) {
            res.json({
                success: true,
                message: 'Backup restaurado com sucesso',
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Erro ao restaurar backup',
                error: result.error,
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Erro ao restaurar backup',
            error: error.message,
        });
    }
});

/**
 * DELETE /api/backups/:filename
 * Deleta um backup específico
 */
router.delete('/:filename', async (req, res) => {
    try {
        const { filename } = req.params;

        // Validar nome do arquivo
        if (!filename.startsWith('backup-') || !filename.endsWith('.sql')) {
            return res.status(400).json({
                success: false,
                message: 'Nome de arquivo inválido',
            });
        }

        const companyId = (req as any).companyId;
        const result = await backupService.deleteBackup(filename, companyId);

        if (result.success) {
            res.json({
                success: true,
                message: 'Backup deletado com sucesso',
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Erro ao deletar backup',
                error: result.error,
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar backup',
            error: error.message,
        });
    }
});

/**
 * GET /api/backups/download/:filename
 * Faz download de um backup específico
 */
router.get('/download/:filename', async (req, res) => {
    try {
        const { filename } = req.params;

        // Validar nome do arquivo
        if (!filename.startsWith('backup-') || !filename.endsWith('.sql')) {
            return res.status(400).json({
                success: false,
                message: 'Nome de arquivo inválido',
            });
        }

        const path = require('path');
        const companyId = (req as any).companyId;
        const filepath = path.join(backupService.getCompanyBackupPath(companyId), filename);

        // Verificar se o arquivo existe
        const fs = require('fs/promises');
        await fs.access(filepath);

        // Enviar arquivo para download
        res.download(filepath, filename);
    } catch (error: any) {
        res.status(404).json({
            success: false,
            message: 'Backup não encontrado',
            error: error.message,
        });
    }
});

export default router;
