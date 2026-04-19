import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { ResultHandler, Result } from '../utils/result';

export class AttendanceService {
    /**
     * Get all employees currently in the attendance roster for a specific company
     */
    async getRoster(companyId: string): Promise<Result<any>> {
        const roster = await prisma.employee.findMany({
            where: {
                companyId,
                inAttendanceRoster: true,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                code: true,
                department: true,
                phone: true
            },
            orderBy: { name: 'asc' }
        });
        return ResultHandler.success(roster);
    }

    /**
     * Add employees to the attendance roster
     */
    async addToRoster(companyId: string, employeeIds?: string[], department?: string): Promise<Result<any>> {
        const where: any = { companyId };

        if (employeeIds && employeeIds.length > 0) {
            where.id = { in: employeeIds };
        } else if (department) {
            where.department = department;
        } else {
            throw ApiError.badRequest('É necessário fornecer IDs de funcionários ou um departamento.');
        }

        const result = await prisma.employee.updateMany({
            where,
            data: { inAttendanceRoster: true }
        });
        return ResultHandler.success(result, 'Funcionários adicionados ao roster com sucesso');
    }

    /**
     * Remove an employee from the attendance roster
     */
    async removeFromRoster(companyId: string, employeeId: string): Promise<Result<any>> {
        const result = await prisma.employee.update({
            where: {
                id: employeeId,
                companyId // Ensure isolation
            },
            data: { inAttendanceRoster: false }
        });
        return ResultHandler.success(result, 'Funcionário removido do roster');
    }

    /**
     * Record time (check-in/check-out)
     */
    async recordTime(companyId: string, employeeId: string, type: 'checkIn' | 'checkOut', date: Date): Promise<Result<any>> {
        const today = new Date(date);
        today.setHours(0, 0, 0, 0);

        // Find existing record for today
        const existing = await prisma.attendanceRecord.findFirst({
            where: {
                employeeId,
                date: today,
                employee: { companyId }
            }
        });

        if (type === 'checkIn') {
            const attendance = await prisma.attendanceRecord.upsert({
                where: {
                    employeeId_date: {
                        employeeId,
                        date: today
                    }
                },
                create: {
                    employeeId,
                    date: today,
                    checkIn: date,
                    status: 'present'
                },
                update: {
                    checkIn: date,
                    status: 'present'
                }
            });
            return ResultHandler.success(attendance, 'Check-in registrado com sucesso');
        } else {
            // Check-out
            if (!existing) {
                throw ApiError.badRequest('Nenhum registro de entrada encontrado para hoje.');
            }

            // Calculate hours worked if checkIn exists
            let hoursWorked = undefined;
            if (existing.checkIn) {
                hoursWorked = (date.getTime() - existing.checkIn.getTime()) / (1000 * 60 * 60);
            }

            const attendance = await prisma.attendanceRecord.update({
                where: { id: existing.id },
                data: {
                    checkOut: date,
                    hoursWorked: hoursWorked ? Number(hoursWorked.toFixed(2)) : undefined
                }
            });
            return ResultHandler.success(attendance, 'Check-out registrado com sucesso');
        }
    }
}

export const attendanceService = new AttendanceService();
