
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkProducts() {
    const products = await prisma.product.findMany({
        select: {
            id: true,
            name: true,
            price: true,
            costPrice: true,
            packSize: true
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
    });

    console.log('--- ÚLTIMOS 10 PRODUTOS ---');
    products.forEach(p => {
        console.log(`Nome: ${p.name}`);
        console.log(`Preço Venda: ${p.price}`);
        console.log(`Preço Custo: ${p.costPrice}`);
        console.log(`Un por Caixa: ${p.packSize}`);
        console.log('---');
    });
}

checkProducts().catch(console.error).finally(() => prisma.$disconnect());
