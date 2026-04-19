import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOrphanStock() {
  const targetWarehouseId = 'e7227f02-ae56-4b3b-8a96-114877ed11f1'; // Armazém 19
  
  try {
    console.log('--- STARTING ORPHAN STOCK FIX ---');
    
    // Find products that have stock but no warehouse stock entries
    const products = await prisma.product.findMany({
      where: {
        currentStock: { gt: 0 }
      },
      include: {
        warehouseStocks: true
      }
    });

    for (const p of products) {
      const totalWarehouseStock = p.warehouseStocks.reduce((sum, ws) => sum + ws.quantity, 0);
      
      if (totalWarehouseStock < p.currentStock) {
        const orphanQty = p.currentStock - totalWarehouseStock;
        console.log(`Product "${p.name}" (${p.code}) has ${orphanQty} units unassigned. Fixing...`);
        
        await prisma.warehouseStock.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: targetWarehouseId,
              productId: p.id
            }
          },
          update: {
            quantity: { increment: orphanQty }
          },
          create: {
            warehouseId: targetWarehouseId,
            productId: p.id,
            quantity: orphanQty
          }
        });
        
        console.log(`  Successfully moved ${orphanQty} units to warehouse ${targetWarehouseId}`);
      }
    }

    console.log('--- FIX COMPLETED ---');

  } catch (error) {
    console.error('Error during fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrphanStock();
