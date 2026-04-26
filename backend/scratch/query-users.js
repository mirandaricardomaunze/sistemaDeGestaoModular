const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const users = await p.user.findMany({
        select: { email: true, name: true, role: true },
        take: 5
    });
    console.log(JSON.stringify(users, null, 2));
    await p.$disconnect();
}

main().catch(console.error);
