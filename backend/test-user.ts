
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing User model...');
        const user = await prisma.user.findFirst();
        console.log('User found:', user ? user.email : 'No user found');
    } catch (error) {
        console.error('User test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
