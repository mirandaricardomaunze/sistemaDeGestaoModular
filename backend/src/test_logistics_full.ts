import { prisma } from './lib/prisma';
import { logisticsService } from './services/logisticsService';

async function testLogistics() {
    console.log('🚚 Iniciando Teste do Módulo de Logística...\n');

    try {
        const company = await prisma.company.findFirst();
        if (!company) return;

        // 1. Veículo
        console.log('--- [1/3] Veículos ---');
        const vehicleData = {
            plate: 'TST-' + Math.floor(Math.random() * 10000),
            brand: 'Toyota',
            model: 'Hilux',
            year: 2022,
            type: 'truck'
        };
        const vehicleResult = await logisticsService.createVehicle(company.id, vehicleData);
        const vehicle = vehicleResult.data!;
        console.log(`✅ Veículo Criado: ${vehicle.plate}`);

        // 2. Motorista
        console.log('\n--- [2/3] Motoristas ---');
        const driverData = {
            name: 'Motorista de Teste',
            licenseNumber: 'LIC-' + Date.now(),
            phone: '820000000'
        };
        const driverResult = await logisticsService.createDriver(company.id, driverData);
        const driver = driverResult.data!;
        console.log(`✅ Motorista Criado: ${driver.name} (Código: ${driver.code})`);

        // 3. Entrega
        console.log('\n--- [3/3] Entregas ---');
        const deliveryData = {
            vehicleId: vehicle.id,
            driverId: driver.id,
            recipientName: 'Cliente Logística Teste',
            recipientPhone: '840000000',
            deliveryAddress: 'Av. do Trabalho, 456',
            province: 'Maputo',
            shippingCost: 500,
            status: 'pending',
            priority: 'high',
            items: [
                { description: 'Pacote A', quantity: 2, weight: 10 },
                { description: 'Pacote B', quantity: 1, weight: 5 }
            ]
        };
        const delivery = await logisticsService.createDelivery(company.id, deliveryData);
        console.log(`✅ Entrega Registada: ${delivery.number} (Custo: ${delivery.shippingCost} MT)`);

        console.log('\n✨ TESTE DE LOGÍSTICA CONCLUÍDO! ✨');
    } catch (error: any) {
        console.error('❌ ERRO NO TESTE DE LOGÍSTICA:', error.message || error);
    }
}

testLogistics();
