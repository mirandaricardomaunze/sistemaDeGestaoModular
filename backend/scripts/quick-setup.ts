import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function quickSetup() {
    try {
        console.log('🚀 Configuração Rápida do Sistema\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 1. Create Modules
        console.log('📦 Criando módulos de negócio...');
        const modules = [
            { code: 'PHARMACY', name: 'Farmácia', description: 'Gestão completa de farmácia', icon: 'HiOutlineBeaker', color: '#10B981' },
            { code: 'COMMERCIAL', name: 'Comércio', description: 'Solução comercial', icon: 'HiOutlineShoppingCart', color: '#3B82F6' },
            { code: 'BOTTLE_STORE', name: 'Garrafeira', description: 'Gestão de bebidas', icon: 'HiOutlineBuildingStorefront', color: '#8B5CF6' },
            { code: 'HOTEL', name: 'Hotelaria', description: 'Gestão hoteleira', icon: 'HiOutlineHomeModern', color: '#F59E0B' },
            { code: 'RESTAURANT', name: 'Restaurante', description: 'Gestão de restaurante', icon: 'HiOutlineCake', color: '#EF4444' },
            { code: 'LOGISTICS', name: 'Logística', description: 'Gestão de logística', icon: 'HiOutlineTruck', color: '#6366F1' },
        ];

        for (const mod of modules) {
            await prisma.module.upsert({
                where: { code: mod.code },
                update: {},
                create: mod
            });
        }
        console.log(`✅ ${modules.length} módulos criados\n`);

        // 2. Create Roles
        console.log('👥 Criando roles RBAC...');
        const roles = [
            { code: 'company_admin', name: 'Administrador da Empresa', description: 'Acesso total', isSystem: true },
            { code: 'module_admin', name: 'Administrador de Módulo', description: 'Gestão de módulo', isSystem: true },
            { code: 'module_operator', name: 'Operador', description: 'Operações diárias', isSystem: true },
        ];

        for (const role of roles) {
            await prisma.role.upsert({
                where: { code: role.code },
                update: {},
                create: role
            });
        }
        console.log(`✅ ${roles.length} roles criados\n`);

        // 3. Create Company
        console.log('🏢 Criando empresa...');
        const company = await prisma.company.upsert({
            where: { nuit: '100000001' },
            update: {},
            create: {
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
        console.log(`✅ Empresa criada: ${company.name}\n`);

        // 4. Link ALL modules to company
        console.log('🔗 Associando módulos à empresa...');
        const allModules = await prisma.module.findMany();
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
        }
        console.log(`✅ ${allModules.length} módulos associados\n`);

        // 5. Create User
        console.log('👤 Criando utilizador...');
        const email = 'teste@sistema.co.mz';
        const password = 'teste123';
        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.upsert({
            where: { email: email.toLowerCase() },
            update: {
                password: hashedPassword,
                isActive: true,
                companyId: company.id
            },
            create: {
                email: email.toLowerCase(),
                password: hashedPassword,
                name: 'Utilizador Teste',
                role: 'admin',
                phone: '+258 84 999 9999',
                isActive: true,
                companyId: company.id
            }
        });
        console.log(`✅ Utilizador criado: ${user.name}\n`);

        // 6. Assign Role
        console.log('🔐 Atribuindo permissões...');
        const companyAdminRole = await prisma.role.findUnique({
            where: { code: 'company_admin' }
        });

        if (companyAdminRole) {
            const existingRole = await prisma.userModuleRole.findFirst({
                where: {
                    userId: user.id,
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
        }
        console.log('✅ Permissões atribuídas\n');

        // 7. Create Company Settings
        console.log('⚙️  Criando configurações...');
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
        console.log('✅ Configurações criadas\n');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ CONFIGURAÇÃO COMPLETA!\n');
        console.log('📋 CREDENCIAIS DE LOGIN:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Email:    ${email}`);
        console.log(`   Senha:    ${password}`);
        console.log(`   Empresa:  ${company.name}`);
        console.log(`   Módulos:  ${allModules.length} módulos ativos`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('🎉 Pode agora fazer login no sistema!\n');

    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

quickSetup();
