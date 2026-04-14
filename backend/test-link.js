const { PrismaClient } = require('@prisma/client');
require('dotenv/config');
const p = new PrismaClient();

async function main() {
    const COMPANY_ID = '3e6e82ca-6c34-4c65-9f3b-f0dad5e569ec';

    // Link admin to company
    const u = await p.user.update({
        where: { email: 'admin@sistema.co.mz' },
        data: { companyId: COMPANY_ID }
    });
    console.log('Admin linked to company:', u.companyId);

    // Verify company exists
    const c = await p.company.findUnique({ where: { id: COMPANY_ID }, select: { name: true, id: true } });
    console.log('Company:', c?.name);

    await p.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
