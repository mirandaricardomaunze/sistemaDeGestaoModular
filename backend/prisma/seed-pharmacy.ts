import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPharmacy() {
    console.log('💊 Starting pharmacy seed...');

    // Get existing company (or create one)
    let company = await prisma.company.findFirst();
    if (!company) {
        company = await prisma.company.create({
            data: {
                name: 'Farmácia Demo',
                tradeName: 'Farmácia Demo Lda',
                nuit: '000000001',
                phone: '+258 84 100 0001',
                email: 'farmacia@demo.co.mz',
                address: 'Av. Farmácia, 100, Maputo',
                status: 'active'
            }
        });
        console.log('✅ Company created:', company.name);
    }

    // Get existing supplier or create one
    let supplier = await prisma.supplier.findFirst({ where: { code: 'FARM-SUP-001' } });
    if (!supplier) {
        supplier = await prisma.supplier.create({
            data: {
                code: 'FARM-SUP-001',
                name: 'Distribuidora Farmacêutica',
                nuit: '111222333',
                phone: '+258 84 555 5555',
                email: 'vendas@distrifarm.co.mz',
                companyId: company.id
            }
        });
        console.log('✅ Pharmacy supplier created:', supplier.name);
    }

    // Create pharmacy products
    const pharmacyProducts = [
        { code: 'MED-001', name: 'Paracetamol 500mg', category: 'medicine', price: 150, costPrice: 80, minStock: 50 },
        { code: 'MED-002', name: 'Ibuprofeno 400mg', category: 'medicine', price: 180, costPrice: 100, minStock: 40 },
        { code: 'MED-003', name: 'Amoxicilina 500mg', category: 'medicine', price: 350, costPrice: 200, minStock: 30 },
        { code: 'MED-004', name: 'Omeprazol 20mg', category: 'medicine', price: 280, costPrice: 150, minStock: 25 },
        { code: 'MED-005', name: 'Diazepam 5mg', category: 'medicine', price: 420, costPrice: 280, minStock: 10 },
        { code: 'MED-006', name: 'Metformina 500mg', category: 'medicine', price: 250, costPrice: 140, minStock: 35 },
        { code: 'MED-007', name: 'Losartan 50mg', category: 'medicine', price: 320, costPrice: 180, minStock: 30 },
        { code: 'MED-008', name: 'Vitamina C 1000mg', category: 'medicine', price: 200, costPrice: 100, minStock: 60 },
    ];

    const createdProducts: any[] = [];
    for (const prod of pharmacyProducts) {
        let product = await prisma.product.findFirst({ where: { code: prod.code, companyId: company.id } });
        if (!product) {
            product = await prisma.product.create({
                data: {
                    code: prod.code,
                    name: prod.name,
                    category: prod.category as any,
                    price: prod.price,
                    costPrice: prod.costPrice,
                    minStock: prod.minStock,
                    currentStock: 0,
                    unit: 'un',
                    origin_module: 'pharmacy',
                    companyId: company.id,
                    supplierId: supplier.id
                }
            });
        }
        createdProducts.push(product);
    }
    console.log('✅ Pharmacy products created:', createdProducts.length);

    // Create medications from products
    const medicationData = [
        { productIndex: 0, dci: 'Paracetamol', dosage: '500mg', pharmaceuticalForm: 'Comprimido', requiresPrescription: false, isControlled: false },
        { productIndex: 1, dci: 'Ibuprofeno', dosage: '400mg', pharmaceuticalForm: 'Comprimido', requiresPrescription: false, isControlled: false },
        { productIndex: 2, dci: 'Amoxicilina', dosage: '500mg', pharmaceuticalForm: 'Cápsula', requiresPrescription: true, isControlled: false },
        { productIndex: 3, dci: 'Omeprazol', dosage: '20mg', pharmaceuticalForm: 'Cápsula', requiresPrescription: false, isControlled: false },
        { productIndex: 4, dci: 'Diazepam', dosage: '5mg', pharmaceuticalForm: 'Comprimido', requiresPrescription: true, isControlled: true },
        { productIndex: 5, dci: 'Metformina', dosage: '500mg', pharmaceuticalForm: 'Comprimido', requiresPrescription: true, isControlled: false },
        { productIndex: 6, dci: 'Losartan', dosage: '50mg', pharmaceuticalForm: 'Comprimido', requiresPrescription: true, isControlled: false },
        { productIndex: 7, dci: 'Ácido Ascórbico', dosage: '1000mg', pharmaceuticalForm: 'Comprimido Efervescente', requiresPrescription: false, isControlled: false },
    ];

    const createdMedications: any[] = [];
    for (const med of medicationData) {
        const product = createdProducts[med.productIndex];
        let medication = await prisma.medication.findUnique({ where: { productId: product.id } });
        if (!medication) {
            medication = await prisma.medication.create({
                data: {
                    productId: product.id,
                    dci: med.dci,
                    dosage: med.dosage,
                    pharmaceuticalForm: med.pharmaceuticalForm,
                    requiresPrescription: med.requiresPrescription,
                    isControlled: med.isControlled,
                    storageTemp: 'ambiente',
                    companyId: company.id
                }
            });
        }
        createdMedications.push(medication);
    }
    console.log('✅ Medications created:', createdMedications.length);

    // Create batches for each medication
    const now = new Date();
    const batches: any[] = [];
    for (let i = 0; i < createdMedications.length; i++) {
        const med = createdMedications[i];
        const prod = createdProducts[i];

        // Create 2 batches per medication
        for (let j = 1; j <= 2; j++) {
            const expiryDate = new Date(now);
            expiryDate.setMonth(expiryDate.getMonth() + (j === 1 ? 6 : 18)); // 6 months or 18 months

            const quantity = Math.floor(Math.random() * 100) + 20;

            let batch = await prisma.medicationBatch.findFirst({
                where: { medicationId: med.id, batchNumber: `LOT-${prod.code}-${j}` }
            });

            if (!batch) {
                batch = await prisma.medicationBatch.create({
                    data: {
                        medicationId: med.id,
                        batchNumber: `LOT-${prod.code}-${j}`,
                        quantity: quantity,
                        quantityAvailable: quantity,
                        expiryDate: expiryDate,
                        costPrice: prod.costPrice,
                        sellingPrice: prod.price,
                        invoiceNumber: `FT-SUP-2024/${(i + 1) * 10 + j}`,
                        status: 'active',
                        companyId: company.id
                    }
                });

                // Update product stock
                await prisma.product.update({
                    where: { id: prod.id },
                    data: { currentStock: { increment: quantity } }
                });
            }
            batches.push(batch);
        }
    }
    console.log('✅ Medication batches created:', batches.length);

    // Create sample customer
    let customer = await prisma.customer.findFirst({ where: { code: 'CLI-FARM-001', companyId: company.id } });
    if (!customer) {
        customer = await prisma.customer.create({
            data: {
                code: 'CLI-FARM-001',
                name: 'João Paciente',
                type: 'individual',
                phone: '+258 84 777 7777',
                email: 'joao@email.co.mz',
                companyId: company.id
            }
        });
        console.log('✅ Customer created:', customer.name);
    }

    // Create sample sales
    const salesData = [
        { items: [{ batchIndex: 0, quantity: 2 }, { batchIndex: 2, quantity: 1 }], paymentMethod: 'cash' },
        { items: [{ batchIndex: 4, quantity: 3 }], paymentMethod: 'mpesa' },
        { items: [{ batchIndex: 6, quantity: 1 }, { batchIndex: 8, quantity: 2 }], paymentMethod: 'card' },
        { items: [{ batchIndex: 10, quantity: 5 }], paymentMethod: 'cash' },
        { items: [{ batchIndex: 12, quantity: 2 }, { batchIndex: 14, quantity: 1 }], paymentMethod: 'emola' },
    ];

    for (let s = 0; s < salesData.length; s++) {
        const saleData = salesData[s];
        const saleNumber = `PH-${String(s + 1).padStart(6, '0')}`;

        let sale = await prisma.pharmacySale.findFirst({ where: { saleNumber, companyId: company.id } });
        if (!sale) {
            let subtotal = 0;
            const saleItems: any[] = [];

            for (const item of saleData.items) {
                const batch = batches[item.batchIndex % batches.length];
                const itemTotal = Number(batch.sellingPrice) * item.quantity;
                subtotal += itemTotal;
                saleItems.push({
                    batchId: batch.id,
                    productName: `Medicamento ${item.batchIndex + 1}`,
                    quantity: item.quantity,
                    unitPrice: batch.sellingPrice,
                    discount: 0,
                    total: itemTotal
                });
            }

            sale = await prisma.pharmacySale.create({
                data: {
                    saleNumber,
                    companyId: company.id,
                    customerId: s % 2 === 0 ? customer.id : null,
                    customerName: s % 2 === 0 ? customer.name : 'Cliente Balcão',
                    subtotal,
                    discount: 0,
                    total: subtotal,
                    paymentMethod: saleData.paymentMethod,
                    soldBy: 'Sistema',
                    status: 'completed',
                    items: { create: saleItems }
                }
            });
        }
    }
    console.log('✅ Pharmacy sales created:', salesData.length);

    console.log('\n✅ Pharmacy seed completed!');
    console.log(`📊 Created: ${createdProducts.length} products, ${createdMedications.length} medications, ${batches.length} batches, ${salesData.length} sales`);
}

seedPharmacy()
    .catch((e) => {
        console.error('❌ Pharmacy seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
