import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetPassword() {
    try {
        const email = process.argv[2] || 'admin@sistema.co.mz';
        const newPassword = process.argv[3] || 'admin123';

        console.log(`🔄 Resetando senha para: ${email}`);

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!user) {
            console.error(`❌ Utilizador não encontrado: ${email}`);
            console.log('\n📋 Utilizadores disponíveis:');
            const allUsers = await prisma.user.findMany({
                select: { email: true, name: true, role: true }
            });
            allUsers.forEach(u => {
                console.log(`   - ${u.email} (${u.name}) - ${u.role}`);
            });
            process.exit(1);
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password and activate user
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                isActive: true,
                otp: null,
                otpExpiry: null
            }
        });

        console.log(`✅ Senha resetada com sucesso!`);
        console.log(`\n📋 Credenciais de Login:`);
        console.log(`   Email: ${email}`);
        console.log(`   Senha: ${newPassword}`);
        console.log(`   Status: Ativo`);

    } catch (error) {
        console.error('❌ Erro ao resetar senha:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

resetPassword();
