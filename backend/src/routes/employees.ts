import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
    createEmployeeSchema,
    updateEmployeeSchema,
    recordAttendanceSchema,
    generatePayrollSchema,
    requestVacationSchema,
    approveVacationSchema
} from '../validation';
import { employeesService } from '../services/employees.service';
import { attendanceService } from '../services/attendance.service';
import { payrollService } from '../services/payroll.service';
import { vacationService } from '../services/vacation.service';
import { ApiError } from '../middleware/error.middleware';
import { prisma } from '../lib/prisma';

const router = Router();

// ============================================================================
// Attendance (Generic/Bulk)
// ============================================================================

router.get('/attendance', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');

    const { employeeId, startDate, endDate, month, year, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { employee: { companyId: req.companyId } };
    if (employeeId) where.employeeId = String(employeeId);

    if (startDate && endDate) {
        where.date = { gte: new Date(String(startDate)), lte: new Date(String(endDate)) };
    } else if (month && year) {
        const m = parseInt(String(month));
        const y = parseInt(String(year));
        where.date = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0) };
    }

    const [total, records] = await Promise.all([
        prisma.attendanceRecord.count({ where }),
        prisma.attendanceRecord.findMany({
            where,
            include: { employee: { select: { id: true, name: true, code: true } } },
            orderBy: { date: 'desc' },
            skip,
            take: limitNum
        })
    ]);

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
});

// ============================================================================
// Employees (CRUD)
// ============================================================================

router.get('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await employeesService.list(req.query, req.companyId);
    res.json(result);
});

router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const employee = await employeesService.getById(req.params.id, req.companyId);
    res.json(employee);
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = createEmployeeSchema.parse(req.body);
    const employee = await employeesService.create(validatedData, req.companyId);
    res.status(201).json(employee);
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = updateEmployeeSchema.parse(req.body);
    const employee = await employeesService.update(req.params.id, validatedData, req.companyId);
    res.json(employee);
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    await employeesService.delete(req.params.id, req.companyId);
    res.json({ message: 'Funcionário removido com sucesso' });
});

// ============================================================================
// Attendance (Per Employee)
// ============================================================================

router.post('/:id/attendance', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = recordAttendanceSchema.parse(req.body);
    const { date, checkIn, checkOut, status, notes, justification } = validatedData;
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const employee = await prisma.employee.findFirst({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (!employee) throw ApiError.notFound('Funcionário não encontrado ou acesso negado');

    let hoursWorked = null;
    if (checkIn && checkOut) {
        const start = new Date(`${date.split('T')[0]}T${checkIn}`);
        const end = new Date(`${date.split('T')[0]}T${checkOut}`);
        hoursWorked = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }

    const attendance = await prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: req.params.id, date: attendanceDate } },
        update: {
            checkIn: checkIn ? new Date(`${date.split('T')[0]}T${checkIn}`) : null,
            checkOut: checkOut ? new Date(`${date.split('T')[0]}T${checkOut}`) : null,
            status: status || 'present', hoursWorked, notes, justification
        },
        create: {
            employeeId: req.params.id, date: attendanceDate,
            checkIn: checkIn ? new Date(`${date.split('T')[0]}T${checkIn}`) : null,
            checkOut: checkOut ? new Date(`${date.split('T')[0]}T${checkOut}`) : null,
            status: status || 'present', hoursWorked, notes, justification
        }
    });
    res.json(attendance);
});

router.get('/:id/attendance', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { month, year, page = '1', limit = '31' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const m = parseInt(String(month)) || new Date().getMonth() + 1;
    const y = parseInt(String(year)) || new Date().getFullYear();
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);

    const where: any = {
        employeeId: req.params.id,
        employee: { companyId: req.companyId },
        date: { gte: startDate, lte: endDate }
    };

    const [total, records] = await Promise.all([
        prisma.attendanceRecord.count({ where }),
        prisma.attendanceRecord.findMany({ where, orderBy: { date: 'asc' }, skip, take: limitNum })
    ]);

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
        data: records, summary,
        pagination: {
            page: pageNum, limit: limitNum, total,
            totalPages: Math.ceil(total / limitNum),
            hasMore: skip + records.length < total
        }
    });
});

// ============================================================================
// Payroll
// ============================================================================

router.post('/:id/payroll', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = generatePayrollSchema.parse(req.body);
    const result = await payrollService.upsert(req.params.id, validatedData, req.companyId);
    res.json(result);
});

router.post('/payroll/:payrollId/process', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    await payrollService.process(req.params.payrollId, req.companyId);
    res.json({ message: 'Folha processada com sucesso' });
});

router.post('/payroll/:payrollId/pay', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await payrollService.pay(req.params.payrollId, req.companyId);
    res.json(result);
});

router.get('/payroll/month/:year/:month', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await payrollService.list({ ...req.params, ...req.query }, req.companyId);
    res.json(result);
});

// ============================================================================
// Vacations
// ============================================================================

router.post('/:id/vacations', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = requestVacationSchema.parse(req.body);
    const result = await vacationService.request(req.params.id, validatedData, req.companyId);
    res.status(201).json(result);
});

router.patch('/vacations/:vacationId', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const validatedData = approveVacationSchema.parse(req.body);
    const result = await vacationService.updateStatus(req.params.vacationId, validatedData, req.companyId);
    res.json(result);
});

router.get('/vacations/all', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const result = await vacationService.list(req.query, req.companyId);
    res.json(result);
});

// ============================================================================
// Attendance Roster
// ============================================================================

router.get('/roster', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const roster = await attendanceService.getRoster(req.companyId);
    res.json(roster);
});

router.patch('/roster/add', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { employeeIds, department } = req.body;
    await attendanceService.addToRoster(req.companyId, employeeIds, department);
    res.json({ message: 'Funcionários adicionados à área de ponto' });
});

router.delete('/roster/remove/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        throw ApiError.forbidden('Somente administradores podem remover da lista de ponto');
    }
    await attendanceService.removeFromRoster(req.companyId, req.params.id);
    res.json({ message: 'Funcionário removido da área de ponto' });
});

router.post('/roster/record/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company not identified');
    const { type, timestamp } = req.body;
    const date = timestamp ? new Date(timestamp) : new Date();
    const record = await attendanceService.recordTime(
        req.companyId, req.params.id, type as 'checkIn' | 'checkOut', date
    );
    res.json(record);
});

export default router;
