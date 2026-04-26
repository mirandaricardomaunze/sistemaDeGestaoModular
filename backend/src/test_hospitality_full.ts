import { prisma } from './lib/prisma';
import { hospitalityService } from './services/hospitalityService';

async function testHospitality() {
    console.log('🏨 Iniciando Teste do Módulo de Hospitalidade (Hotel)...\n');

    try {
        const company = await prisma.company.findFirst();
        if (!company) return;

        // 1. Quarto
        console.log('--- [1/3] Gestão de Quartos ---');
        const roomData = {
            number: 'Q-' + Math.floor(Math.random() * 500),
            type: 'deluxe' as any,
            price: 5000
        };
        const roomResult = await hospitalityService.createRoom(company.id, roomData);
        const room = roomResult.data!;
        console.log(`✅ Quarto Criado: ${room.number} (Preço: ${room.price} MT)`);

        // 2. Check-in
        console.log('\n--- [2/3] Check-in ---');
        const checkInData = {
            roomId: room.id,
            customerName: 'Hóspede Teste',
            guestDocumentNumber: 'BI1234567',
            checkIn: new Date().toISOString(),
            checkOut: new Date(Date.now() + 86400000).toISOString(), // Amanhã
            guestCount: 2,
            mealPlan: 'breakfast'
        };
        const bookingResult = await hospitalityService.checkIn(company.id, checkInData);
        const booking = bookingResult.data!;
        console.log(`✅ Check-in Realizado: Reserva ID ${booking.id}`);

        // 3. Check-out
        console.log('\n--- [3/3] Check-out e Faturação ---');
        const checkoutResult = await hospitalityService.checkout(company.id, booking.id, 'test-user-id');
        console.log(`✅ Check-out Concluído. Total Pago: ${checkoutResult.data!.totalBill} MT`);

        console.log('\n✨ TESTE DE HOSPITALIDADE CONCLUÍDO! ✨');
    } catch (error: any) {
        console.error('❌ ERRO NO TESTE DE HOSPITALIDADE:', error.message || error);
    }
}

testHospitality();
