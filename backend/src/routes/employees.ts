import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
    createEmployeeSchema,
    updateEmployeeSchema,
    recordAttendanceSchema,
    generatePayrollSchema,
    requestVacationSchema,
    approveVacationSchema,
    formatZodError,
    ZodError
} from '../validation';
import { AttendanceService } from '../services/attendance.service';

const router = Router();

// Get attendance (generic/bulk) with pagination
router.get('/attendance', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            employeeId,
            startDate,
            endDate,
            month,
            year,
            page = '1',
            limit = '20'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            employee: {
                companyId: req.companyId // Multi-tenancy isolation
            }
        };

        if (employeeId) where.employeeId = String(employeeId);

        // Date filtering
        if (startDate && endDate) {
            where.date = {
                gte: new Date(String(startDate)),
                lte: new Date(String(endDate))
            };
        } else if (month && year) {
            const m = parseInt(String(month));
            const y = parseInt(String(year));
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 0);
            where.date = { gte: start, lte: end };
        }

        // Get total count and paginated records in parallel
        const [total, records] = await Promise.all([
            prisma.attendanceRecord.count({ where }),
            prisma.attendanceRecord.findMany({
                where,
                include: {
                    employee: {
                        select: { id: true, name: true, code: true }
                    }
                },
                orderBy: { date: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        // Calculate summary (Note: Summary for the *filtered* set, not just current page)
        // If summary needs to be for all data, we might need another aggregation query
        const allRecordsForSummary = await prisma.attendanceRecord.findMany({ where });

        const summary = {
            totalDays: allRecordsForSummary.length,
            presentDays: allRecordsForSummary.filter(r => r.status === 'present').length,
            absentDays: allRecordsForSummary.filter(r => r.status === 'absent').length,
            lateDays: allRecordsForSummary.filter(r => r.status === 'late').length,
            leaveDays: allRecordsForSummary.filter(r => r.status === 'leave').length,
            vacationDays: allRecordsForSummary.filter(r => r.status === 'vacation').length,
            totalHours: allRecordsForSummary.reduce((sum, r) => sum + (Number(r.hoursWorked) || 0), 0)
        };

        res.json({
            data: records,
            summary,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + records.length < total
            }
        });
    } catch (error) {
        console.error('Get bulk attendance error:', error);
        res.status(500).json({ error: 'Erro ao buscar presenças' });
    }
});

// Get all employees with pagination
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            search,
            role,
            department,
            isActive,
            page = '1',
            limit = '20',
            sortBy = 'name',
            sortOrder = 'asc'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};

        // ðŸ”’ CRITICAL: Filter by company for multi-tenant isolation
        if (req.companyId) {
            where.companyId = req.companyId;
        }

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

        // Get total count
        const total = await prisma.employee.count({ where });

        // Get paginated employees
        const employees = await prisma.employee.findMany({
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
            take: limitNum
        });

        res.json({
            data: employees,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + employees.length < total
            }
        });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({ error: 'Erro ao buscar funcionários' });
    }
});

// Get employee by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const employee = await prisma.employee.findUnique({
            where: { id: req.params.id },
            include: {
                qualifications: true,
                attendanceRecords: {
                    take: 30,
                    orderBy: { date: 'desc' }
                },
                payrollRecords: {
                    take: 12,
                    orderBy: [{ year: 'desc' }, { month: 'desc' }]
                },
                vacationRequests: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!employee) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }

        // ðŸ”’ CRITICAL: Verify employee belongs to user's company
        if (req.companyId && employee.companyId !== req.companyId) {
            return res.status(403).json({ error: 'Acesso negado: funcionário pertence a outra empresa' });
        }

        res.json(employee);
    } catch (error) {
        console.error('Get employee error:', error);
        res.status(500).json({ error: 'Erro ao buscar funcionário' });
    }
});

// Create employee
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const validatedData = createEmployeeSchema.parse(req.body);
        const code = validatedData.code || `EMP-${Date.now().toString().slice(-6)}`;

        // Destructure and prepare data for Prisma
        const { notes, ...employeeData } = validatedData as any;

        const employee = await prisma.employee.create({
            data: {
                ...employeeData,
                code,
                hireDate: new Date(validatedData.hireDate),
                birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : null,
                contractExpiry: validatedData.contractExpiry ? new Date(validatedData.contractExpiry) : null,
                // Use connect syntax for relation
                ...(req.companyId ? { company: { connect: { id: req.companyId } } } : {})
            }
        });

        res.status(201).json(employee);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        console.error('Create employee error:', error);
        res.status(500).json({ error: 'Erro ao criar funcionário' });
    }
});

// Update employee
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const validatedData = updateEmployeeSchema.parse(req.body);

        // ðŸ”’ CRITICAL: Verify employee belongs to user's company before update
        const existing = await prisma.employee.findUnique({
            where: { id: req.params.id },
            select: { id: true, companyId: true }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }

        if (req.companyId && existing.companyId !== req.companyId) {
            return res.status(403).json({ error: 'Acesso negado: funcionário pertence a outra empresa' });
        }

        const updateData: any = { ...validatedData };

        if (updateData.hireDate) updateData.hireDate = new Date(updateData.hireDate);
        if (updateData.birthDate) updateData.birthDate = new Date(updateData.birthDate);
        if (updateData.contractExpiry) updateData.contractExpiry = new Date(updateData.contractExpiry);

        const employee = await prisma.employee.update({
            where: { id: req.params.id },
            data: updateData
        });

        res.json(employee);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        console.error('Update employee error:', error);
        res.status(500).json({ error: 'Erro ao atualizar funcionário' });
    }
});

// Delete employee (soft delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        // ðŸ”’ CRITICAL: Verify employee belongs to user's company before delete
        const existing = await prisma.employee.findUnique({
            where: { id: req.params.id },
            select: { id: true, companyId: true }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }

        if (req.companyId && existing.companyId !== req.companyId) {
            return res.status(403).json({ error: 'Acesso negado: funcionário pertence a outra empresa' });
        }

        await prisma.employee.update({
            where: { id: req.params.id },
            data: { isActive: false }
        });

        res.json({ message: 'Funcionário removido com sucesso' });
    } catch (error) {
        console.error('Delete employee error:', error);
        res.status(500).json({ error: 'Erro ao remover funcionário' });
    }
});

// === ATTENDANCE ===

// Record attendance
router.post('/:id/attendance', authenticate, async (req: AuthRequest, res) => {
    try {
        const validatedData = recordAttendanceSchema.parse(req.body);
        const { date, checkIn, checkOut, status, notes, justification } = validatedData;

        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);

        // ðŸ”’ Verify employee ownership
        const employee = await prisma.employee.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });
        if (!employee) return res.status(404).json({ error: 'Funcionário não encontrado ou acesso negado' });

        // Calculate hours worked
        let hoursWorked = null;
        if (checkIn && checkOut) {
            const startStr = `${date.split('T')[0]}T${checkIn}`;
            const endStr = `${date.split('T')[0]}T${checkOut}`;
            const start = new Date(startStr);
            const end = new Date(endStr);
            hoursWorked = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }

        const attendance = await prisma.attendanceRecord.upsert({
            where: {
                employeeId_date: {
                    employeeId: req.params.id,
                    date: attendanceDate
                }
            },
            update: {
                checkIn: checkIn ? new Date(`${date.split('T')[0]}T${checkIn}`) : null,
                checkOut: checkOut ? new Date(`${date.split('T')[0]}T${checkOut}`) : null,
                status: status || 'present',
                hoursWorked,
                notes,
                justification
            },
            create: {
                employeeId: req.params.id,
                date: attendanceDate,
                checkIn: checkIn ? new Date(`${date.split('T')[0]}T${checkIn}`) : null,
                checkOut: checkOut ? new Date(`${date.split('T')[0]}T${checkOut}`) : null,
                status: status || 'present',
                hoursWorked,
                notes,
                justification
            }
        });

        res.json(attendance);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        console.error('Record attendance error:', error);
        res.status(500).json({ error: 'Erro ao registrar presença' });
    }
});

// Get attendance for month with pagination
router.get('/:id/attendance', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            month,
            year,
            page = '1',
            limit = '31'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const m = parseInt(String(month)) || new Date().getMonth() + 1;
        const y = parseInt(String(year)) || new Date().getFullYear();

        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 0);

        const where: any = {
            employeeId: req.params.id,
            employee: {
                companyId: req.companyId // Multi-tenancy isolation
            },
            date: {
                gte: startDate,
                lte: endDate
            }
        };

        // Get total count and paginated records in parallel
        const [total, records] = await Promise.all([
            prisma.attendanceRecord.count({ where }),
            prisma.attendanceRecord.findMany({
                where,
                orderBy: { date: 'asc' },
                skip,
                take: limitNum
            })
        ]);

        // Calculate summary for the month
        const allRecordsForSummary = await prisma.attendanceRecord.findMany({ where });

        const summary = {
            totalDays: allRecordsForSummary.length,
            presentDays: allRecordsForSummary.filter(r => r.status === 'present').length,
            absentDays: allRecordsForSummary.filter(r => r.status === 'absent').length,
            lateDays: allRecordsForSummary.filter(r => r.status === 'late').length,
            leaveDays: allRecordsForSummary.filter(r => r.status === 'leave').length,
            vacationDays: allRecordsForSummary.filter(r => r.status === 'vacation').length,
            totalHours: allRecordsForSummary.reduce((sum, r) => sum + (Number(r.hoursWorked) || 0), 0)
        };

        res.json({
            data: records,
            summary,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + records.length < total
            }
        });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Erro ao buscar presenças' });
    }
});

// === PAYROLL ===

// Create/Update payroll record
router.post('/:id/payroll', authenticate, async (req: AuthRequest, res) => {
    try {
        const employeeId = req.params.id;
        const validatedData = generatePayrollSchema.parse(req.body);
        const { month, year, otHours, bonus, advances, notes } = validatedData;

        const employee = await prisma.employee.findFirst({
            where: {
                id: employeeId,
                companyId: req.companyId // Multi-tenancy isolation
            }
        });

        if (!employee) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }

        const baseSalary = Number(employee.baseSalary);
        const allowances = Number(employee.subsidyTransport || 0) + Number(employee.subsidyFood || 0);
        const otAmount = (baseSalary / 176) * 1.5 * (otHours || 0); // 176 hours/month, 1.5x overtime

        const totalEarnings = baseSalary + allowances + otAmount + (bonus || 0);

        // Calculate deductions (Mozambique rates)
        const inssDeduction = baseSalary * 0.03; // 3% INSS employee contribution
        const irtDeduction = calculateIRT(totalEarnings); // IRT (Income Tax)
        const totalDeductions = inssDeduction + irtDeduction + (advances || 0);

        const netSalary = totalEarnings - totalDeductions;

        const payroll = await prisma.payrollRecord.upsert({
            where: {
                employeeId_month_year: {
                    employeeId,
                    month,
                    year
                }
            },
            update: {
                baseSalary,
                otHours: otHours || 0,
                otAmount,
                bonus: bonus || 0,
                allowances,
                inssDeduction,
                irtDeduction,
                advances: advances || 0,
                totalEarnings,
                totalDeductions,
                netSalary,
                notes
            },
            create: {
                employeeId,
                month,
                year,
                baseSalary,
                otHours: otHours || 0,
                otAmount,
                bonus: bonus || 0,
                allowances,
                inssDeduction,
                irtDeduction,
                advances: advances || 0,
                totalEarnings,
                totalDeductions,
                netSalary,
                notes
            }
        });

        res.json(payroll);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        console.error('Create payroll error:', error);
        res.status(500).json({ error: 'Erro ao processar folha de pagamento' });
    }
});

// Process payroll (mark as processed)
router.post('/payroll/:payrollId/process', authenticate, async (req: AuthRequest, res) => {
    try {
        const payroll = await prisma.payrollRecord.findFirst({
            where: {
                id: req.params.payrollId,
                employee: { companyId: req.companyId }
            },
            include: { employee: true }
        });

        if (!payroll) {
            return res.status(404).json({ error: 'Folha de pagamento não encontrada ou acesso negado' });
        }

        await prisma.payrollRecord.update({
            where: { id: req.params.payrollId },
            data: {
                status: 'processed',
                processedAt: new Date()
            }
        });

        // Register Fiscal Retentions (INSS and IRPS)
        try {
            const period = `${payroll.year}-${String(payroll.month).padStart(2, '0')}`;

            // 1. INSS Employee
            if (Number(payroll.inssDeduction) > 0) {
                await prisma.taxRetention.create({
                    data: {
                        type: 'inss_employee',
                        entityType: 'salary',
                        entityId: payroll.id,
                        period,
                        baseAmount: payroll.baseSalary,
                        retainedAmount: payroll.inssDeduction,
                        rate: 3, // Default 3% or fetch from TaxConfig
                        description: `INSS (Trab.) - ${payroll.employee.name} - ${period}`
                    }
                });
            }

            // 2. INSS Employer (Calculate based on config)
            const inssEmployerConfig = await prisma.taxConfig.findFirst({
                where: { type: 'inss_employer', isActive: true }
            });
            const employerRate = inssEmployerConfig?.rate ? Number(inssEmployerConfig.rate) : 4;
            const employerInssAmount = Number(payroll.baseSalary) * (employerRate / 100);

            if (employerInssAmount > 0) {
                await prisma.taxRetention.create({
                    data: {
                        type: 'inss_employer',
                        entityType: 'salary',
                        entityId: payroll.id,
                        period,
                        baseAmount: payroll.baseSalary,
                        retainedAmount: employerInssAmount,
                        rate: employerRate,
                        description: `INSS (Emp.) - ${payroll.employee.name} - ${period}`
                    }
                });
            }

            // 3. IRPS (IRT)
            if (Number(payroll.irtDeduction) > 0) {
                await prisma.taxRetention.create({
                    data: {
                        type: 'irt',
                        entityType: 'salary',
                        entityId: payroll.id,
                        period,
                        baseAmount: payroll.totalEarnings,
                        retainedAmount: payroll.irtDeduction,
                        rate: 0, // Progressive, so rate can be 0 or calculated
                        description: `IRPS - ${payroll.employee.name} - ${period}`
                    }
                });
            }
        } catch (fiscalError) {
            console.error('Failed to register fiscal retentions for payroll:', fiscalError);
        }

        res.json(payroll);
    } catch (error) {
        console.error('Process payroll error:', error);
        res.status(500).json({ error: 'Erro ao processar folha' });
    }
});

// Mark payroll as paid
router.post('/payroll/:payrollId/pay', authenticate, async (req: AuthRequest, res) => {
    try {
        // Verify ownership before payment
        const existing = await prisma.payrollRecord.findFirst({
            where: {
                id: req.params.payrollId,
                employee: { companyId: req.companyId }
            }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Folha de pagamento não encontrada ou acesso negado' });
        }

        const payroll = await prisma.payrollRecord.update({
            where: { id: req.params.payrollId },
            data: {
                status: 'paid',
                paidAt: new Date()
            }
        });

        res.json(payroll);
    } catch (error) {
        console.error('Pay payroll error:', error);
        res.status(500).json({ error: 'Erro ao marcar como pago' });
    }
});

// Get payroll for month with pagination
router.get('/payroll/month/:year/:month', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            page = '1',
            limit = '20'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const year = parseInt(req.params.year);
        const month = parseInt(req.params.month);

        const where: any = {
            year,
            month,
            employee: { companyId: req.companyId } // Multi-tenancy isolation
        };

        // Get total count and paginated records in parallel
        const [total, records] = await Promise.all([
            prisma.payrollRecord.count({ where }),
            prisma.payrollRecord.findMany({
                where,
                include: {
                    employee: {
                        select: { id: true, name: true, code: true, department: true }
                    }
                },
                skip,
                take: limitNum
            })
        ]);

        // Calculate totals for the month (should be for all, not just paginated)
        const allRecordsForTotals = await prisma.payrollRecord.findMany({ where });
        const totals = allRecordsForTotals.reduce((acc, r) => ({
            totalEarnings: acc.totalEarnings + Number(r.totalEarnings),
            totalDeductions: acc.totalDeductions + Number(r.totalDeductions),
            totalNetSalary: acc.totalNetSalary + Number(r.netSalary)
        }), { totalEarnings: 0, totalDeductions: 0, totalNetSalary: 0 });

        res.json({
            data: records,
            totals,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + records.length < total
            }
        });
    } catch (error) {
        console.error('Get payroll month error:', error);
        res.status(500).json({ error: 'Erro ao buscar folha mensal' });
    }
});

// === VACATIONS ===

// Request vacation
router.post('/:id/vacations', authenticate, async (req: AuthRequest, res) => {
    try {
        const validatedData = requestVacationSchema.parse(req.body);
        const { startDate, endDate, notes } = validatedData;

        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Verify employee ownership before creating vacation request
        const employee = await prisma.employee.findFirst({
            where: { id: req.params.id, companyId: req.companyId }
        });
        if (!employee) {
            return res.status(404).json({ error: 'Funcionário não encontrado ou acesso negado' });
        }

        const vacation = await prisma.vacationRequest.create({
            data: {
                employeeId: req.params.id,
                startDate: start,
                endDate: end,
                days,
                notes
            }
        });

        res.status(201).json(vacation);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        console.error('Request vacation error:', error);
        res.status(500).json({ error: 'Erro ao solicitar férias' });
    }
});

// Approve/Reject vacation
router.patch('/vacations/:vacationId', authenticate, async (req: AuthRequest, res) => {
    try {
        const validatedData = approveVacationSchema.parse(req.body);
        const { status, approvedBy } = validatedData;

        // Verify ownership before updating
        const existing = await prisma.vacationRequest.findFirst({
            where: {
                id: req.params.vacationId,
                employee: { companyId: req.companyId }
            }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Pedido de férias não encontrado ou acesso negado' });
        }

        const vacation = await prisma.vacationRequest.update({
            where: { id: req.params.vacationId },
            data: { status, approvedBy }
        });

        // If approved, update employee vacation days used
        if (status === 'approved') {
            await prisma.employee.update({
                where: { id: vacation.employeeId },
                data: {
                    vacationDaysUsed: { increment: vacation.days }
                }
            });
        }

        res.json(vacation);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', details: formatZodError(error) });
        }
        console.error('Update vacation error:', error);
        res.status(500).json({ error: 'Erro ao atualizar férias' });
    }
});

// Get all vacation requests with pagination
router.get('/vacations/all', authenticate, async (req: AuthRequest, res) => {
    try {
        const {
            status,
            year,
            page = '1',
            limit = '20'
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {
            employee: { companyId: req.companyId } // Multi-tenancy isolation
        };
        if (status) where.status = status;
        if (year) {
            const y = parseInt(String(year));
            where.startDate = {
                gte: new Date(y, 0, 1),
                lte: new Date(y, 11, 31)
            };
        }

        // Get total count and paginated items in parallel
        const [total, vacations] = await Promise.all([
            prisma.vacationRequest.count({ where }),
            prisma.vacationRequest.findMany({
                where,
                include: {
                    employee: {
                        select: { id: true, name: true, code: true, department: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum
            })
        ]);

        res.json({
            data: vacations,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + vacations.length < total
            }
        });
    } catch (error) {
        console.error('Get vacations error:', error);
        res.status(500).json({ error: 'Erro ao buscar férias' });
    }
});

// === ATTENDANCE ROSTER (NEW) ===

// Get current roster
router.get('/roster', authenticate, async (req: AuthRequest, res) => {
    try {
        const roster = await AttendanceService.getRoster(req.companyId!);
        res.json(roster);
    } catch (error) {
        console.error('Get roster error:', error);
        res.status(500).json({ error: 'Erro ao buscar área de ponto' });
    }
});

// Add to roster (by IDs or Department)
router.patch('/roster/add', authenticate, async (req: AuthRequest, res) => {
    try {
        const { employeeIds, department } = req.body;
        await AttendanceService.addToRoster(req.companyId!, employeeIds, department);
        res.json({ message: 'Funcionários adicionados à área de ponto' });
    } catch (error: unknown) {
        console.error('Add to roster error:', error);
        res.status(400).json({ error: error.message || 'Erro ao adicionar à área de ponto' });
    }
});

// Remove from roster (Admin only)
router.delete('/roster/remove/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        // Check role (Senior Architecture: Policy enforcement in route layer)
        if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
            return res.status(403).json({ error: 'Acesso negado: Somente administradores podem remover da lista de ponto' });
        }

        await AttendanceService.removeFromRoster(req.companyId!, req.params.id);
        res.json({ message: 'Funcionário removido da área de ponto' });
    } catch (error) {
        console.error('Remove from roster error:', error);
        res.status(500).json({ error: 'Erro ao remover da área de ponto' });
    }
});

// Record time (Check-in / Check-out)
router.post('/roster/record/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { type, timestamp } = req.body;
        const date = timestamp ? new Date(timestamp) : new Date();

        const record = await AttendanceService.recordTime(
            req.companyId!,
            req.params.id,
            type as 'checkIn' | 'checkOut',
            date
        );

        res.json(record);
    } catch (error: unknown) {
        console.error('Record time error:', error);
        res.status(400).json({ error: error.message || 'Erro ao registrar tempo' });
    }
});

// Helper function: Calculate IRT (Mozambique Income Tax)
function calculateIRT(income: number): number {
    // Simplified IRT calculation for Mozambique (2024 rates)
    // These are approximate and should be adjusted for actual rates
    if (income <= 42500) return 0;
    if (income <= 100000) return (income - 42500) * 0.10;
    if (income <= 250000) return 5750 + (income - 100000) * 0.15;
    if (income <= 500000) return 28250 + (income - 250000) * 0.20;
    return 78250 + (income - 500000) * 0.25;
}

export default router;
