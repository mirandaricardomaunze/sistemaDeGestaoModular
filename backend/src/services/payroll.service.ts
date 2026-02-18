import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';

export class PayrollService {
    async list(params: any, companyId: string) {
        const { year, month, page = '1', limit = '20' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            year: parseInt(year),
            month: parseInt(month),
            employee: { companyId }
        };

        const [total, records] = await Promise.all([
            prisma.payrollRecord.count({ where }),
            prisma.payrollRecord.findMany({
                where,
                include: {
                    employee: { select: { id: true, name: true, code: true, department: true } }
                },
                skip,
                take: limitNum
            })
        ]);

        const allRecords = await prisma.payrollRecord.findMany({ where });
        const totals = allRecords.reduce((acc, r) => ({
            totalEarnings: acc.totalEarnings + Number(r.totalEarnings),
            totalDeductions: acc.totalDeductions + Number(r.totalDeductions),
            totalNetSalary: acc.totalNetSalary + Number(r.netSalary)
        }), { totalEarnings: 0, totalDeductions: 0, totalNetSalary: 0 });

        return {
            data: records,
            totals,
            pagination: buildPaginationMeta(pageNum, limitNum, total)
        };
    }

    async upsert(employeeId: string, data: any, companyId: string) {
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, companyId }
        });

        if (!employee) throw ApiError.notFound('Funcionário não encontrado');

        const { month, year, otHours, bonus, advances, notes } = data;
        const baseSalary = Number(employee.baseSalary);
        const allowances = Number(employee.subsidyTransport || 0) + Number(employee.subsidyFood || 0);
        const otAmount = (baseSalary / 176) * 1.5 * (otHours || 0);
        const totalEarnings = baseSalary + allowances + otAmount + (bonus || 0);

        const inssDeduction = baseSalary * 0.03;
        const irtDeduction = this.calculateIRT(totalEarnings);
        const totalDeductions = inssDeduction + irtDeduction + (advances || 0);
        const netSalary = totalEarnings - totalDeductions;

        return prisma.payrollRecord.upsert({
            where: {
                employeeId_month_year: { employeeId, month, year }
            },
            update: {
                baseSalary, otHours: otHours || 0, otAmount, bonus: bonus || 0,
                allowances, inssDeduction, irtDeduction, advances: advances || 0,
                totalEarnings, totalDeductions, netSalary, notes
            },
            create: {
                employeeId, month, year, baseSalary, otHours: otHours || 0,
                otAmount, bonus: bonus || 0, allowances, inssDeduction,
                irtDeduction, advances: advances || 0, totalEarnings,
                totalDeductions, netSalary, notes
            }
        });
    }

    async process(payrollId: string, companyId: string) {
        const payroll = await prisma.payrollRecord.findFirst({
            where: { id: payrollId, employee: { companyId } },
            include: { employee: true }
        });

        if (!payroll) throw ApiError.notFound('Folha de pagamento não encontrada');

        await prisma.payrollRecord.update({
            where: { id: payrollId },
            data: { status: 'processed', processedAt: new Date() }
        });

        // Fiscal Retentions
        try {
            const period = `${payroll.year}-${String(payroll.month).padStart(2, '0')}`;
            if (Number(payroll.inssDeduction) > 0) {
                await prisma.taxRetention.create({
                    data: {
                        type: 'inss_employee', entityType: 'salary', entityId: payroll.id,
                        period, baseAmount: payroll.baseSalary, retainedAmount: payroll.inssDeduction,
                        rate: 3, description: `INSS (Trab.) - ${payroll.employee.name} - ${period}`
                    }
                });
            }

            const inssEmployerConfig = await prisma.taxConfig.findFirst({
                where: { type: 'inss_employer', isActive: true }
            });
            const employerRate = inssEmployerConfig?.rate ? Number(inssEmployerConfig.rate) : 4;
            const employerInssAmount = Number(payroll.baseSalary) * (employerRate / 100);

            if (employerInssAmount > 0) {
                await prisma.taxRetention.create({
                    data: {
                        type: 'inss_employer', entityType: 'salary', entityId: payroll.id,
                        period, baseAmount: payroll.baseSalary, retainedAmount: employerInssAmount,
                        rate: employerRate, description: `INSS (Emp.) - ${payroll.employee.name} - ${period}`
                    }
                });
            }

            if (Number(payroll.irtDeduction) > 0) {
                await prisma.taxRetention.create({
                    data: {
                        type: 'irt', entityType: 'salary', entityId: payroll.id,
                        period, baseAmount: payroll.totalEarnings, retainedAmount: payroll.irtDeduction,
                        rate: 0, description: `IRPS - ${payroll.employee.name} - ${period}`
                    }
                });
            }
        } catch (error) {
            console.error('Fiscal retention error:', error);
        }

        return true;
    }

    async pay(payrollId: string, companyId: string) {
        const existing = await prisma.payrollRecord.findFirst({
            where: { id: payrollId, employee: { companyId } }
        });

        if (!existing) throw ApiError.notFound('Folha de pagamento não encontrada');

        return prisma.payrollRecord.update({
            where: { id: payrollId },
            data: { status: 'paid', paidAt: new Date() }
        });
    }

    private calculateIRT(income: number): number {
        if (income <= 42500) return 0;
        if (income <= 100000) return (income - 42500) * 0.10;
        if (income <= 250000) return 5750 + (income - 100000) * 0.15;
        if (income <= 500000) return 28250 + (income - 250000) * 0.20;
        return 78250 + (income - 500000) * 0.25;
    }
}

export const payrollService = new PayrollService();
