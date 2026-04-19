import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStock() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        stocks: {
          include: {
            product: true
          }
        }
      }
    });

    console.log('--- WAREHOUSES AND STOCK ---');
    warehouses.forEach(w => {
      console.log(`Warehouse: ${w.name} (${w.code}) - ID: ${w.id}`);
      if (w.stocks.length === 0) {
        console.log('  (No stock)');
      } else {
        w.stocks.forEach(s => {
          console.log(`  - Product: ${s.product.name} | Qty: ${s.quantity}`);
        });
      }
    });

    const transfers = await prisma.stockTransfer.findMany();
    console.log('\n--- RECENT TRANSFERS ---');
    console.log(`Total transfers: ${transfers.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStock();
