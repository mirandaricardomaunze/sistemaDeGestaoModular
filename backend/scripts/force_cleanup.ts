import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'mirandamaunze122@gmail.com';
    console.log(`Force cleaning up user and company for: ${email}`);

    const user = await prisma.user.findFirst({
        where: { email },
        include: {
            company: true
        }
    });

    if (!user) {
        console.log('User not found.');
        return;
    }

    const companyId = user.companyId;

    // Delete roles
    await prisma.userModuleRole.deleteMany({ where: { userId: user.id } });

    // Delete user
    await prisma.user.delete({ where: { id: user.id } });
    console.log('User deleted.');

    if (companyId) {
        // Delete company modules
        await prisma.companyModule.deleteMany({ where: { companyId } });

        // Delete the company
        await prisma.company.delete({ where: { id: companyId } });
        console.log(`Company ${companyId} deleted.`);
    }

    console.log('Cleanup complete.');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
