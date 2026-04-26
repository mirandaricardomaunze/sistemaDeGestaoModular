import { prisma } from './lib/prisma';
import { customersService } from './services/customersService';
import { salesService } from './services/salesService';
import { invoicesService } from './services/invoicesService';
import { commercialFinanceService } from './services/commercialFinanceService';
import { stockService } from './services/stockService';

async function runFullCommercialTest() {
    console.log('🚀 Iniciando Teste Completo do Módulo Comercial...\n');

    try {
        // 1. Setup - Pegar empresa, usuário e produto existente
        const company = await prisma.company.findFirst();
        const user = await prisma.user.findFirst({ where: { companyId: company?.id } });
        const product = await prisma.product.findFirst({ where: { companyId: company?.id, isActive: true } });
        const warehouse = await prisma.warehouse.findFirst({ where: { companyId: company?.id, isActive: true } });

        if (!company || !user || !product || !warehouse) {
            console.error('❌ Falha no Setup: Certifique-se de que existem Empresa, Usuário, Produto e Armazém cadastrados.');
            return;
        }

        // Garantir stock para o teste via serviço oficial para manter consistência global
        await stockService.recordMovement({
            productId: product.id,
            warehouseId: warehouse.id,
            quantity: 100, // Adicionar bastante stock
            movementType: 'purchase',
            originModule: 'COMMERCIAL',
            performedBy: 'Sistema de Teste',
            companyId: company.id
        });

        console.log(`📍 Contexto: Empresa [${company.name}], Usuário [${user.name}], Produto [${product.name}]`);

        // 2. Teste de Clientes
        console.log('\n--- [1/4] Testando Clientes ---');
        const customerData = {
            name: "Empresa de Teste Full " + Date.now(),
            type: 'company',
            phone: "841234567",
            email: "teste@multicore.com",
            address: "Rua do Teste, 123"
        };
        const newCustomer = await customersService.create(customerData, company.id);
        console.log(`✅ Cliente Criado: ${newCustomer.name} (ID: ${newCustomer.id})`);

        const customerList = await customersService.list({ limit: 5 }, company.id);
        console.log(`✅ Listagem de Clientes OK (Total: ${customerList.pagination.total})`);

        // 3. Teste de Vendas (POS)
        console.log('\n--- [2/4] Testando Vendas (POS) ---');
        const saleData = {
            customerId: newCustomer.id,
            items: [{
                productId: product.id,
                quantity: 1,
                unitPrice: Number(product.price),
                total: Number(product.price)
            }],
            subtotal: Number(product.price),
            total: Number(product.price),
            amountPaid: Number(product.price),
            paymentMethod: 'cash' as any,
            originModule: 'commercial' as any,
            warehouseId: warehouse.id
        };

        // Note: salesService.create retorna ResultHandler.success(createdSale)
        const saleResult = await salesService.create(saleData, company.id, user.id, user.name, '127.0.0.1') as any;
        if (saleResult.success) {
            const sale = saleResult.data;
            console.log(`✅ Venda Realizada: ${sale.receiptNumber} (Total: ${sale.total} MT)`);
        } else {
            console.error('❌ Erro ao realizar venda:', saleResult.message);
        }

        // 4. Teste de Faturação
        console.log('\n--- [3/4] Testando Faturação ---');
        const invoiceData = {
            customerId: newCustomer.id,
            customerName: newCustomer.name,
            items: [{
                productId: product.id,
                description: product.name,
                quantity: 2,
                unitPrice: Number(product.price),
                total: Number(product.price) * 2
            }],
            subtotal: Number(product.price) * 2,
            total: Number(product.price) * 2,
            taxAmount: (Number(product.price) * 2) * 0.16, // 16% IVA
            dueDate: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 dias
        };

        const invoiceResult = await invoicesService.create(invoiceData, company.id, user.name) as any;
        if (invoiceResult.success) {
            const invoice = invoiceResult.data;
            console.log(`✅ Fatura Criada: ${invoice.invoiceNumber} (Total: ${invoice.total} MT)`);
        } else {
            console.error('❌ Erro ao criar fatura:', invoiceResult.message);
        }

        // 5. Teste de Dashboards e Finanças
        console.log('\n--- [4/4] Testando Finanças Comerciais ---');
        const financeData = await commercialFinanceService.getDashboard(company.id, '1m');
        console.log(`✅ Dashboard Financeiro OK (Receita Total: ${financeData.summary.totalRevenue} MT)`);

        console.log('\n✨ TESTE COMPLETO FINALIZADO COM SUCESSO! ✨');

    } catch (error: any) {
        console.error('\n💥 CRITICAL ERROR DURANTE O TESTE:');
        console.error(error.message || error);
        if (error.stack) console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

runFullCommercialTest();
