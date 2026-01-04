import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyData() {
    try {
        console.log('🔍 Verificando dados carregados...\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Verificar empresas
        const companies = await prisma.company.findMany({
            include: {
                modules: {
                    include: {
                        module: true
                    }
                },
                users: true,
                products: true,
                customers: true,
                sales: true
            }
        });

        console.log(`📊 EMPRESAS ENCONTRADAS: ${companies.length}\n`);

        for (const company of companies) {
            console.log(`\n🏢 ${company.name}`);
            console.log(`   NUIT: ${company.nuit}`);
            console.log(`   Tipo: ${company.businessType}`);
            console.log(`   Status: ${company.status}`);
            console.log(`   Módulos: ${company.modules.map(m => m.module.name).join(', ')}`);
            console.log(`   Utilizadores: ${company.users.length}`);
            console.log(`   Produtos: ${company.products.length}`);
            console.log(`   Clientes: ${company.customers.length}`);
            console.log(`   Vendas: ${company.sales.length}`);

            // Calcular total de vendas
            const totalSales = company.sales.reduce((sum, sale) => {
                return sum + Number(sale.total);
            }, 0);
            console.log(`   Total Vendas: ${totalSales.toFixed(2)} MZN`);
        }

        // Verificar Hotel
        console.log('\n\n🏨 DADOS DO HOTEL\n');
        const hotel = companies.find(c => c.businessType === 'hotel');
        if (hotel) {
            const rooms = await prisma.room.findMany({
                where: { companyId: hotel.id }
            });

            const bookings = await prisma.booking.findMany({
                where: { companyId: hotel.id },
                include: {
                    room: true
                }
            });

            console.log(`   Quartos: ${rooms.length}`);
            console.log(`   Reservas: ${bookings.length}`);

            const activeBookings = bookings.filter(b => b.status === 'checked_in');
            const completedBookings = bookings.filter(b => b.status === 'checked_out');

            console.log(`   Reservas Ativas: ${activeBookings.length}`);
            console.log(`   Reservas Concluídas: ${completedBookings.length}`);

            const totalRevenue = bookings.reduce((sum, booking) => {
                return sum + Number(booking.totalPrice);
            }, 0);
            console.log(`   Receita Total: ${totalRevenue.toFixed(2)} MZN`);
        }

        console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ VERIFICAÇÃO CONCLUÍDA COM SUCESSO!\n');

    } catch (error) {
        console.error('❌ Erro na verificação:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verifyData();
