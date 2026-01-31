import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const companies = await prisma.company.findMany({
            select: {
                id: true,
                name: true,
            },
        });

        console.log('--- EMPRESAS CADASTRADAS ---');
        if (companies.length === 0) {
            console.log('Nenhuma empresa encontrada.');
        } else {
            companies.forEach((company) => {
                console.log(`ID: ${company.id} | Nome: ${company.name}`);
            });
        }
        console.log('----------------------------');
    } catch (error) {
        console.error('Erro ao listar empresas:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
