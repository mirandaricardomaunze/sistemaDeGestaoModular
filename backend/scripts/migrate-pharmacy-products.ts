import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
    console.log('Iniciando migração de produtos da farmácia...');

    try {
        // Encontrar todos os IDs de produtos que estão associados a medicamentos
        const medications = await prisma.medication.findMany({
            select: { productId: true }
        });

        const productIds = medications.map(m => m.productId);

        if (productIds.length === 0) {
            console.log('Nenhum medicamento encontrado para migrar.');
            return;
        }

        console.log(`Encontrados ${productIds.length} medicamentos. Atualizando produtos correspondentes...`);

        // Atualizar o origin_module para 'pharmacy' para esses produtos
        const result = await prisma.product.updateMany({
            where: {
                id: { in: productIds }
            },
            data: {
                origin_module: 'pharmacy'
            }
        });

        console.log(`Migração concluída com sucesso! ${result.count} produtos atualizados.`);
    } catch (error) {
        console.error('Erro durante a migração:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
