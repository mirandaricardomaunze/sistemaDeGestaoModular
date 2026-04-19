const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const companyId = 'YOUR_COMPANY_ID'; // Need a valid ID or just test the syntax
        console.log('Testing Inventory Query...');
        
        // Let's test just a simple count first
        const totalProducts = await prisma.product.count();
        console.log('Total Products in DB:', totalProducts);
        
        if (totalProducts > 0) {
            const firstProduct = await prisma.product.findFirst();
            console.log('First Product:', firstProduct);
            
            // Test the field comparison
            try {
                const lowStockCount = await prisma.product.count({
                    where: {
                        currentStock: { lte: prisma.product.fields.minStock }
                    }
                });
                console.log('Low Stock Count (Field Ref):', lowStockCount);
            } catch (e) {
                console.error('Field Reference Comparison FAILED:', e.message);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
