import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';

export class EmployeesService {
    async list(params: any, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const {
            search,
            role,
            department,
            isActive,
            sortBy = 'name',
            sortOrder = 'asc'
        } = params;

        const where: any = { companyId };

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { code: { contains: String(search), mode: 'insensitive' } },
                { email: { contains: String(search), mode: 'insensitive' } }
            ];
        }

        if (role) where.role = role;
        if (department) where.department = department;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const [total, employees] = await Promise.all([
            prisma.employee.count({ where }),
            prisma.employee.findMany({
                where,
                include: {
                    qualifications: true,
                    _count: {
                        select: {
                            attendanceRecords: true,
                            payrollRecords: true,
                            vacationRequests: true
                        }
                    }
                },
                orderBy: { [sortBy as string]: sortOrder },
                skip,
                take: limit
            })
        ]);

        return createPaginatedResponse(employees, page, limit, total);
    }

    async getById(id: string, companyId: string) {
        const employee = await prisma.employee.findUnique({
            where: { id },
            include: {
                qualifications: true,
                attendanceRecords: { take: 30, orderBy: { date: 'desc' } },
                payrollRecords: { take: 12, orderBy: [{ year: 'desc' }, { month: 'desc' }] },
                vacationRequests: { orderBy: { createdAt: 'desc' } }
            }
        });

        if (!employee) throw ApiError.notFound('Funcionário não encontrado');
        if (employee.companyId !== companyId) throw ApiError.forbidden('Acesso negado');

        return employee;
    }

    async create(data: any, companyId: string) {
        const code = data.code || `EMP-${Date.now().toString().slice(-6)}`;
        const { notes, ...employeeData } = data;

        return prisma.employee.create({
            data: {
                ...employeeData,
                code,
                hireDate: new Date(data.hireDate),
                birthDate: data.birthDate ? new Date(data.birthDate) : null,
                contractExpiry: data.contractExpiry ? new Date(data.contractExpiry) : null,
                company: { connect: { id: companyId } }
            }
        });
    }

    async update(id: string, data: any, companyId: string) {
        const existing = await prisma.employee.findUnique({
            where: { id },
            select: { id: true, companyId: true }
        });

        if (!existing) throw ApiError.notFound('Funcionário não encontrado');
        if (existing.companyId !== companyId) throw ApiError.forbidden('Acesso negado');

        const updateData: any = { ...data };
        if (updateData.hireDate) updateData.hireDate = new Date(updateData.hireDate);
        if (updateData.birthDate) updateData.birthDate = new Date(updateData.birthDate);
        if (updateData.contractExpiry) updateData.contractExpiry = new Date(updateData.contractExpiry);

        return prisma.employee.update({
            where: { id },
            data: updateData
        });
    }

    async delete(id: string, companyId: string) {
        const existing = await prisma.employee.findUnique({
            where: { id },
            select: { id: true, companyId: true }
        });

        if (!existing) throw ApiError.notFound('Funcionário não encontrado');
        if (existing.companyId !== companyId) throw ApiError.forbidden('Acesso negado');

        return prisma.employee.update({
            where: { id },
            data: { isActive: false }
        });
    }
}

export const employeesService = new EmployeesService();
