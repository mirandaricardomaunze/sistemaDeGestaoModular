// Script para sincronizar dados da empresa
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncCompanyData() {
    try {
        console.log('\n=== Sincronizando Dados da Empresa ===\n');

        // Pegar a primeira empresa válida (com NUIT)
        const company = await prisma.company.findFirst({
            where: {
                nuit: { not: null }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!company) {
            console.log('❌ Nenhuma empresa encontrada com NUIT');
            return;
        }

        console.log(`📊 Empresa encontrada: ${company.name}`);
        console.log(`   NUIT: ${company.nuit}`);
        console.log(`   Trade Name: ${company.tradeName || 'N/A'}`);

        // Deletar todos os CompanySettings antigos
        await prisma.companySettings.deleteMany({});
        console.log('\n🗑️  CompanySettings antigos removidos');

        // Criar novo CompanySettings com dados corretos
        const newSettings = await prisma.companySettings.create({
            data: {
                companyName: company.name,
                tradeName: company.tradeName || company.name,
                nuit: company.nuit || '',
                phone: company.phone || '',
                email: company.email || '',
                address: company.address || '',
                country: 'Moçambique',
                currency: 'MZN',
                ivaRate: 16
            }
        });

        console.log('\n✅ CompanySettings criado com sucesso!');
        console.log(`   Nome: ${newSettings.companyName}`);
        console.log(`   Trade Name: ${newSettings.tradeName}`);
        console.log(`   NUIT: ${newSettings.nuit}`);

        console.log('\n🎉 Sincronização completa! Recarregue a página para ver as alterações.\n');

    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await prisma.$disconnect();
    }
}

syncCompanyData();
