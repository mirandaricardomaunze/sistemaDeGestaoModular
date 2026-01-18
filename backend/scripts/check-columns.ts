import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkColumns() {
    try {
        console.log('Checking columns of products table...');
        // Query for PostgreSQL
        const columns = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'products'
        `;
        console.log('Columns:', JSON.stringify(columns, null, 2));
    } catch (error) {
        console.error('Error checking columns:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkColumns();
