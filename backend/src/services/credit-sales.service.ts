import { prisma } from '../lib/prisma';
import { PaymentMethod } from '@prisma/client';

export class CreditSalesService {
    /**
     * Get all credit sales (pending and partially paid)
     */
    static async getCreditSales(companyId: string, query: any) {
        const { page = 1, limit = 20, customerId, status } = query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {
            companyId,
            isCredit: true
        };
        if (customerId) where.customerId = customerId;

        // Filter by payment status
        if (status === 'pending') {
            where.paidAmount = { equals: 0 };
        } else if (status === 'partial') {
            // For partial, we get all credit sales and filter in code
            where.paidAmount = { gt: 0 };
        }

        const [sales, total] = await Promise.all([
            prisma.sale.findMany({
                where,
                include: {
                    customer: { select: { id: true, name: true, phone: true } },
                    creditPayments: {
                        orderBy: { paidAt: 'desc' }
                    },
                    items: {
                        include: { product: { select: { name: true } } }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit)
            }),
            prisma.sale.count({ where })
        ]);

        // Calculate remaining balance for each sale
        const salesWithBalance = sales.map(sale => ({
            ...sale,
            remainingBalance: Number(sale.total) - Number(sale.paidAmount),
            isPaid: Number(sale.paidAmount) >= Number(sale.total)
        }));

        return {
            data: salesWithBalance,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        };
    }

    /**
     * Register a payment against a credit sale
     */
    static async registerPayment(companyId: string, receivedBy: string, data: {
        saleId: string;
        amount: number;
        paymentMethod: string;
        reference?: string;
        notes?: string;
    }) {
        const sale = await prisma.sale.findFirst({
            where: { id: data.saleId, companyId, isCredit: true }
        });

        if (!sale) {
            throw new Error('Venda a crédito não encontrada');
        }

        const remaining = Number(sale.total) - Number(sale.paidAmount);
        if (data.amount > remaining) {
            throw new Error(`Valor excede o saldo devedor (${remaining.toFixed(2)} MT)`);
        }

        // Create payment and update sale in transaction
        const [payment] = await prisma.$transaction([
            prisma.creditPayment.create({
                data: {
                    companyId,
                    saleId: data.saleId,
                    customerId: sale.customerId!,
                    amount: data.amount,
                    paymentMethod: (data.paymentMethod as PaymentMethod) || 'cash',
                    reference: data.reference,
                    notes: data.notes,
                    receivedBy
                }
            }),
            prisma.sale.update({
                where: { id: data.saleId },
                data: {
                    paidAmount: { increment: data.amount }
                }
            })
        ]);

        return payment;
    }

    /**
     * Get payment history for a sale
     */
    static async getPaymentHistory(companyId: string, saleId: string) {
        const sale = await prisma.sale.findFirst({
            where: { id: saleId, companyId },
            include: {
                customer: { select: { name: true, phone: true } },
                creditPayments: { orderBy: { paidAt: 'desc' } },
                items: { include: { product: { select: { name: true } } } }
            }
        });

        if (!sale) {
            throw new Error('Venda não encontrada');
        }

        return {
            sale,
            payments: sale.creditPayments,
            totalPaid: Number(sale.paidAmount),
            remaining: Number(sale.total) - Number(sale.paidAmount),
            isPaid: Number(sale.paidAmount) >= Number(sale.total)
        };
    }

    /**
     * Get customer credit summary
     */
    static async getCustomerSummary(companyId: string, customerId: string) {
        const customer = await prisma.customer.findFirst({
            where: { id: customerId, companyId },
            include: {
                sales: {
                    where: { isCredit: true },
                    select: { total: true, paidAmount: true }
                }
            }
        });

        if (!customer) {
            throw new Error('Cliente não encontrado');
        }

        const totalCredit = customer.sales.reduce((sum, s) => sum + Number(s.total), 0);
        const totalPaid = customer.sales.reduce((sum, s) => sum + Number(s.paidAmount), 0);
        const outstanding = totalCredit - totalPaid;

        return {
            customer: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                creditLimit: customer.creditLimit
            },
            totalCredit,
            totalPaid,
            outstanding,
            salesCount: customer.sales.length,
            availableCredit: customer.creditLimit
                ? Number(customer.creditLimit) - outstanding
                : null
        };
    }

    /**
     * Get debtors report
     */
    static async getDebtorsReport(companyId: string) {
        const customers = await prisma.customer.findMany({
            where: {
                companyId,
                sales: {
                    some: { isCredit: true }
                }
            },
            include: {
                sales: {
                    where: { isCredit: true },
                    select: { total: true, paidAmount: true, createdAt: true }
                }
            }
        });

        const debtors = customers
            .map(customer => {
                const totalCredit = customer.sales.reduce((sum, s) => sum + Number(s.total), 0);
                const totalPaid = customer.sales.reduce((sum, s) => sum + Number(s.paidAmount), 0);
                const outstanding = totalCredit - totalPaid;
                const oldest = customer.sales.length > 0
                    ? customer.sales.reduce((min, s) =>
                        s.createdAt < min ? s.createdAt : min, customer.sales[0].createdAt)
                    : null;

                return {
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                    totalCredit,
                    totalPaid,
                    outstanding,
                    salesCount: customer.sales.length,
                    oldestDebt: oldest
                };
            })
            .filter(d => d.outstanding > 0)
            .sort((a, b) => b.outstanding - a.outstanding);

        const totalOutstanding = debtors.reduce((sum, d) => sum + d.outstanding, 0);

        return {
            debtors,
            totalDebtors: debtors.length,
            totalOutstanding
        };
    }
}
