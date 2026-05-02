import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { ResultHandler } from '../../utils/result';

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
        const where: any = { companyId };
        if (query.staffId) {
            const employee = await this.findEmployeeForStaff(companyId, query.staffId);
            if (!employee) throw ApiError.notFound('Colaborador não encontrado no sistema de RH');
            where.employeeId = employee.id;
        }

        if (query.startDate || query.endDate) {
            where.date = {};
            if (query.startDate) where.date.gte = new Date(query.startDate);
            if (query.endDate) where.date.lte = new Date(query.endDate);
        }

        const attendance = await prisma.attendanceRecord.findMany({
            where,
            include: { employee: { select: { id: true, name: true, code: true } } },
            orderBy: { date: 'desc' }
        });

        return ResultHandler.success(attendance);
    }

    async recordStaffTime(companyId: string, data: { staffId: string; type: 'clock_in' | 'clock_out'; notes?: string }) {
        const employee = await this.findEmployeeForStaff(companyId, data.staffId);
        if (!employee) throw ApiError.notFound('Colaborador não encontrado no sistema de RH');

        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];

        if (data.type === 'clock_in') {
            const record = await prisma.attendanceRecord.create({
                data: {
                    companyId,
                    employeeId: employee.id,
                    date: new Date(dateStr),
                    checkIn: today,
                    status: 'present'
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
                data: { checkOut: today }
            });
            return ResultHandler.success(updated);
        }
    }

    async getStaffPayroll(companyId: string, query: { month?: number; year?: number; staffId?: string }) {
        const where: any = { companyId };
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
        const totalEarnings = baseSalary;
        const totalDeductions = baseSalary * 0.03;
        const netSalary = totalEarnings - totalDeductions;

        const record = await prisma.payrollRecord.create({
            data: {
                companyId,
                employeeId: employee.id,
                month: data.month,
                year: data.year,
                baseSalary,
                totalEarnings,
                totalDeductions,
                netSalary,
                status: 'draft'
            }
        });

        return ResultHandler.success(record);
    }

    async updateStaffPayrollStatus(companyId: string, id: string, status: string) {
        const record = await prisma.payrollRecord.findFirst({ where: { id, companyId } });
        if (!record) throw ApiError.notFound('Folha de salário não encontrada');

        const updateData: any = { status };
        if (status === 'processed') updateData.processedAt = new Date();
        if (status === 'paid') updateData.paidAt = new Date();

        return ResultHandler.success(await prisma.payrollRecord.update({ where: { id }, data: updateData }));
    }
}
