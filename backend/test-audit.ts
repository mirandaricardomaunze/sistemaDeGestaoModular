import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- RECENT AUDIT LOGS ---');
    const logs = await prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
    });

    if (logs.length === 0) {
        console.log('Nenhum log encontrado ainda.');
    } else {
        logs.forEach(log => {
            console.log(`[${log.createdAt.toISOString()}] ${log.userName} -> ${log.action} ${log.entity} (#${log.entityId || 'N/A'})`);
            if (log.newData) console.log(`   Data: ${JSON.stringify(log.newData).substring(0, 100)}...`);
        });
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
