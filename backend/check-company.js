// Script para verificar dados da empresa no banco
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCompanyData() {
    try {
        console.log('\n=== Verificando Dados da Empresa ===\n');

        // 1. Verificar tabela Company
        const companies = await prisma.company.findMany();
        console.log('📊 Empresas na tabela Company:', companies.length);
        companies.forEach(c => {
            console.log(`  - ${c.name} (NUIT: ${c.nuit})`);
        });

        // 2. Verificar tabela CompanySettings
        const settings = await prisma.companySettings.findMany();
        console.log('\n⚙️  Registros na tabela CompanySettings:', settings.length);
        settings.forEach(s => {
            console.log(`  - ${s.companyName} (Trade: ${s.tradeName})`);
        });

        // 3. Se não houver CompanySettings mas houver Company, criar
        if (companies.length > 0 && settings.length === 0) {
            console.log('\n⚠️  CompanySettings vazio! Criando a partir da primeira empresa...');
            const firstCompany = companies[0];

            const newSettings = await prisma.companySettings.create({
                data: {
                    companyName: firstCompany.name,
                    tradeName: firstCompany.tradeName || firstCompany.name,
                    nuit: firstCompany.nuit || '',
                    phone: firstCompany.phone || '',
                    email: firstCompany.email || '',
                    address: firstCompany.address || '',
                    country: 'Moçambique',
                    currency: 'MZN',
                    ivaRate: 16
                }
            });

            console.log('✅ CompanySettings criado:', newSettings.companyName);
        }

        console.log('\n✅ Verificação completa!\n');

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkCompanyData();
