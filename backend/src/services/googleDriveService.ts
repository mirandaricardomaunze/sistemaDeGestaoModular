import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { ApiError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

// The googleapis SDK uses heavily overloaded types (variadic responses with
// Schema$File vs Readable bodies) that resist narrow typing without rewriting
// every call. Use a loose facade that matches the actual runtime API we use.
type DriveFiles = {
    list(args: { q: string; fields: string; spaces?: string; orderBy?: string }): Promise<{ data: { files?: Array<{ id?: string | null; name?: string | null; size?: string | null; createdTime?: string | null }> } }>;
    create(args: { resource: object; media?: { mimeType: string; body: NodeJS.ReadableStream }; fields: string }): Promise<{ data: { id?: string | null } }>;
    delete(args: { fileId: string }): Promise<void>;
    get(args: { fileId: string; alt?: string }, opts?: { responseType?: 'stream' }): Promise<{ data: NodeJS.ReadableStream }>;
};
type DriveClient = { files: DriveFiles };

export class GoogleDriveService {
    private config = {
        enabled: process.env.GDRIVE_ENABLED === 'true',
        clientId: process.env.GDRIVE_CLIENT_ID,
        clientSecret: process.env.GDRIVE_CLIENT_SECRET,
        redirectUri: process.env.GDRIVE_REDIRECT_URI || 'http://localhost:3001/api/gdrive/callback',
        refreshToken: process.env.GDRIVE_REFRESH_TOKEN,
        folderId: process.env.GDRIVE_FOLDER_ID,
    };
    private drive?: DriveClient;

    constructor() {
        if (this.config.enabled && this.config.clientId && this.config.clientSecret && this.config.refreshToken) {
            this.initializeDrive();
        }
    }

    private initializeDrive() {
        try {
            const oauth2Client = new google.auth.OAuth2(this.config.clientId, this.config.clientSecret, this.config.redirectUri);
            oauth2Client.setCredentials({ refresh_token: this.config.refreshToken });
            this.drive = google.drive({ version: 'v3', auth: oauth2Client }) as unknown as DriveClient;
        } catch (error: unknown) {
            logger.error('Google Drive initialization failed', { message: (error as Error)?.message });
        }
    }

    public isConfigured() {
        return !!this.drive;
    }

    /**
     * Obtém ou cria uma pasta específica no Google Drive
     */
    private async getOrCreateFolder(folderName: string, parentFolderId?: string): Promise<string> {
        if (!this.drive) throw ApiError.internal('Google Drive não inicializado');

        let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        if (parentFolderId) {
            query += ` and '${parentFolderId}' in parents`;
        }

        const response = await this.drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (response.data.files && response.data.files.length > 0) {
            const id = response.data.files[0].id;
            if (id) return id;
        }

        // Criar pasta se não existir
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentFolderId ? [parentFolderId] : [],
        };

        const file = await this.drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        });

        if (!file.data.id) throw ApiError.internal('Falha ao criar pasta no Google Drive');
        return file.data.id;
    }

    /**
     * Faz upload de um arquivo para o Google Drive
     */
    async uploadFile(filepath: string, filename?: string, companyId?: string): Promise<{ success: boolean; fileId?: string; error?: string }> {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Drive não configurado' };
        }

        if (!this.drive) return { success: false, error: 'Google Drive não inicializado' };
        try {
            const name = filename || path.basename(filepath);
            let parentId = this.config.folderId;

            // Se companyId for fornecido, subir para uma pasta específica da empresa
            if (companyId) {
                // Se tiver uma pasta base configurada, criar a pasta da empresa dentro dela
                parentId = await this.getOrCreateFolder(companyId, this.config.folderId || undefined);
            }

            const fileMetadata = {
                name: name,
                parents: parentId ? [parentId] : [],
            };

            const media = {
                mimeType: 'application/sql',
                body: fs.createReadStream(filepath),
            };

            const file = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id',
            });

            return { success: true, fileId: file.data.id ?? undefined };
        } catch (error: unknown) {
            logger.error('Google Drive upload failed', { message: (error as Error)?.message });
            return { success: false, error: (error as Error)?.message };
        }
    }

    /**
     * Lista backups no Google Drive para uma empresa
     */
    async listBackups(companyId: string): Promise<Array<{ id: string; name: string; size: string; createdTime: string }>> {
        if (!this.isConfigured() || !this.drive) return [];

        try {
            let parentId = this.config.folderId;
            if (companyId) {
                parentId = await this.getOrCreateFolder(companyId, this.config.folderId || undefined);
            }

            let query = "mimeType != 'application/vnd.google-apps.folder' and trashed = false";
            if (parentId) {
                query += ` and '${parentId}' in parents`;
            }

            const response = await this.drive.files.list({
                q: query,
                fields: 'files(id, name, size, createdTime)',
                orderBy: 'createdTime desc',
            });

            return (response.data.files || []).map((f) => ({
                id: f.id ?? '',
                name: f.name ?? '',
                size: f.size ?? '0',
                createdTime: f.createdTime ?? '',
            }));
        } catch (error: unknown) {
            logger.error('Google Drive list backups failed', { message: (error as Error)?.message });
            return [];
        }
    }

    /**
     * Remove a single file by ID
     */
    async deleteFile(fileId: string): Promise<void> {
        if (!this.drive) throw ApiError.internal('Google Drive não inicializado');
        await this.drive.files.delete({ fileId });
    }

    /**
     * Stream a file's content back to the caller
     */
    async downloadFile(fileId: string): Promise<NodeJS.ReadableStream> {
        if (!this.drive) throw ApiError.internal('Google Drive não inicializado');
        const response = await this.drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
        return response.data;
    }

    /**
     * Remove backups antigos do Google Drive
     */
    async cleanOldBackups(retentionDays: number, companyId?: string): Promise<{ success: boolean; deletedCount: number; error?: string }> {
        if (!this.isConfigured() || !this.drive) return { success: false, deletedCount: 0, error: 'Não configurado' };

        try {
            let parentId = this.config.folderId;
            if (companyId) {
                parentId = await this.getOrCreateFolder(companyId, this.config.folderId || undefined);
            }

            let query = "mimeType != 'application/vnd.google-apps.folder' and trashed = false";
            if (parentId) {
                query += ` and '${parentId}' in parents`;
            }

            const response = await this.drive.files.list({
                q: query,
                fields: 'files(id, name, createdTime)',
            });

            const files = response.data.files || [];
            const now = new Date();
            const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
            let deletedCount = 0;

            for (const file of files) {
                if (!file.id || !file.createdTime) continue;
                const createdTime = new Date(file.createdTime);
                const age = now.getTime() - createdTime.getTime();

                if (age > retentionMs) {
                    await this.drive.files.delete({ fileId: file.id });
                    deletedCount++;
                }
            }

            return { success: true, deletedCount };
        } catch (error: unknown) {
            logger.error('Google Drive clean old backups failed', { message: (error as Error)?.message });
            return { success: false, deletedCount: 0, error: (error as Error)?.message };
        }
    }
}

export const googleDriveService = new GoogleDriveService();
