import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addLogisticsModule() {
    try {
        console.log('🔧 Adding logistics module to admin user...');

        // Find the admin user
        const admin = await prisma.user.findUnique({
            where: { email: 'admin@sistema.co.mz' },
            include: { company: true }
        });

        if (!admin) {
            console.error('❌ Admin user not found');
            return;
        }

        console.log('✅ Found admin user:', admin.email);

        // Find the logistics module
        const logisticsModule = await prisma.module.findUnique({
            where: { code: 'LOGISTICS' }
        });

        if (!logisticsModule) {
            console.error('❌ Logistics module not found in database');
            return;
        }

        console.log('✅ Found logistics module:', logisticsModule.name);

        // Check if user already has the module
        if (admin.activeModules && admin.activeModules.includes('LOGISTICS')) {
            console.log('ℹ️  User already has logistics module');
            return;
        }

        // Add logistics module to user's activeModules
        const currentModules = admin.activeModules || [];
        await prisma.user.update({
            where: { id: admin.id },
            data: {
                activeModules: [...currentModules, 'LOGISTICS']
            }
        });

        console.log('✅ Logistics module added to user successfully!');
        console.log('📋 Active modules:', [...currentModules, 'LOGISTICS']);
        console.log('\n🔄 Please refresh your browser to see the changes');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

addLogisticsModule();
