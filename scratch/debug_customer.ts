import { prisma } from '../backend/src/lib/prisma';

async function main() {
    try {
        const company = await prisma.company.findFirst();
        if (!company) {
            console.error('No company found');
            return;
        }

        console.log('Testing customer creation for company:', company.id);

        const customer = await prisma.customer.create({
            data: {
                name: 'Test Customer',
                code: 'TEST-' + Date.now(),
                phone: '123456789',
                type: 'individual',
                company: { connect: { id: company.id } }
            }
        });

        console.log('Customer created successfully:', customer);
    } catch (err) {
        console.error('Error creating customer:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
