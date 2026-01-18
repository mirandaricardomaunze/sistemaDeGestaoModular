import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugInvoices() {
    try {
        console.log('Fetching a company...');
        const company = await prisma.company.findFirst();
        if (!company) {
            console.log('No company found.');
            return;
        }
        const companyId = company.id;
        console.log('Using companyId:', companyId);

        // Get invoiced order IDs to exclude them
        const invoicedInvoices = await prisma.invoice.findMany({
            where: { companyId },
            select: { orderId: true }
        });

        const invoicedOrderIds = invoicedInvoices
            .map(i => i.orderId)
            .filter((id): id is string => !!id);

        console.log('Invoiced order IDs:', invoicedOrderIds.length);

        // Fetch un-invoiced PharmacySales
        console.log('Fetching pharmacy sales...');
        const availableSales = await prisma.pharmacySale.findMany({
            where: {
                companyId,
                status: 'completed',
                id: { notIn: invoicedOrderIds }
            },
            include: {
                customer: true,
                items: {
                    include: {
                        batch: {
                            include: {
                                medication: {
                                    include: { product: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        console.log('Found available sales:', availableSales.length);

        // Fetch un-invoiced CustomerOrders
        console.log('Fetching customer orders...');
        const availableOrders = await prisma.customerOrder.findMany({
            where: {
                companyId,
                status: 'delivered',
                id: { notIn: invoicedOrderIds }
            },
            include: {
                items: true
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        console.log('Found available orders:', availableOrders.length);

        // Format and merge
        console.log('Formatting sources...');
        const sources = [
            ...availableSales.map(s => {
                console.log('Sale:', s.saleNumber);
                return {
                    id: s.id,
                    number: s.saleNumber,
                    type: 'pharmacy',
                    customerId: s.customerId,
                    customerName: s.customerName || s.customer?.name || 'Cliente Balcão',
                    items: s.items.map(i => {
                        console.log('  Item:', i.productName);
                        // Potential crash point if relation is missing
                        return {
                            productId: i.batch?.medication?.productId,
                            description: i.productName,
                            quantity: i.quantity,
                            unitPrice: Number(i.unitPrice),
                            total: Number(i.total)
                        };
                    }),
                    total: Number(s.total)
                };
            }),
            ...availableOrders.map(o => {
                console.log('Order:', o.orderNumber);
                return {
                    id: o.id,
                    number: o.orderNumber,
                    type: 'commercial',
                    items: o.items.map(i => ({
                        productId: i.productId,
                        description: i.productName,
                        quantity: i.quantity,
                        unitPrice: Number(i.price),
                        total: Number(i.total)
                    })),
                    total: Number(o.total)
                };
            })
        ];

        console.log('Successfully formatted sources:', sources.length);
    } catch (error) {
        console.error('CRASH DETECTED:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugInvoices();
