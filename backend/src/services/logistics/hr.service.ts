import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { ResultHandler } from '../../utils/result';
import { payrollEngine } from '../payrollEngine.service';

export class HRService {
    private async findEmployeeForStaff(companyId: string, staffId: string) {
        const emp = await prisma.employee.findFirst({ where: { id: staffId, companyId } });
        if (emp) return emp;

        const driver = await prisma.driver.findFirst({ where: { id: staffId, companyId } });
        if (!driver) return null;

        return prisma.employee.findFirst({
            where: {
                companyId,
                OR: [
                    { code: driver.code },
                    { email: driver.email || undefined }
                ]
            }
        });
    }

    async getStaffAttendance(companyId: string, query: { staffId?: string; startDate?: string; endDate?: string }) {
        const where: Prisma.AttendanceRecordWhereInput = { companyId };
        if (query.staffId) {
            const employee = await this.findEmployeeForStaff(companyId, query.staffId);
            if (!employee) throw ApiError.notFound('Colaborador não encontrado no sistema de RH');
            where.employeeId = employee.id;
        }

        if (query.startDate || query.endDate) {
            const dateRange: Prisma.DateTimeFilter = {};
            if (query.startDate) dateRange.gte = new Date(query.startDate);
            if (query.endDate) dateRange.lte = new Date(query.endDate);
            where.date = dateRange;
        }

        const attendance = await prisma.attendanceRecord.findMany({
            where,
            include: { employee: { select: { id: true, name: true, code: true } } },
            orderBy: { date: 'desc' }
        });

        return ResultHandler.success(attendance);
    }

    async recordStaffTime(companyId: string, data: { staffId: string; type: 'clock_in' | 'clock_out' | 'checkIn' | 'checkOut'; notes?: string }) {
        const employee = await this.findEmployeeForStaff(companyId, data.staffId);
        if (!employee) throw ApiError.notFound('Colaborador não encontrado no sistema de RH');

        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        const type = data.type === 'checkIn' ? 'clock_in' : data.type === 'checkOut' ? 'clock_out' : data.type;

        if (type === 'clock_in') {
            const record = await prisma.attendanceRecord.upsert({
                where: { employeeId_date: { employeeId: employee.id, date: new Date(dateStr) } },
                update: {
                    checkIn: today,
                    status: 'present',
                    notes: data.notes
                },
                create: {
                    companyId,
                    employeeId: employee.id,
                    date: new Date(dateStr),
                    checkIn: today,
                    status: 'present',
                    notes: data.notes
                }
            });
            return ResultHandler.success(record);
        } else {
            const record = await prisma.attendanceRecord.findFirst({
                where: { employeeId: employee.id, date: new Date(dateStr), checkOut: null },
                orderBy: { checkIn: 'desc' }
            });
            if (!record) throw ApiError.badRequest('Nenhuma entrada em aberto encontrada para hoje');

            const updated = await prisma.attendanceRecord.update({
                where: { id: record.id },
                data: { checkOut: today, notes: data.notes ?? record.notes }
            });
            return ResultHandler.success(updated);
        }
    }

    async getStaffPayroll(companyId: string, query: { month?: number; year?: number; staffId?: string }) {
        const where: Prisma.PayrollRecordWhereInput = { companyId };
        if (query.month) where.month = Number(query.month);
        if (query.year) where.year = Number(query.year);
        if (query.staffId) {
            const employee = await this.findEmployeeForStaff(companyId, query.staffId);
            if (employee) where.employeeId = employee.id;
        }

        const payroll = await prisma.payrollRecord.findMany({
            where,
            include: { employee: { select: { id: true, name: true, code: true } } },
            orderBy: { month: 'desc' }
        });

        return ResultHandler.success(payroll);
    }

    async createStaffPayroll(companyId: string, data: { staffId: string; month: number; year: number }) {
        const employee = await this.findEmployeeForStaff(companyId, data.staffId);
        if (!employee) throw ApiError.notFound('Colaborador não encontrado');

        const baseSalary = Number(employee.baseSalary || 0);
        const allowances = Number(employee.subsidyTransport || 0) + Number(employee.subsidyFood || 0);
        const result = payrollEngine.calculate({
            baseSalary,
            allowances: [{ name: 'Subsidios', amount: allowances, taxable: false }]
        });

        const record = await prisma.payrollRecord.upsert({
            where: { employeeId_month_year: { employeeId: employee.id, month: data.month, year: data.year } },
            update: {
                baseSalary,
                allowances,
                inssDeduction: result.inssEmployee,
                inssEmployer: result.inssEmployer,
                irtDeduction: result.irt,
                totalEarnings: result.grossSalary,
                totalDeductions: result.totalDeductions,
                netSalary: result.netSalary,
                originModule: 'logistics'
            },
            create: {
                companyId,
                employeeId: employee.id,
                month: data.month,
                year: data.year,
                baseSalary,
                allowances,
                inssDeduction: result.inssEmployee,
                inssEmployer: result.inssEmployer,
                irtDeduction: result.irt,
                totalEarnings: result.grossSalary,
                totalDeductions: result.totalDeductions,
                netSalary: result.netSalary,
                originModule: 'logistics',
                status: 'draft'
            }
        });

        return ResultHandler.success(record);
    }

    async updateStaffPayrollStatus(companyId: string, id: string, status: string) {
        const record = await prisma.payrollRecord.findFirst({ where: { id, companyId } });
        if (!record) throw ApiError.notFound('Folha de salário não encontrada');

        const updateData: Prisma.PayrollRecordUpdateInput = { status: status as Prisma.PayrollRecordUpdateInput['status'] };
        if (status === 'processed') updateData.processedAt = new Date();
        if (status === 'paid') updateData.paidAt = new Date();

        return ResultHandler.success(await prisma.payrollRecord.update({ where: { id }, data: updateData }));
    }
}
