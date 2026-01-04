import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking database for invalid category values...');

    // Get all distinct category values
    const categories = await prisma.$queryRaw<{ category: string }[]>`
        SELECT DISTINCT category FROM products
    `;

    console.log('Categories found in database:');
    console.log(categories);

    // Valid categories
    const validCategories = ['electronics', 'food', 'medicine', 'clothing', 'furniture', 'cosmetics', 'beverages', 'cleaning', 'office', 'other'];

    for (const cat of categories) {
        if (!validCategories.includes(cat.category)) {
            console.log(`⚠️ INVALID CATEGORY FOUND: '${cat.category}'`);
            console.log('Fixing to "other"...');
            await prisma.$executeRaw`
                UPDATE products SET category = 'other' WHERE category = ${cat.category}
            `;
            console.log('✅ Fixed!');
        }
    }

    console.log('Done!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
