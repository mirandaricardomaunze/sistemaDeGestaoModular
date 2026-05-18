import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { buildPaginationMeta } from '../utils/pagination';
import { ResultHandler, Result } from '../utils/result';

type ListQuery = {
    status?: string;
    year?: string | number;
    page?: string | number;
    limit?: string | number;
};

type VacationRequestRow = Prisma.VacationRequestGetPayload<Record<string, never>>;

type RequestInput = {
    startDate: string | Date;
    endDate: string | Date;
    notes?: string | null;
};

type UpdateStatusInput = {
    status: string;
    approvedBy?: string | null;
};

export class VacationService {
    async list(params: ListQuery, companyId: string): Promise<Result<{ data: VacationRequestRow[]; pagination: ReturnType<typeof buildPaginationMeta> }>> {
        const { status, year, page = '1', limit = '20' } = params;
        const pageNum = parseInt(String(page));
        const limitNum = parseInt(String(limit));
        const skip = (pageNum - 1) * limitNum;

        const where: Prisma.VacationRequestWhereInput = {
            employee: { companyId }
        };
        if (status) where.status = status as Prisma.VacationRequestWhereInput['status'];
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

        const response = {
            data: vacations,
            pagination: buildPaginationMeta(pageNum, limitNum, total)
        };
        return ResultHandler.success(response);
    }

    async request(employeeId: string, data: RequestInput, companyId: string): Promise<Result<VacationRequestRow>> {
        const employee = await prisma.employee.findFirst({
            where: { id: employeeId, companyId }
        });
        if (!employee) throw ApiError.notFound('Funcionário não encontrado');

        const { startDate, endDate, notes } = data;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        const vacation = await prisma.vacationRequest.create({
            data: {
                employeeId,
                startDate: start,
                endDate: end,
                days,
                notes
            }
        });
        return ResultHandler.success(vacation, 'Pedido de férias realizado com sucesso');
    }

    async updateStatus(vacationId: string, data: UpdateStatusInput, companyId: string): Promise<Result<VacationRequestRow>> {
        const existing = await prisma.vacationRequest.findFirst({
            where: { id: vacationId, employee: { companyId } }
        });
        if (!existing) throw ApiError.notFound('Pedido de férias não encontrado');

        const { status, approvedBy } = data;
        if (status === 'approved' && existing.status !== 'approved') {
            const employee = await prisma.employee.findFirst({
                where: { id: existing.employeeId, companyId },
                select: { vacationDaysTotal: true, vacationDaysUsed: true }
            });
            const remainingDays = (employee?.vacationDaysTotal || 22) - (employee?.vacationDaysUsed || 0);
            if (existing.days > remainingDays) {
                throw ApiError.badRequest(`Saldo de ferias insuficiente. Disponivel: ${remainingDays} dia(s).`);
            }
        }

        const vacation = await prisma.vacationRequest.update({
            where: { id: vacationId },
            data: { status: status as Prisma.VacationRequestUncheckedUpdateInput['status'], approvedBy }
        });

        if (status === 'approved' && existing.status !== 'approved') {
            await prisma.employee.update({
                where: { id: vacation.employeeId },
                data: { vacationDaysUsed: { increment: vacation.days } }
            });
        }

        return ResultHandler.success(vacation, status === 'approved' ? 'Pedido aprovado' : 'Pedido rejeitado');
    }
}

export const vacationService = new VacationService();
