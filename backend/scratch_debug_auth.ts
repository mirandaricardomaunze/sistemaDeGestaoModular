
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debugAuth() {
    console.log('--- VERIFICANDO USUÁRIOS E EMPRESAS ---');
    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, companyId: true, role: true },
        take: 5
    });
    console.log('Usuários:', JSON.stringify(users, null, 2));

    console.log('\n--- VERIFICANDO ARMAZÉNS ---');
    const warehouses = await prisma.warehouse.findMany({
        take: 5
    });
    console.log('Armazéns:', JSON.stringify(warehouses, null, 2));
}

debugAuth().catch(console.error).finally(() => prisma.$disconnect());
