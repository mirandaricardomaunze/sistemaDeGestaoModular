
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    console.log('--- Environment Check ---');
    console.log('BACKUP_ENABLED:', process.env.BACKUP_ENABLED);
    console.log('GDRIVE_ENABLED:', process.env.GDRIVE_ENABLED);
    console.log('GDRIVE_CLIENT_ID:', process.env.GDRIVE_CLIENT_ID ? 'SET' : 'NOT SET');
    console.log('GDRIVE_CLIENT_SECRET:', process.env.GDRIVE_CLIENT_SECRET ? 'SET' : 'NOT SET');
    console.log('GDRIVE_REFRESH_TOKEN:', process.env.GDRIVE_REFRESH_TOKEN ? 'SET' : 'NOT SET');
    console.log('GDRIVE_FOLDER_ID:', process.env.GDRIVE_FOLDER_ID || 'NOT SET');

    console.log('\n--- Database Check ---');
    try {
        const companies = await prisma.company.findMany({
            where: { status: 'active' },
            select: { id: true, name: true }
        });
        console.log('Active Companies:', companies);
    } catch (err) {
        console.error('Error querying companies:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
