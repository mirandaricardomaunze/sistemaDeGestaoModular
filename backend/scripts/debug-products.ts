import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugProducts() {
    try {
        console.log('Fetching a company...');
        const company = await prisma.company.findFirst();
        if (!company) {
            console.log('No company found.');
            return;
        }
        const companyId = company.id;
        console.log('Using companyId:', companyId);

        const origin_module = 'inventory';
        const pageNum = 1;
        const limitNum = 20;
        const skip = 0;
        const sortBy = 'name';
        const sortOrder = 'asc';

        const where: any = {
            isActive: true,
            companyId: companyId,
            origin_module: origin_module
        };

        console.log('Running count...');
        const total = await prisma.product.count({ where });
        console.log('Total count:', total);

        console.log('Running findMany...');
        const products = await prisma.product.findMany({
            where,
            include: {
                supplier: { select: { id: true, name: true } },
                _count: {
                    select: {
                        stockMovements: true,
                        medication: true
                    }
                }
            },
            orderBy: { [sortBy as string]: sortOrder },
            skip,
            take: limitNum
        });

        console.log('Found products:', products.length);
    } catch (error) {
        console.error('CRASH DETECTED:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugProducts();
