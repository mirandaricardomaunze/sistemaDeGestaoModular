import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';
import { logger } from '../utils/logger';
import { ResultHandler, Result } from '../utils/result';
import { approvalsService } from './approvalsService';
import { getThresholds, isOverThreshold } from './approvals/thresholds';
import { payrollEngine } from './payrollEngine.service';

type ListQuery = {
    year?: string | number;
    month?: string | number;
    employeeId?: string;
    status?: string;
    originModule?: string;
    page?: string | number;
    limit?: string | number;
};

type PayrollUpsertInput = {
    month: number;
    year: number;
    otHours?: number;
    advances?: number;
    notes?: string;
    bonus?: number;
    originModule?: string;
};

type PayrollUpdateInput = {
    status?: string;
    otHours?: number | string;
    otAmount?: number | string;
    bonus?: number | string;
    allowances?: number | string;
    advances?: number | string;
    notes?: string;
    approvalId?: string;
};

type CommissionRule = {
    isActive: boolean;
    type: 'fixed' | 'tiered' | 'profit_based';
    rate?: number;
    tiers?: Array<{ min: number; rate: number }>;
};

type EmployeeForCommission = {
    id: string;
    userId?: string | null;
    commissionRule?: CommissionRule | null;
    commissionRate?: number | null;
};

export class PayrollService {
    async list(params: ListQuery, companyId: string): Promise<Result<unknown>> {
        const { year, month, employeeId, status, originModule, page = '1', limit = '20' } = params;
        const pageNum = parseInt(String(page));
        const limitNum = parseInt(String(limit));
        const skip = (pageNum - 1) * limitNum;

        const where: Prisma.PayrollRecordWhereInput = {
            employee: { companyId }
        };

        if (year) where.year = parseInt(String(year));
        if (month) where.month = parseInt(String(month));
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status as Prisma.PayrollRecordWhereInput['status'];
        if (originModule) where.originModule = originModule;

        const [total, records] = await Promise.all([
            prisma.payrollRecord.count({ where }),
            prisma.payrollRecord.findMany({
                where,
                include: {
                    employee: { select: { id: true, name: true, code: true, role: true, department: true } }
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

    async upsert(employeeId: string, data: PayrollUpsertInput, companyId: string): Promise<Result<unknown>> {
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, companyId },
            include: { commissionRule: true }
        });

        if (!employee) throw ApiError.notFound('Funcionário não encontrado');

        const { month, year, otHours, advances, notes, originModule = 'hr' } = data;
        let { bonus } = data;

        // If bonus is not manually provided, calculate it dynamically
        if (bonus === undefined || bonus === null) {
            bonus = await this.calculateDynamicBonus(employee as unknown as EmployeeForCommission, month, year);
        }

        const baseSalary = Number(employee.baseSalary);
        const otAmount = (baseSalary / 176) * 1.5 * (otHours || 0);
        const transportSubsidy = Number(employee.subsidyTransport || 0);
        const foodSubsidy = Number(employee.subsidyFood || 0);
        const result = payrollEngine.calculate({
            baseSalary,
            overtimeAmount: otAmount,
            bonus: Number(bonus) || 0,
            allowances: [
                { name: 'Subsidio de transporte', amount: transportSubsidy, taxable: false },
                { name: 'Subsidio de alimentacao', amount: foodSubsidy, taxable: false }
            ],
            deductions: [{ name: 'Adiantamentos', amount: advances || 0 }]
        });
        const allowances = transportSubsidy + foodSubsidy;

        const payroll = await prisma.payrollRecord.upsert({
            where: {
                employeeId_month_year: { employeeId, month, year }
            },
            update: {
                baseSalary, otHours: otHours || 0, otAmount, bonus: bonus || 0,
                allowances, inssDeduction: result.inssEmployee, inssEmployer: result.inssEmployer,
                irtDeduction: result.irt, advances: advances || 0,
                totalEarnings: result.grossSalary, totalDeductions: result.totalDeductions,
                netSalary: result.netSalary, notes, originModule
            },
            create: {
                employeeId, month, year, baseSalary, otHours: otHours || 0,
                otAmount, bonus: bonus || 0, allowances, inssDeduction: result.inssEmployee,
                inssEmployer: result.inssEmployer, irtDeduction: result.irt,
                advances: advances || 0, totalEarnings: result.grossSalary,
                totalDeductions: result.totalDeductions, netSalary: result.netSalary,
                notes, originModule
            }
        });
        return ResultHandler.success(payroll, 'Folha de pagamento atualizada');
    }

    private async calculateDynamicBonus(employee: EmployeeForCommission, month: number, year: number): Promise<number> {
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
            if (rule.type === 'profit_based') {
                const saleItems = await prisma.saleItem.findMany({
                    where: {
                        sale: {
                            userId: employee.userId,
                            createdAt: { gte: startDate, lte: endDate }
                        }
                    },
                    select: { total: true, quantity: true, costPrice: true, product: { select: { costPrice: true } } }
                });
                const grossProfit = saleItems.reduce((sum, item) => {
                    const revenue = Number(item.total || 0);
                    const cost = Number(item.costPrice ?? item.product?.costPrice ?? 0) * Number(item.quantity || 0);
                    return sum + Math.max(0, revenue - cost);
                }, 0);
                return grossProfit * (Number(rule.rate || 0) / 100);
            }
            if (rule.type === 'tiered' && rule.tiers) {
                const tiers = rule.tiers;
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

    async process(payrollId: string, companyId: string): Promise<Result<unknown>> {
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
            const employerInssAmount = Number(payroll.inssEmployer || 0) || Number(payroll.baseSalary) * (employerRate / 100);

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

    async pay(payrollId: string, companyId: string, approvalId?: string): Promise<Result<unknown>> {
        const existing = await prisma.payrollRecord.findFirst({
            where: { id: payrollId, employee: { companyId } },
            include: { employee: true }
        });

        if (!existing) throw ApiError.notFound('Folha de pagamento não encontrada');

        const netPay = Number(existing.netSalary ?? 0);
        const thresholds = await getThresholds(companyId);
        if (isOverThreshold(thresholds, 'payrollRelease', netPay)) {
            const approval = approvalId
                ? await approvalsService.findApprovedFor(companyId, 'payroll_release', 'payroll', payrollId)
                : null;
            if (!approval) {
                throw ApiError.forbidden(
                    `Pagamento de folha acima do limite (${thresholds.payrollRelease}). Solicite aprovação.`
                );
            }
            if (approval.amount !== null && approval.amount + 0.01 < netPay) {
                throw ApiError.forbidden('O valor excede a aprovação concedida.');
            }
        }

        const result = await prisma.payrollRecord.update({
            where: { id: payrollId },
            data: { status: 'paid', paidAt: new Date() }
        });

        if (approvalId) {
            await approvalsService.markConsumed(approvalId, companyId).catch(() => {});
        }
        return ResultHandler.success(result, 'Folha de pagamento marcada como paga');
    }

    async update(payrollId: string, data: PayrollUpdateInput, companyId: string): Promise<Result<unknown>> {
        const existing = await prisma.payrollRecord.findFirst({
            where: { id: payrollId, employee: { companyId } },
            include: { employee: true }
        });
        if (!existing) throw ApiError.notFound('Folha de pagamento não encontrada');

        // Bonus increases above the threshold need approval (delta-based: only
        // the *extra* amount over the previous bonus counts).
        if (data.bonus !== undefined) {
            const previousBonus = Number(existing.bonus ?? 0);
            const newBonus = Number(data.bonus);
            const delta = newBonus - previousBonus;
            if (delta > 0) {
                const thresholds = await getThresholds(companyId);
                if (isOverThreshold(thresholds, 'bonusRelease', delta)) {
                    const approval = data.approvalId
                        ? await approvalsService.findApprovedFor(companyId, 'bonus_release', 'payroll', payrollId)
                        : null;
                    if (!approval) {
                        throw ApiError.forbidden(
                            `Bónus acima do limite (${thresholds.bonusRelease}). Solicite aprovação.`
                        );
                    }
                    if (approval.amount !== null && approval.amount + 0.01 < delta) {
                        throw ApiError.forbidden('O valor excede a aprovação concedida.');
                    }
                }
            }
        }

        const baseSalary = Number(existing.employee.baseSalary || existing.baseSalary || 0);
        const otHours = data.otHours !== undefined ? Number(data.otHours) : Number(existing.otHours || 0);
        const otAmount = data.otAmount !== undefined
            ? Number(data.otAmount)
            : (baseSalary / 176) * 1.5 * otHours;
        const bonus = data.bonus !== undefined ? Number(data.bonus) : Number(existing.bonus || 0);
        const advances = data.advances !== undefined ? Number(data.advances) : Number(existing.advances || 0);
        const subsidyTotal = Number(existing.employee.subsidyTransport || 0) + Number(existing.employee.subsidyFood || 0);
        const allowances = data.allowances !== undefined ? Number(data.allowances) : subsidyTotal;
        const payrollCalc = payrollEngine.calculate({
            baseSalary,
            overtimeAmount: otAmount,
            bonus,
            allowances: [{ name: 'Subsidios', amount: allowances, taxable: false }],
            deductions: [{ name: 'Adiantamentos', amount: advances }]
        });

        const result = await prisma.payrollRecord.update({
            where: { id: payrollId },
            data: {
                status: data.status as Prisma.PayrollRecordUncheckedUpdateInput['status'],
                baseSalary,
                otHours,
                otAmount,
                bonus,
                allowances,
                advances,
                inssDeduction: payrollCalc.inssEmployee,
                inssEmployer: payrollCalc.inssEmployer,
                irtDeduction: payrollCalc.irt,
                totalEarnings: payrollCalc.grossSalary,
                totalDeductions: payrollCalc.totalDeductions,
                netSalary: payrollCalc.netSalary,
                notes: data.notes
            }
        });
        if (data.approvalId) {
            await approvalsService.markConsumed(data.approvalId, companyId).catch(() => {});
        }
        return ResultHandler.success(result, 'Folha de pagamento atualizada');
    }
}

export const payrollService = new PayrollService();
