import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';

export class VacationService {
    async list(params: any, companyId: string) {
        const { status, year, page = '1', limit = '20' } = params;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            employee: { companyId }
        };
        if (status) where.status = status;
        if (year) {
            const y = parseInt(String(year));
            where.startDate = {
                gte: new Date(y, 0, 1),
                lte: new Date(y, 11, 31)
            };
        }

        const [total, vacations] = await Promise.all([
            prisma.vacationRequest.count({ where }),
            prisma.vacationRequest.findMany({
                where,
                include: {
                    employee: { select: { id: true, name: true, code: true, department: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        return {
            data: vacations,
            pagination: buildPaginationMeta(pageNum, limitNum, total)
        };
    }

    async request(employeeId: string, data: any, companyId: string) {
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, companyId }
        });
        if (!employee) throw ApiError.notFound('Funcionário não encontrado');

        const { startDate, endDate, notes } = data;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        return prisma.vacationRequest.create({
            data: {
                employeeId,
                startDate: start,
                endDate: end,
                days,
                notes
            }
        });
    }

    async updateStatus(vacationId: string, data: any, companyId: string) {
        const existing = await prisma.vacationRequest.findFirst({
            where: { id: vacationId, employee: { companyId } }
        });
        if (!existing) throw ApiError.notFound('Pedido de férias não encontrado');

        const { status, approvedBy } = data;
        const vacation = await prisma.vacationRequest.update({
            where: { id: vacationId },
            data: { status, approvedBy }
        });

        if (status === 'approved') {
            await prisma.employee.update({
                where: { id: vacation.employeeId },
                data: { vacationDaysUsed: { increment: vacation.days } }
            });
        }

        return vacation;
    }
}

export const vacationService = new VacationService();
