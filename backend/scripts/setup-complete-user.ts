import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function setupCompleteUser() {
    try {
        console.log('🔄 Configurando utilizador completo com empresa e módulos...\n');

        // 1. Ensure modules exist
        const pharmacyModule = await prisma.module.findUnique({
            where: { code: 'PHARMACY' }
        });

        if (!pharmacyModule) {
            console.error('❌ Módulos não encontrados. Execute primeiro: npx prisma db seed');
            process.exit(1);
        }

        // 2. Create or get company
        let company = await prisma.company.findFirst({
            where: { nuit: '100000001' }
        });

        if (!company) {
            console.log('📦 Criando empresa de teste...');
            company = await prisma.company.create({
                data: {
                    name: 'Empresa Teste',
                    tradeName: 'Empresa Teste Lda',
                    nuit: '100000001',
                    phone: '+258 84 000 1000',
                    email: 'empresa@teste.co.mz',
                    address: 'Av. Teste, 123',
                    businessType: 'pharmacy',
                    status: 'active'
                }
            });
            console.log('✅ Empresa criada:', company.name);
        } else {
            console.log('✅ Empresa encontrada:', company.name);
        }

        // 3. Link all modules to company
        const allModules = await prisma.module.findMany();
        console.log(`\n📋 Associando ${allModules.length} módulos à empresa...`);

        for (const module of allModules) {
            await prisma.companyModule.upsert({
                where: {
                    companyId_moduleId: {
                        companyId: company.id,
                        moduleId: module.id
                    }
                },
                update: { isActive: true },
                create: {
                    companyId: company.id,
                    moduleId: module.id,
                    isActive: true
                }
            });
            console.log(`   ✓ ${module.name} (${module.code})`);
        }

        // 4. Create/update user with company
        const email = 'teste@sistema.co.mz';
        const password = 'teste123';
        const hashedPassword = await bcrypt.hash(password, 12);

        let user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (user) {
            console.log('\n👤 Atualizando utilizador existente...');
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: hashedPassword,
                    isActive: true,
                    companyId: company.id,
                    role: 'admin',
                    otp: null,
                    otpExpiry: null
                }
            });
        } else {
            console.log('\n👤 Criando novo utilizador...');
            user = await prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    name: 'Utilizador Teste',
                    role: 'admin',
                    phone: '+258 84 999 9999',
                    isActive: true,
                    companyId: company.id
                }
            });
        }

        // 5. Assign company_admin role
        const companyAdminRole = await prisma.role.findUnique({
            where: { code: 'company_admin' }
        });

        if (companyAdminRole) {
            const existingRole = await prisma.userModuleRole.findFirst({
                where: {
                    userId: user.id,
                    moduleId: null,
                    roleId: companyAdminRole.id
                }
            });

            if (!existingRole) {
                await prisma.userModuleRole.create({
                    data: {
                        userId: user.id,
                        roleId: companyAdminRole.id
                    }
                });
            }
            console.log('✅ Role de administrador atribuído');
        }

        // 6. Create company settings
        await prisma.companySettings.upsert({
            where: { id: `settings-${company.id}` },
            update: {},
            create: {
                id: `settings-${company.id}`,
                companyName: company.name,
                tradeName: company.tradeName || company.name,
                nuit: company.nuit,
                phone: company.phone || '',
                email: company.email || '',
                address: company.address || '',
                country: 'Moçambique',
                currency: 'MZN',
                ivaRate: 16,
                businessType: company.businessType
            }
        });

        console.log('\n✅ CONFIGURAÇÃO COMPLETA!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 CREDENCIAIS DE LOGIN:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Email:    ${email}`);
        console.log(`   Senha:    ${password}`);
        console.log(`   Empresa:  ${company.name}`);
        console.log(`   Módulos:  ${allModules.length} módulos ativos`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

setupCompleteUser();
