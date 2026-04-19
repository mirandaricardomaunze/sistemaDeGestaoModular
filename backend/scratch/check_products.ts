import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProducts() {
  try {
    const products = await prisma.product.findMany({
      include: {
        warehouseStocks: true
      }
    });

    console.log('--- PRODUCTS LIST ---');
    products.forEach(p => {
      console.log(`Product: ${p.name} (${p.code}) - Total Stock: ${p.currentStock}`);
      p.warehouseStocks.forEach(ws => {
        console.log(`  - Warehouse ID: ${ws.warehouseId} | Qty: ${ws.quantity}`);
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProducts();
