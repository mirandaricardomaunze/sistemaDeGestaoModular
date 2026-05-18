import { Prisma, EmployeeRole, MaritalStatus, ContractType, EducationLevel } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { getPaginationParams, createPaginatedResponse, parseFields } from '../utils/pagination';
import { ResultHandler } from '../utils/result';

const EMPLOYEE_FIELD_ALLOWLIST = [
    'id', 'code', 'name', 'email', 'phone', 'role', 'department',
    'position', 'salary', 'hireDate', 'isActive', 'createdAt', 'updatedAt'
] as const;

type ListQuery = {
    page?: string | number;
    limit?: string | number;
    search?: string;
    role?: string;
    department?: string;
    isActive?: string | boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    fields?: string;
};

type QualificationInput = {
    level: string;
    courseName: string;
    institution?: string;
    startYear: number;
    endYear?: number | null;
    isCompleted?: boolean;
    certificateNumber?: string | null;
};

type EmployeeInput = {
    code?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    role?: string;
    department?: string | null;
    position?: string | null;
    hireDate: string | Date;
    address?: string | null;
    documentNumber?: string | null;
    emergencyContact?: string | null;
    notes?: string | null;
    birthDate?: string | Date | null;
    maritalStatus?: string | null;
    dependents?: number;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankNib?: string | null;
    socialSecurityNumber?: string | null;
    nuit?: string | null;
    baseSalary?: number | string;
    subsidyTransport?: number | string;
    subsidyFood?: number | string;
    contractType?: string;
    contractExpiry?: string | Date | null;
    commissionRate?: number | string | null;
    isActive?: boolean;
    reportsToId?: string | null;
    skills?: string[];
    qualifications?: QualificationInput[];
};

type EmployeeUpdateInput = Partial<EmployeeInput>;

export class EmployeesService {
    async list(params: ListQuery, companyId: string) {
        const { page, limit, skip } = getPaginationParams(params);
        const {
            search,
            role,
            department,
            isActive,
            sortBy = 'name',
            sortOrder = 'asc'
        } = params;

        const where: Prisma.EmployeeWhereInput = { companyId };

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { code: { contains: String(search), mode: 'insensitive' } },
                { email: { contains: String(search), mode: 'insensitive' } }
            ];
        }

        if (role) where.role = role as EmployeeRole;
        if (department) where.department = department;
        if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

        const projection = parseFields(params.fields, EMPLOYEE_FIELD_ALLOWLIST);
        const findArgs: Prisma.EmployeeFindManyArgs = {
            where,
            orderBy: { [sortBy]: sortOrder },
            skip,
            take: limit
        };
        if (projection) {
            findArgs.select = projection satisfies Prisma.EmployeeSelect;
        } else {
            findArgs.include = {
                qualifications: true,
                _count: {
                    select: {
                        attendanceRecords: true,
                        payrollRecords: true,
                        vacationRequests: true
                    }
                }
            };
        }

        const [total, employees] = await Promise.all([
            prisma.employee.count({ where }),
            prisma.employee.findMany(findArgs)
        ]);

        const response = createPaginatedResponse(employees, page, limit, total);
        return ResultHandler.success(response);
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

        return ResultHandler.success(employee);
    }

    async create(data: EmployeeInput, companyId: string) {
        const code = data.code || `EMP-${Date.now().toString().slice(-6)}`;

        // Extract only scalar fields that match the Prisma Employee model
        const employee = await prisma.employee.create({
            data: {
                code,
                name: data.name,
                email: data.email ?? '',
                phone: data.phone ?? '',
                role: (data.role || 'operator') as EmployeeRole,
                department: data.department || null,
                hireDate: new Date(data.hireDate),
                address: data.address || null,
                documentNumber: data.documentNumber || null,
                emergencyContact: data.emergencyContact || null,
                notes: data.notes || null,
                birthDate: data.birthDate ? new Date(data.birthDate) : null,
                maritalStatus: (data.maritalStatus || null) as MaritalStatus | null,
                dependents: data.dependents || 0,
                bankName: data.bankName || null,
                bankAccountNumber: data.bankAccountNumber || null,
                bankNib: data.bankNib || null,
                socialSecurityNumber: data.socialSecurityNumber || null,
                nuit: data.nuit || null,
                baseSalary: data.baseSalary ?? 0,
                subsidyTransport: data.subsidyTransport ?? 0,
                subsidyFood: data.subsidyFood ?? 0,
                contractType: (data.contractType || 'indefinite') as ContractType,
                contractExpiry: data.contractExpiry ? new Date(data.contractExpiry) : null,
                commissionRate: data.commissionRate ?? null,
                skills: data.skills || [],
                isActive: data.isActive ?? true,
                company: { connect: { id: companyId } },
                // Use relation connect syntax for self-referencing hierarchy
                ...(data.reportsToId ? { reportsTo: { connect: { id: data.reportsToId } } } : {}),
                // Handle qualifications as nested create if provided
                ...(data.qualifications?.length ? {
                    qualifications: {
                        create: data.qualifications.map((q: QualificationInput) => ({
                            level: q.level as EducationLevel,
                            courseName: q.courseName,
                            institution: q.institution ?? '',
                            startYear: q.startYear,
                            endYear: q.endYear ?? null,
                            isCompleted: q.isCompleted ?? false,
                            certificateNumber: q.certificateNumber ?? null,
                            company: { connect: { id: companyId } },
                        }))
                    }
                } : {}),
            }
        });

        return ResultHandler.success(employee, 'Funcionário cadastrado com sucesso');
    }

    async update(id: string, data: EmployeeUpdateInput, companyId: string) {
        const existing = await prisma.employee.findUnique({
            where: { id },
            select: { id: true, companyId: true }
        });

        if (!existing) throw ApiError.notFound('Funcionário não encontrado');
        if (existing.companyId !== companyId) throw ApiError.forbidden('Acesso negado');

        const { qualifications: _q, reportsToId: _r, ...rest } = data;
        const updateData: Prisma.EmployeeUpdateInput = { ...(rest as Prisma.EmployeeUpdateInput) };
        if (data.hireDate) updateData.hireDate = new Date(data.hireDate);
        if (data.birthDate) updateData.birthDate = new Date(data.birthDate);
        if (data.contractExpiry) updateData.contractExpiry = new Date(data.contractExpiry);

        const employee = await prisma.employee.update({
            where: { id },
            data: updateData
        });

        return ResultHandler.success(employee, 'Dados do funcionário actualizados');
    }

    async delete(id: string, companyId: string) {
        const existing = await prisma.employee.findUnique({
            where: { id },
            select: { id: true, companyId: true }
        });

        if (!existing) throw ApiError.notFound('Funcionário não encontrado');
        if (existing.companyId !== companyId) throw ApiError.forbidden('Acesso negado');

        const employee = await prisma.employee.update({
            where: { id },
            data: { isActive: false }
        });

        return ResultHandler.success(employee, 'Colaborador desativado');
    }
}

export const employeesService = new EmployeesService();
