import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';
import { logger } from '../utils/logger';
import { ResultHandler, Result } from '../utils/result';

export class PayrollService {
    async list(params: any, companyId: string): Promise<Result<any>> {
        const { year, month, employeeId, status, page = '1', limit = '20' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            employee: { companyId }
        };

        if (year) where.year = parseInt(year);
        if (month) where.month = parseInt(month);
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;

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

        const response = {
            data: records,
            totals,
            pagination: buildPaginationMeta(pageNum, limitNum, total)
        };
        return ResultHandler.success(response);
    }

    async upsert(employeeId: string, data: any, companyId: string): Promise<Result<any>> {
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, companyId },
            include: { commissionRule: true }
        });

        if (!employee) throw ApiError.notFound('Funcionário não encontrado');

        const { month, year, otHours, advances, notes } = data;
        let { bonus } = data;

        // If bonus is not manually provided, calculate it dynamically
        if (bonus === undefined || bonus === null) {
            bonus = await this.calculateDynamicBonus(employee, month, year);
        }

        const baseSalary = Number(employee.baseSalary);
        const allowances = Number(employee.subsidyTransport || 0) + Number(employee.subsidyFood || 0);
        const otAmount = (baseSalary / 176) * 1.5 * (otHours || 0);
        const totalEarnings = baseSalary + allowances + otAmount + (Number(bonus) || 0);

        const inssDeduction = baseSalary * 0.03;
        const irtDeduction = this.calculateIRT(totalEarnings);
        const totalDeductions = inssDeduction + irtDeduction + (advances || 0);
        const netSalary = totalEarnings - totalDeductions;

        const payroll = await prisma.payrollRecord.upsert({
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
        return ResultHandler.success(payroll, 'Folha de pagamento atualizada');
    }

    private async calculateDynamicBonus(employee: any, month: number, year: number): Promise<number> {
        if (!employee.commissionRule && !employee.commissionRate) return 0;
        if (!employee.userId) {
            logger.warn(`Employee ${employee.id} has no linked userId -- skipping commission calculation`);
            return 0;
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const sales = await prisma.sale.aggregate({
            where: {
                userId: employee.userId,
                createdAt: { gte: startDate, lte: endDate }
            },
            _sum: { total: true }
        });

        const totalSales = Number(sales._sum.total || 0);
        if (totalSales === 0) return 0;

        // Priority 1: CommissionRule (Dynamic)
        if (employee.commissionRule && employee.commissionRule.isActive) {
            const rule = employee.commissionRule;
            if (rule.type === 'fixed') {
                return totalSales * (Number(rule.rate || 0) / 100);
            }
            if (rule.type === 'tiered' && rule.tiers) {
                const tiers = rule.tiers as any[];
                // Sort tiers by min value descending
                const sortedTiers = tiers.sort((a, b) => b.min - a.min);
                const activeTier = sortedTiers.find(t => totalSales >= t.min);
                if (activeTier) {
                    return totalSales * (Number(activeTier.rate) / 100);
                }
            }
        }

        // Priority 2: Simple commissionRate field
        if (employee.commissionRate) {
            return totalSales * (Number(employee.commissionRate) / 100);
        }

        return 0;
    }

    async process(payrollId: string, companyId: string): Promise<Result<any>> {
        const payroll = await prisma.payrollRecord.findFirst({
            where: { id: payrollId, employee: { companyId } },
            include: { employee: true }
        });

        if (!payroll) throw ApiError.notFound('Folha de pagamento não encontrada');

        const result = await prisma.payrollRecord.update({
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
            logger.error('Payroll fiscal retention failed', { payrollId: payroll.id, error });
        }

        return ResultHandler.success(result, 'Folha de pagamento processada com sucesso');
    }

    async pay(payrollId: string, companyId: string): Promise<Result<any>> {
        const existing = await prisma.payrollRecord.findFirst({
            where: { id: payrollId, employee: { companyId } }
        });

        if (existing) {
            const result = await prisma.payrollRecord.update({
                where: { id: payrollId },
                data: { status: 'paid', paidAt: new Date() }
            });
            return ResultHandler.success(result, 'Folha de pagamento marcada como paga');
        }
        throw ApiError.notFound('Folha de pagamento não encontrada');
    }

    async update(payrollId: string, data: any, companyId: string): Promise<Result<any>> {
        const existing = await prisma.payrollRecord.findFirst({
            where: { id: payrollId, employee: { companyId } }
        });
        if (!existing) throw ApiError.notFound('Folha de pagamento não encontrada');

        const result = await prisma.payrollRecord.update({
            where: { id: payrollId },
            data: {
                status: data.status,
                otHours: data.otHours !== undefined ? Number(data.otHours) : undefined,
                otAmount: data.otAmount !== undefined ? Number(data.otAmount) : undefined,
                bonus: data.bonus !== undefined ? Number(data.bonus) : undefined,
                allowances: data.allowances !== undefined ? Number(data.allowances) : undefined,
                advances: data.advances !== undefined ? Number(data.advances) : undefined,
                notes: data.notes
            }
        });
        return ResultHandler.success(result, 'Folha de pagamento atualizada');
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
