import { prisma } from './lib/prisma';

async function test() {
    try {
        const company = await prisma.company.findFirst();
        if (!company) {
            console.error('Nenhuma empresa encontrada para o teste.');
            return;
        }

        console.log('--- Iniciando Teste de Criação de Cliente ---');
        console.log('Empresa ID:', company.id);

        const testName = "Cliente Teste de Estabilidade";
        const testCode = "TEST-" + Math.floor(Math.random() * 10000);

        const customer = await prisma.customer.create({
            data: {
                name: testName,
                code: testCode,
                phone: "840000000",
                type: 'individual',
                company: { connect: { id: company.id } }
            }
        });

        console.log('✅ SUCESSO: Cliente criado sem erros de validação.');
        console.log('Dados do Cliente:', {
            id: customer.id,
            name: customer.name,
            code: customer.code,
            companyId: customer.companyId
        });

        // Limpeza (opcional, mas vamos deixar para o usuário ver no banco)
        // await prisma.customer.delete({ where: { id: customer.id } });
        
    } catch (error: any) {
        console.error('❌ ERRO NO TESTE:');
        console.error(error.message || error);
    } finally {
        await prisma.$disconnect();
    }
}

test();
