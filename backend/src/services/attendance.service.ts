import { prisma } from '../index';

export class AttendanceService {
    /**
     * Get all employees currently in the attendance roster for a specific company
     */
    static async getRoster(companyId: string) {
        return prisma.employee.findMany({
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
                phone: true,
                status: true // If status exists based on recent attendance
            },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Add employees to the attendance roster
     */
    static async addToRoster(companyId: string, employeeIds?: string[], department?: string) {
        const where: any = { companyId };

        if (employeeIds && employeeIds.length > 0) {
            where.id = { in: employeeIds };
        } else if (department) {
            where.department = department;
        } else {
            throw new Error('É necessário fornecer IDs de funcionários ou um departamento.');
        }

        return prisma.employee.updateMany({
            where,
            data: { inAttendanceRoster: true }
        });
    }

    /**
     * Remove an employee from the attendance roster
     */
    static async removeFromRoster(companyId: string, employeeId: string) {
        return prisma.employee.update({
            where: {
                id: employeeId,
                companyId // Ensure isolation
            },
            data: { inAttendanceRoster: false }
        });
    }

    /**
     * Record time (check-in/check-out)
     */
    static async recordTime(companyId: string, employeeId: string, type: 'checkIn' | 'checkOut', date: Date) {
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
            return prisma.attendanceRecord.upsert({
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
        } else {
            // Check-out
            if (!existing) {
                throw new Error('Nenhum registro de entrada encontrado para hoje.');
            }

            // Calculate hours worked if checkIn exists
            let hoursWorked = undefined;
            if (existing.checkIn) {
                hoursWorked = (date.getTime() - existing.checkIn.getTime()) / (1000 * 60 * 60);
            }

            return prisma.attendanceRecord.update({
                where: { id: existing.id },
                data: {
                    checkOut: date,
                    hoursWorked: hoursWorked ? Number(hoursWorked.toFixed(2)) : undefined
                }
            });
        }
    }
}
