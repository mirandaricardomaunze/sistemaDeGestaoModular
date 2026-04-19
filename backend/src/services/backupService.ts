import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import cron from 'node-cron';
import { googleDriveService } from './googleDrive.service';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

interface BackupConfig {
    enabled: boolean;
    schedule: string; // Cron expression
    retentionDays: number; // Quantos dias manter backups
    backupPath: string;
}

class BackupService {
    private config: BackupConfig;
    private isRunning: boolean = false;

    constructor() {
        this.config = {
            enabled: process.env.BACKUP_ENABLED === 'true' || true,
            schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // 2h da manhã todo dia
            retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
            backupPath: path.join(__dirname, '../../backups'),
        };
    }

    /**
     * Retorna o caminho do diretório de backup de uma empresa específica
     */
    public getCompanyBackupPath(companyId: string): string {
        return path.join(this.config.backupPath, companyId);
    }

    /**
     * Inicializa o serviço de backup automático
     */
    async initialize(): Promise<void> {
        if (!this.config.enabled) {
            logger.info('Automatic backup disabled');
            return;
        }

        // Criar diretório de backups se não existir
        await this.ensureBackupDirectory();

        // Agendar backup automático
        this.scheduleBackup();

        logger.info('Automatic backup configured', {
            schedule: this.config.schedule,
            retentionDays: this.config.retentionDays,
            backupPath: this.config.backupPath
        });
    }

    /**
     * Garante que o diretório de backups existe (global e por empresa)
     */
    private async ensureBackupDirectory(companyId?: string): Promise<string> {
        // Garantir diretório base
        try {
            await fs.access(this.config.backupPath);
        } catch {
            await fs.mkdir(this.config.backupPath, { recursive: true });
        }

        if (companyId) {
            const companyPath = this.getCompanyBackupPath(companyId);
            try {
                await fs.access(companyPath);
            } catch {
                await fs.mkdir(companyPath, { recursive: true });
                logger.info('Backup directory created', { companyId, path: companyPath });
            }
            return companyPath;
        }

        return this.config.backupPath;
    }

    /**
     * Agenda backup automático usando cron
     */
    private scheduleBackup(): void {
        cron.schedule(this.config.schedule, async () => {
            logger.info('Starting scheduled backups for all companies');
            try {
                const companies = await prisma.company.findMany({
                    where: { status: 'active' },
                    select: { id: true }
                });

                for (const company of companies) {
                    logger.info('Running scheduled backup', { companyId: company.id });
                    await this.createBackup(company.id);
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                logger.error('Scheduled backup failed', { message });
            }
        });
    }

    /**
     * Cria um backup do banco de dados para uma empresa específica
     */
    async createBackup(companyId: string): Promise<{ success: boolean; filename?: string; size?: string; error?: string }> {
        if (this.isRunning) {
            return { success: false, error: 'Um backup já está em execução' };
        }

        this.isRunning = true;

        try {
            await this.ensureBackupDirectory(companyId);
            const companyPath = this.getCompanyBackupPath(companyId);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `backup-${timestamp}.sql`;
            const filepath = path.join(companyPath, filename);

            logger.info('Creating backup', { companyId, filename });

            // Obter URL do banco de dados e remover parâmetros extras (como ?schema=public) que o pg_dump não reconhece
            const databaseUrl = process.env.DATABASE_URL;
            if (!databaseUrl) {
                throw new Error('DATABASE_URL não configurada');
            }

            const sanitizedUrl = databaseUrl.split('?')[0];

            // Executar pg_dump
            // Tentamos usar o caminho absoluto caso não esteja no PATH
            const pgDumpPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
            const command = `"${pgDumpPath}" "${sanitizedUrl}" > "${filepath}"`;
            try {
                await execAsync(command);
            } catch (execError: any) {
                // Fallback para comando simples caso o caminho acima falhe por algum motivo (ex: versão diferente)
                if (execError.message.includes('não é reconhecido') || execError.message.includes('not found')) {
                    try {
                        await execAsync(`pg_dump "${sanitizedUrl}" > "${filepath}"`);
                    } catch (finalError: any) {
                        throw new Error('PostgreSQL client (pg_dump) não encontrado no sistema. Por favor, instale o PostgreSQL client tools ou verifique o caminho.');
                    }
                } else {
                    throw execError;
                }
            }

            // Verificar se o arquivo foi criado
            const stats = await fs.stat(filepath);
            const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

            logger.info('Backup created successfully', { filename, sizeMB: sizeInMB });

            // Upload para Google Drive (se configurado)
            if (googleDriveService.isConfigured()) {
                const uploadResult = await googleDriveService.uploadFile(filepath, filename, companyId);

                if (uploadResult.success) {
                    logger.info('Backup uploaded to Google Drive', { companyId, filename });
                } else {
                    logger.warn('Google Drive upload failed', { companyId, error: uploadResult.error });
                }
            }

            // Limpar backups antigos (local)
            await this.cleanOldBackups(companyId);

            // Limpar backups antigos (Google Drive)
            if (googleDriveService.isConfigured()) {
                await googleDriveService.cleanOldBackups(this.config.retentionDays, companyId);
            }

            return { success: true, filename, size: `${sizeInMB} MB` };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Backup creation failed', { companyId, message });
            return { success: false, error: message };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Remove backups mais antigos que o período de retenção para uma empresa específica
     */
    private async cleanOldBackups(companyId: string): Promise<void> {
        try {
            const companyPath = this.getCompanyBackupPath(companyId);
            const files = await fs.readdir(companyPath);
            const now = Date.now();
            const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;

            let deletedCount = 0;

            for (const file of files) {
                if (!file.startsWith('backup-') || !file.endsWith('.sql')) {
                    continue;
                }

                const filepath = path.join(companyPath, file);
                const stats = await fs.stat(filepath);
                const fileAge = now - stats.mtimeMs;

                if (fileAge > retentionMs) {
                    await fs.unlink(filepath);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                logger.info('Old backups removed', { companyId, deletedCount });
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.warn('Failed to clean old backups', { companyId, message });
        }
    }

    /**
     * Lista todos os backups disponíveis para uma empresa específica
     */
    async listBackups(companyId: string): Promise<Array<{ filename: string; size: string; date: Date }>> {
        try {
            const companyPath = this.getCompanyBackupPath(companyId);
            await this.ensureBackupDirectory(companyId);
            const files = await fs.readdir(companyPath);
            const backups = [];

            for (const file of files) {
                if (!file.startsWith('backup-') || !file.endsWith('.sql')) {
                    continue;
                }

                const filepath = path.join(companyPath, file);
                const stats = await fs.stat(filepath);
                const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

                backups.push({
                    filename: file,
                    size: `${sizeInMB} MB`,
                    date: stats.mtime,
                });
            }

            // Ordenar por data (mais recente primeiro)
            backups.sort((a, b) => b.date.getTime() - a.date.getTime());

            return backups;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to list backups', { companyId, message });
            return [];
        }
    }

    /**
     * Restaura um backup específico de uma empresa
     */
    async restoreBackup(filename: string, companyId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const filepath = path.join(this.getCompanyBackupPath(companyId), filename);

            // Verificar se o arquivo existe
            await fs.access(filepath);

            logger.info('Restoring backup', { filename, companyId });

            const databaseUrl = process.env.DATABASE_URL;
            if (!databaseUrl) {
                throw new Error('DATABASE_URL não configurada');
            }

            const sanitizedUrl = databaseUrl.split('?')[0];

            // ATENÇÀO: Isso vai SUBSTITUIR todos os dados atuais!
            const psqlPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
            const command = `"${psqlPath}" "${sanitizedUrl}" < "${filepath}"`;
            try {
                await execAsync(command);
            } catch (execError: any) {
                if (execError.message.includes('não é reconhecido') || execError.message.includes('not found')) {
                    try {
                        await execAsync(`psql "${sanitizedUrl}" < "${filepath}"`);
                    } catch (finalError: any) {
                        throw new Error('PostgreSQL client (psql) não encontrado no sistema. Por favor, instale o PostgreSQL client tools ou verifique o caminho.');
                    }
                } else {
                    throw execError;
                }
            }

            logger.info('Backup restored successfully', { filename });

            return { success: true };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Backup restore failed', { filename, companyId, message });
            return { success: false, error: message };
        }
    }

    /**
     * Deleta um backup específico de uma empresa
     */
    async deleteBackup(filename: string, companyId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const filepath = path.join(this.getCompanyBackupPath(companyId), filename);
            await fs.unlink(filepath);

            logger.info('Backup deleted', { filename, companyId });

            return { success: true };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Backup deletion failed', { filename, companyId, message });
            return { success: false, error: message };
        }
    }

    /**
     * Obtém estatísticas dos backups de uma empresa específica
     */
    async getBackupStats(companyId: string): Promise<{
        totalBackups: number;
        totalSize: string;
        databaseSize?: string;
        oldestBackup?: Date;
        newestBackup?: Date;
    }> {
        try {
            const backups = await this.listBackups(companyId);

            if (backups.length === 0) {
                // Mesmo sem backups, tentamos buscar o tamanho do banco
                const dbSizeResult: any = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
                const dbSize = dbSizeResult[0]?.size || 'N/A';

                return {
                    totalBackups: 0,
                    totalSize: '0 MB',
                    databaseSize: dbSize,
                };
            }

            const totalSizeBytes = await this.calculateTotalSize(companyId);
            const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);

            const dbSizeResult: any = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
            const dbSize = dbSizeResult[0]?.size || 'N/A';

            return {
                totalBackups: backups.length,
                totalSize: `${totalSizeMB} MB`,
                databaseSize: dbSize,
                oldestBackup: backups[backups.length - 1]?.date,
                newestBackup: backups[0]?.date,
            };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Failed to get backup stats', { companyId, message });
            return {
                totalBackups: 0,
                totalSize: '0 MB',
            };
        }
    }

    /**
     * Calcula o tamanho total de todos os backups de uma empresa
     */
    private async calculateTotalSize(companyId: string): Promise<number> {
        const companyPath = this.getCompanyBackupPath(companyId);
        const files = await fs.readdir(companyPath);
        let totalSize = 0;

        for (const file of files) {
            if (!file.startsWith('backup-') || !file.endsWith('.sql')) {
                continue;
            }

            const filepath = path.join(companyPath, file);
            const stats = await fs.stat(filepath);
            totalSize += stats.size;
        }

        return totalSize;
    }
}

// Exportar instância singleton
export const backupService = new BackupService();
