import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'mirandamaunze122@gmail.com';
    console.log(`Checking for user: ${email}`);

    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.log('User not found.');
        return;
    }

    console.log('User found:', JSON.stringify(user, null, 2));

    // Check if user is associated with a company
    if (!user.companyId) {
        console.log('User has no companyId. Proceeding with deletion...');

        // Delete UserModuleRole records manually since we don't know the relation name on User
        const deletedRoles = await prisma.userModuleRole.deleteMany({
            where: { userId: user.id }
        });
        console.log(`Deleted ${deletedRoles.count} roles.`);

        // Delete from other tables that might have been hit
        await prisma.sale.deleteMany({ where: { userId: user.id } });
        await prisma.employee.deleteMany({ where: { userId: user.id } });

        await prisma.user.delete({
            where: { id: user.id }
        });

        console.log('User deleted successfully.');
    } else {
        console.log('User is associated with a company. Deletion aborted for safety.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
