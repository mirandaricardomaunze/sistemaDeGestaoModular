import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

interface GoogleDriveConfig {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    refreshToken?: string;
    folderId?: string;
}

class GoogleDriveService {
    private config: GoogleDriveConfig;
    private drive: any;

    constructor() {
        this.config = {
            enabled: process.env.GDRIVE_ENABLED === 'true',
            clientId: process.env.GDRIVE_CLIENT_ID,
            clientSecret: process.env.GDRIVE_CLIENT_SECRET,
            redirectUri: process.env.GDRIVE_REDIRECT_URI || 'http://localhost:3001/api/gdrive/callback',
            refreshToken: process.env.GDRIVE_REFRESH_TOKEN,
            folderId: process.env.GDRIVE_FOLDER_ID,
        };

        if (this.config.enabled) {
            this.initializeDrive();
        }
    }

    /**
     * Inicializa o cliente do Google Drive
     */
    private initializeDrive() {
        try {
            const oauth2Client = new google.auth.OAuth2(
                this.config.clientId,
                this.config.clientSecret,
                this.config.redirectUri
            );

            if (this.config.refreshToken) {
                oauth2Client.setCredentials({
                    refresh_token: this.config.refreshToken,
                });
            }

            this.drive = google.drive({ version: 'v3', auth: oauth2Client });
            console.log('✅ Google Drive integrado com sucesso');
        } catch (error: unknown) {
            console.error('âŒ Erro ao inicializar Google Drive:', error.message);
        }
    }

    /**
     * Verifica se o serviço está configurado e pronto
     */
    isConfigured(): boolean {
        return !!(
            this.config.enabled &&
            this.config.clientId &&
            this.config.clientSecret &&
            this.config.refreshToken
        );
    }

    /**
     * Faz upload de um arquivo para o Google Drive
     */
    async uploadFile(
        filepath: string,
        filename?: string,
        companyId?: string
    ): Promise<{ success: boolean; fileId?: string; error?: string }> {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: 'Google Drive não está configurado',
            };
        }

        try {
            const fileMetadata: any = {
                name: filename || path.basename(filepath),
            };

            // Se tiver companyId, tentamos criar/pegar a pasta da empresa
            let parentFolderId = this.config.folderId;
            if (companyId) {
                parentFolderId = await this.findOrCreateCompanyFolder(companyId);
            }

            // Se tiver folder ID (da empresa ou global), adiciona aos parents
            if (parentFolderId) {
                fileMetadata.parents = [parentFolderId];
            }

            const media = {
                mimeType: 'application/sql',
                body: fs.createReadStream(filepath),
            };

            console.log(`â˜ï¸  Fazendo upload para Google Drive: ${fileMetadata.name}`);

            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, size, createdTime',
            });

            const fileId = response.data.id;
            const fileSize = response.data.size;
            const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

            console.log(`✅ Upload concluído: ${fileMetadata.name} (${fileSizeMB} MB)`);
            console.log(`ðŸ“ File ID: ${fileId}`);

            return {
                success: true,
                fileId,
            };
        } catch (error: unknown) {
            console.error('âŒ Erro ao fazer upload:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Busca ou cria uma pasta para a empresa no Google Drive
     */
    private async findOrCreateCompanyFolder(companyId: string): Promise<string | undefined> {
        try {
            const parentId = this.config.folderId;
            const query = parentId
                ? `'${parentId}' in parents and name = '${companyId}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
                : `name = '${companyId}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

            const response = await this.drive.files.list({
                q: query,
                fields: 'files(id)',
                pageSize: 1,
            });

            if (response.data.files && response.data.files.length > 0) {
                return response.data.files[0].id;
            }

            // Se não encontrou, cria a pasta
            const folderMetadata: any = {
                name: companyId,
                mimeType: 'application/vnd.google-apps.folder',
            };

            if (parentId) {
                folderMetadata.parents = [parentId];
            }

            const folder = await this.drive.files.create({
                requestBody: folderMetadata,
                fields: 'id',
            });

            console.log(`ðŸ“ Pasta criada no Google Drive para empresa ${companyId}: ${folder.data.id}`);
            return folder.data.id;
        } catch (error: unknown) {
            console.error('âŒ Erro ao buscar/criar pasta da empresa no Drive:', error.message);
            return this.config.folderId; // Fallback para a pasta raiz se der erro
        }
    }

    /**
     * Lista arquivos de backup no Google Drive para uma empresa específica ou global
     */
    async listBackups(companyId?: string): Promise<{
        success: boolean;
        files?: Array<{ id: string; name: string; size: string; createdTime: string }>;
        error?: string;
    }> {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: 'Google Drive não está configurado',
            };
        }

        try {
            let parentId = this.config.folderId;
            if (companyId) {
                parentId = await this.findOrCreateCompanyFolder(companyId);
            }

            const query = parentId
                ? `'${parentId}' in parents and name contains 'backup-' and trashed=false`
                : `name contains 'backup-' and trashed=false`;

            const response = await this.drive.files.list({
                q: query,
                fields: 'files(id, name, size, createdTime)',
                orderBy: 'createdTime desc',
                pageSize: 100,
            });

            const files = response.data.files.map((file: any) => ({
                id: file.id,
                name: file.name,
                size: file.size ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'N/A',
                createdTime: file.createdTime,
            }));

            return {
                success: true,
                files,
            };
        } catch (error: unknown) {
            console.error('âŒ Erro ao listar backups:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Faz download de um arquivo do Google Drive
     */
    async downloadFile(
        fileId: string,
        destinationPath: string
    ): Promise<{ success: boolean; error?: string }> {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: 'Google Drive não está configurado',
            };
        }

        try {
            const dest = fs.createWriteStream(destinationPath);

            const response = await this.drive.files.get(
                { fileId, alt: 'media' },
                { responseType: 'stream' }
            );

            return new Promise((resolve, reject) => {
                response.data
                    .on('end', () => {
                        console.log(`✅ Download concluído: ${destinationPath}`);
                        resolve({ success: true });
                    })
                    .on('error', (err: any) => {
                        console.error('âŒ Erro no download:', err.message);
                        reject({ success: false, error: err.message });
                    })
                    .pipe(dest);
            });
        } catch (error: unknown) {
            console.error('âŒ Erro ao fazer download:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Deleta um arquivo do Google Drive
     */
    async deleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: 'Google Drive não está configurado',
            };
        }

        try {
            await this.drive.files.delete({ fileId });
            console.log(`ðŸ—‘ï¸  Arquivo deletado do Google Drive: ${fileId}`);

            return { success: true };
        } catch (error: unknown) {
            console.error('âŒ Erro ao deletar arquivo:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Gera URL de autorização para obter refresh token
     */
    getAuthUrl(): string {
        const oauth2Client = new google.auth.OAuth2(
            this.config.clientId,
            this.config.clientSecret,
            this.config.redirectUri
        );

        const scopes = ['https://www.googleapis.com/auth/drive.file'];

        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent',
        });
    }

    /**
     * Troca o código de autorização por refresh token
     */
    async getTokenFromCode(code: string): Promise<{
        success: boolean;
        refreshToken?: string;
        error?: string;
    }> {
        try {
            const oauth2Client = new google.auth.OAuth2(
                this.config.clientId,
                this.config.clientSecret,
                this.config.redirectUri
            );

            const { tokens } = await oauth2Client.getToken(code);

            if (!tokens.refresh_token) {
                return {
                    success: false,
                    error: 'Refresh token não recebido. Tente revogar acesso e autorizar novamente.',
                };
            }

            return {
                success: true,
                refreshToken: tokens.refresh_token,
            };
        } catch (error: unknown) {
            console.error('âŒ Erro ao obter token:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Limpa backups antigos do Google Drive para uma empresa específica ou global
     */
    async cleanOldBackups(retentionDays: number = 30, companyId?: string): Promise<{
        success: boolean;
        deletedCount?: number;
        error?: string;
    }> {
        if (!this.isConfigured()) {
            return {
                success: false,
                error: 'Google Drive não está configurado',
            };
        }

        try {
            const listResult = await this.listBackups(companyId);

            if (!listResult.success || !listResult.files) {
                return {
                    success: false,
                    error: 'Erro ao listar backups',
                };
            }

            const now = new Date();
            const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
            let deletedCount = 0;

            for (const file of listResult.files) {
                const fileDate = new Date(file.createdTime);
                const fileAge = now.getTime() - fileDate.getTime();

                if (fileAge > retentionMs) {
                    const deleteResult = await this.deleteFile(file.id);
                    if (deleteResult.success) {
                        deletedCount++;
                        console.log(`ðŸ—‘ï¸  Backup antigo removido do Drive: ${file.name}`);
                    }
                }
            }

            if (deletedCount > 0) {
                console.log(`ðŸ§¹ ${deletedCount} backup(s) antigo(s) removido(s) do Google Drive`);
            }

            return {
                success: true,
                deletedCount,
            };
        } catch (error: unknown) {
            console.error('âŒ Erro ao limpar backups antigos:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

// Exportar instância singleton
export const googleDriveService = new GoogleDriveService();
