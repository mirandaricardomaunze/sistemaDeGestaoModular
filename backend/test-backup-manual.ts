
import 'dotenv/config';
import { backupService } from './src/services/backup.service';
import { googleDriveService } from './src/services/googleDrive.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runBackup() {
    console.log('--- Manual Backup Trigger ---');
    console.log('GDRIVE_ENABLED:', process.env.GDRIVE_ENABLED);
    console.log('GDRIVE_REFRESH_TOKEN:', process.env.GDRIVE_REFRESH_TOKEN ? 'SET' : 'NOT SET');

    try {
        const company = await prisma.company.findFirst({
            where: { status: 'active' }
        });

        if (!company) {
            console.log('No active company found to test backup.');
            return;
        }

        console.log(`Testing backup for company: ${company.name} (${company.id})`);

        // Check if drive is configured
        console.log('Is Google Drive configured?', googleDriveService.isConfigured());

        const result = await backupService.createBackup(company.id);
        console.log('Backup result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Error during manual backup:', err);
    } finally {
        await prisma.$disconnect();
    }
}

runBackup();
