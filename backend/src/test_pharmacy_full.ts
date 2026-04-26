import { prisma } from './lib/prisma';
import { pharmacyService } from './services/pharmacyService';
import { pharmacyFinanceService } from './services/pharmacyFinanceService';

async function runFullPharmacyTest() {
    console.log('💊 Iniciando Teste Completo do Módulo de Farmácia...\n');

    try {
        // 1. Setup - Pegar empresa e usuário
        const company = await prisma.company.findFirst();
        const user = await prisma.user.findFirst({ where: { companyId: company?.id } });

        if (!company || !user) {
            console.error('❌ Falha no Setup: Certifique-se de que existem Empresa e Usuário cadastrados.');
            return;
        }

        console.log(`📍 Contexto: Empresa [${company.name}], Usuário [${user.name}]`);

        // 2. Preparar Medicamento
        console.log('\n--- [1/4] Preparando Catálogo de Medicamentos ---');
        
        // Procurar ou criar um produto base
        let product = await prisma.product.findFirst({ 
            where: { companyId: company.id, name: 'Paracetamol Teste' } 
        });

        if (!product) {
            product = await prisma.product.create({
                data: {
                    name: 'Paracetamol Teste',
                    code: 'MED-' + Math.floor(Math.random() * 1000),
                    price: 150.00,
                    currentStock: 0,
                    originModule: 'pharmacy',
                    companyId: company.id
                }
            });
        }

        // Vincular como medicamento
        let medication = await prisma.medication.findUnique({ where: { productId: product.id } });
        if (!medication) {
            const medResult = await pharmacyService.createMedication(company.id, {
                productId: product.id,
                dosage: '500mg',
                pharmaceuticalForm: 'comprimido',
                requiresPrescription: false
            });
            medication = medResult.data;
            console.log(`✅ Medicamento vinculado: ${product.name}`);
        } else {
            console.log(`✅ Medicamento já existente: ${product.name}`);
        }

        // 3. Adicionar Lote (Stock)
        console.log('\n--- [2/4] Adicionando Lote e Stock ---');
        const batchData = {
            medicationId: medication!.id,
            batchNumber: 'LOT-' + Date.now().toString().slice(-4),
            quantity: 50,
            expiryDate: new Date(Date.now() + 86400000 * 365).toISOString(), // 1 ano
            costPrice: 50,
            sellingPrice: 150,
            supplier: 'Distribuidora Teste'
        };
        const batchResult = await pharmacyService.createBatch(company.id, batchData, user.name);
        const batch = batchResult.data!;
        console.log(`✅ Lote Criado: ${batch.batchNumber} (Qtd: ${batch.quantity})`);

        // 4. Realizar Venda Farmacêutica
        console.log('\n--- [3/4] Testando Venda de Farmácia ---');
        const saleData = {
            items: [{
                batchId: batch.id,
                quantity: 2,
                discount: 0
            }],
            customerName: 'Paciente Teste',
            paymentMethod: 'cash',
            notes: 'Teste de venda farmacêutica automatizado'
        };

        const saleResult = await pharmacyService.createSale(company.id, saleData, user.name);
        if (saleResult.success) {
            const sale = saleResult.data!;
            console.log(`✅ Venda Concluída: ${sale.saleNumber} (Total: ${sale.total} MT)`);
        } else {
            console.error('❌ Erro na venda:', saleResult.message);
        }

        // 5. Verificar Dashboard Financeiro
        console.log('\n--- [4/4] Verificando Finanças da Farmácia ---');
        const financeData = await pharmacyFinanceService.getDashboard(company.id, '1m');
        console.log(`✅ Dashboard Financeiro OK (Transações: ${financeData.summary.transactionCount})`);

        console.log('\n✨ TESTE DE FARMÁCIA FINALIZADO COM SUCESSO! ✨');

    } catch (error: any) {
        console.error('\n💥 ERRO CRÍTICO NO TESTE DE FARMÁCIA:');
        console.error(error.message || error);
        if (error.stack) console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

runFullPharmacyTest();
