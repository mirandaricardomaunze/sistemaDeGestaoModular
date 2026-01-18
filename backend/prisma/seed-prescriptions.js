const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const company = await prisma.company.findFirst();
    if (!company) {
        console.error('Nenhuma empresa encontrada para o seed.');
        return;
    }

    const prescriptions = [
        {
            prescriptionNo: 'PRE-000001',
            patientName: 'João Silva',
            patientPhone: '841234567',
            prescriberName: 'Dr. Ricardo Miranda',
            prescriberCRM: 'CRM-MZ-1234',
            facility: 'Hospital Central',
            prescriptionDate: new Date(),
            status: 'pending',
            isControlled: true,
            notes: 'Receita de teste para medicamentos controlados.',
            companyId: company.id,
            items: {
                create: [
                    {
                        medicationName: 'Amoxicilina 500mg',
                        quantity: 2,
                        dosage: '1 comprimido a cada 8h',
                        posology: 'Via oral',
                        duration: '7 dias'
                    }
                ]
            }
        },
        {
            prescriptionNo: 'PRE-000002',
            patientName: 'Maria Santos',
            patientPhone: '829876543',
            prescriberName: 'Dra. Ana Paula',
            prescriberCRM: 'CRM-MZ-5678',
            facility: 'Clínica Vida',
            prescriptionDate: new Date(),
            status: 'completed',
            isControlled: false,
            notes: 'Receita concluída para teste.',
            companyId: company.id,
            items: {
                create: [
                    {
                        medicationName: 'Paracetamol 500mg',
                        quantity: 1,
                        dosage: '1 comprimido se dor ou febre',
                        posology: 'Via oral',
                        duration: '3 dias'
                    }
                ]
            }
        }
    ];

    console.log('Semeando receitas...');
    for (const p of prescriptions) {
        await prisma.prescription.create({ data: p });
    }
    console.log('✅ Receitas semeadas com sucesso!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
