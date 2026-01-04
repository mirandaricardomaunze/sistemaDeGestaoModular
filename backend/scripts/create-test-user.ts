import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTestUser() {
    try {
        const email = 'teste@sistema.co.mz';
        const password = 'teste123';
        const name = 'Utilizador Teste';

        console.log(`🔄 Criando utilizador de teste...`);

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existingUser) {
            console.log(`⚠️  Utilizador já existe. Atualizando senha...`);
            const hashedPassword = await bcrypt.hash(password, 12);

            await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    password: hashedPassword,
                    isActive: true,
                    otp: null,
                    otpExpiry: null
                }
            });

            console.log(`✅ Senha atualizada com sucesso!`);
        } else {
            // Create new test user
            const hashedPassword = await bcrypt.hash(password, 12);

            const user = await prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    name: name,
                    role: 'admin',
                    phone: '+258 84 999 9999',
                    isActive: true
                }
            });

            // Assign company_admin role
            const companyAdminRole = await prisma.role.findUnique({
                where: { code: 'company_admin' }
            });

            if (companyAdminRole) {
                await prisma.userModuleRole.create({
                    data: {
                        userId: user.id,
                        moduleId: null,
                        roleId: companyAdminRole.id
                    }
                });
            }

            console.log(`✅ Utilizador criado com sucesso!`);
        }

        console.log(`\n📋 Credenciais de Login:`);
        console.log(`   Email: ${email}`);
        console.log(`   Senha: ${password}`);
        console.log(`   Nome: ${name}`);
        console.log(`\n🔐 Use estas credenciais para fazer login no sistema.`);

    } catch (error) {
        console.error('❌ Erro ao criar utilizador:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

createTestUser();
