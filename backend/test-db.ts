
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing Transaction model...');
        const count = await prisma.transaction.count();
        console.log('Transaction count:', count);

        console.log('Testing Company model...');
        const companies = await prisma.company.findMany({ take: 1 });
        console.log('Found companies:', companies.length);
        if (companies.length > 0) {
            console.log('First company ID:', companies[0].id);
            const hospitalityTransactions = await prisma.transaction.findMany({
                where: {
                    companyId: companies[0].id,
                    module: 'hospitality'
                },
                take: 5
            });
            console.log('Hospitality transactions for company:', hospitalityTransactions.length);
        }
    } catch (error) {
        console.error('Database test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
