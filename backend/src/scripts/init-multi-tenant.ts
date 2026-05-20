import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
    console.log('🚀 Iniciando script de migração Multi-Tenant...');
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Definida' : 'NÃO DEFINIDA'}`);

    try {
        console.log('Buscando empresa padrão...');
        // 1. Criar Empresa Padrão
        let defaultCompany = await prisma.company.findFirst({
            where: { name: 'Sistema Principal' }
        });

        if (!defaultCompany) {
            console.log('Criando empresa padrão...');
            defaultCompany = await prisma.company.create({
                data: {
                    name: 'Sistema Principal',
                    tradeName: 'SaaS Default',
                    status: 'active',
                    settings: { theme: 'default' }
                }
            });
            console.log(`✅ Empresa padrão criada: ${defaultCompany.id}`);
        } else {
            console.log(`ℹ️ Empresa padrão já existe: ${defaultCompany.id}`);
        }

        // 2. Criar Módulos
        console.log('📦 Registrando módulos...');
        const modules = [
            // ...
            { code: 'PHARMACY', name: 'Controle Farmacêutico' },
            { code: 'COMMERCIAL', name: 'Comercial/Vendas' },
            { code: 'BOTTLE_STORE', name: 'Garrafeira' },
            { code: 'HOSPITALITY', name: 'Hospedagem' },
            { code: 'INVENTORY', name: 'Estoque' },
            { code: 'FISCAL', name: 'Fiscal/Contbil' },
            { code: 'crm', name: 'crm' },
            { code: 'HR', name: 'Recursos Humanos' },
        ];

        for (const m of modules) {
            await prisma.module.upsert({
                where: { code: m.code },
                update: { name: m.name },
                create: { code: m.code, name: m.name }
            });

            // Vincular à empresa padrão
            await prisma.companyModule.upsert({
                where: {
                    companyId_moduleCode: {
                        companyId: defaultCompany.id,
                        moduleCode: m.code
                    }
                },
                update: { isActive: true },
                create: {
                    companyId: defaultCompany.id,
                    moduleCode: m.code,
                    isActive: true
                }
            });
        }
        console.log('✅ Módulos registrados e vinculados.');

        // 3. Vincular usuários sem empresa
        const userUpdate = await prisma.user.updateMany({
            where: { companyId: null },
            data: { companyId: defaultCompany.id }
        });
        console.log(`✅ ${userUpdate.count} usuários vinculados à empresa padrão.`);

        // 4. Vincular produtos sem empresa
        const productUpdate = await prisma.product.updateMany({
            where: { companyId: null },
            data: { companyId: defaultCompany.id }
        });
        console.log(`✅ ${productUpdate.count} produtos vinculados à empresa padrão.`);

    } catch (e) {
        console.error('Erro na migração:', e);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
