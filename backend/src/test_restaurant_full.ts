import { prisma } from './lib/prisma';
import { restaurantService } from './services/restaurantService';

async function testRestaurant() {
    console.log('🍽️ Iniciando Teste do Módulo de Restaurante...\n');

    try {
        const company = await prisma.company.findFirst();
        if (!company) return;

        // 1. Mesa
        console.log('--- [1/3] Mesas ---');
        const tableData = {
            number: Math.floor(Math.random() * 100),
            capacity: 4,
            section: 'Terraço'
        };
        const table = await restaurantService.createTable(tableData, company.id);
        console.log(`✅ Mesa Criada: Nº ${table.number}`);

        // 2. Pedido
        console.log('\n--- [2/3] Pedidos e Consumo ---');
        // Procurar um item de menu
        let menuItem = await prisma.restaurantMenuItem.findFirst({ where: { companyId: company.id } });
        if (!menuItem) {
             menuItem = await restaurantService.createMenuItem(company.id, {
                 name: 'Prato do Dia Teste',
                 category: 'Pratos Principais',
                 price: 450,
                 description: 'Teste automatizado'
             });
        }

        const orderData = {
            tableId: table.id,
            items: [
                { 
                    menuItemId: menuItem!.id, 
                    name: menuItem!.name,
                    quantity: 2, 
                    unitPrice: Number(menuItem!.price), 
                    notes: 'Sem sal' 
                }
            ],
            customerName: 'Cliente Restaurante Teste'
        };
        const order = await restaurantService.createOrder(company.id, orderData);
        console.log(`✅ Pedido Aberto: Nº ${order.orderNumber} (Item: ${menuItem!.name})`);

        // 3. Fechar Pedido (Simular fim de consumo)
        console.log('\n--- [3/3] Fecho de Mesa ---');
        const closedOrder = await restaurantService.updateOrderStatus(order.id, company.id, 'served');
        console.log(`✅ Pedido Servido e Mesa Livre. Total: ${closedOrder.totalAmount} MT`);

        console.log('\n✨ TESTE DE RESTAURANTE CONCLUÍDO! ✨');
    } catch (error: any) {
        console.error('❌ ERRO NO TESTE DE RESTAURANTE:', error.message || error);
        if (error.stack) console.error(error.stack);
    }
}

testRestaurant();
