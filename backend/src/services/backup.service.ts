import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import cron from 'node-cron';
import { googleDriveService } from './googleDrive.service';
import { prisma } from '../lib/prisma';

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
            console.log('📦 Backup automático desabilitado');
            return;
        }

        // Criar diretório de backups se não existir
        await this.ensureBackupDirectory();

        // Agendar backup automático
        this.scheduleBackup();

        console.log(`📦 Backup automático configurado: ${this.config.schedule}`);
        console.log(`📦 Retenção: ${this.config.retentionDays} dias`);
        console.log(`📦 Diretório: ${this.config.backupPath}`);
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
                console.log(`ðŸ“ Diretório de backup criado para empresa ${companyId}: ${companyPath}`);
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
            console.log('â° Iniciando backups agendados para todas as empresas...');
            try {
                const companies = await prisma.company.findMany({
                    where: { status: 'active' },
                    select: { id: true }
                });

                for (const company of companies) {
                    console.log(`â° Backup agendado para empresa: ${company.id}`);
                    await this.createBackup(company.id);
                }
            } catch (error: unknown) {
                console.error('âŒ Erro no backup agendado:', error.message);
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

            console.log(`📦 Criando backup para empresa ${companyId}: ${filename}`);

            // Obter URL do banco de dados e remover parâmetros extras (como ?schema=public) que o pg_dump não reconhece
            const databaseUrl = process.env.DATABASE_URL;
            if (!databaseUrl) {
                throw new Error('DATABASE_URL não configurada');
            }

            const sanitizedUrl = databaseUrl.split('?')[0];

            // Executar pg_dump
            const command = `pg_dump "${sanitizedUrl}" > "${filepath}"`;
            await execAsync(command);

            // Verificar se o arquivo foi criado
            const stats = await fs.stat(filepath);
            const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

            console.log(`✅ Backup criado com sucesso: ${filename} (${sizeInMB} MB)`);

            // Upload para Google Drive (se configurado)
            if (googleDriveService.isConfigured()) {
                console.log(`â˜ï¸  Fazendo upload para Google Drive (Empresa: ${companyId})...`);
                // Passamos o companyId para o Google Drive Service criar a estrutura de pastas
                const uploadResult = await googleDriveService.uploadFile(filepath, filename, companyId);

                if (uploadResult.success) {
                    console.log(`✅ Backup enviado para Google Drive com sucesso!`);
                } else {
                    console.error(`âš ï¸  Falha ao enviar para Google Drive: ${uploadResult.error}`);
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
            console.error('âŒ Erro ao criar backup:', error.message);
            return { success: false, error: error.message };
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

                const filepath = path.join(this.config.backupPath, file);
                const stats = await fs.stat(filepath);
                const fileAge = now - stats.mtimeMs;

                if (fileAge > retentionMs) {
                    await fs.unlink(filepath);
                    deletedCount++;
                    console.log(`ðŸ—‘ï¸  Backup antigo removido: ${file}`);
                }
            }

            if (deletedCount > 0) {
                console.log(`ðŸ§¹ ${deletedCount} backup(s) antigo(s) removido(s)`);
            }
        } catch (error: unknown) {
            console.error('âš ï¸  Erro ao limpar backups antigos:', error.message);
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
            console.error('âŒ Erro ao listar backups:', error.message);
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

            console.log(`🔄 Restaurando backup: ${filename}`);

            const databaseUrl = process.env.DATABASE_URL;
            if (!databaseUrl) {
                throw new Error('DATABASE_URL não configurada');
            }

            const sanitizedUrl = databaseUrl.split('?')[0];

            // ATENÇÃO: Isso vai SUBSTITUIR todos os dados atuais!
            const command = `psql "${sanitizedUrl}" < "${filepath}"`;
            await execAsync(command);

            console.log(`✅ Backup restaurado com sucesso: ${filename}`);

            return { success: true };
        } catch (error: unknown) {
            console.error('âŒ Erro ao restaurar backup:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Deleta um backup específico de uma empresa
     */
    async deleteBackup(filename: string, companyId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const filepath = path.join(this.getCompanyBackupPath(companyId), filename);
            await fs.unlink(filepath);

            console.log(`ðŸ—‘ï¸  Backup deletado: ${filename}`);

            return { success: true };
        } catch (error: unknown) {
            console.error('âŒ Erro ao deletar backup:', error.message);
            return { success: false, error: error.message };
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
            console.error('âŒ Erro ao obter estatísticas:', error.message);
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
