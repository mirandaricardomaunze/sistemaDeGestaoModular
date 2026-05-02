import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        take: 10,
        select: {
            id: true,
            name: true,
            originModule: true,
            isActive: true,
            companyId: true
        }
    });

    console.log('Products Sample:');
    console.table(products);

    const counts = await prisma.product.groupBy({
        by: ['originModule', 'companyId'],
        _count: {
            _all: true
        }
    });

    console.log('Product Counts by originModule and companyId:');
    console.log(JSON.stringify(counts, null, 2));
    
    const activeCompanies = await prisma.company.findMany({
        take: 5,
        select: { id: true, name: true }
    });
    console.log('Companies:');
    console.table(activeCompanies);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
