import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import {
    createEmployeeSchema,
    updateEmployeeSchema,
    recordAttendanceSchema,
    requestVacationSchema,
    approveVacationSchema
} from '../validation';
import { employeesService } from '../services/employeesService';
import { attendanceService } from '../services/attendanceService';
import { payrollService } from '../services/payrollService';
import { vacationService } from '../services/vacationService';
import { prisma } from '../lib/prisma';
import { ResultHandler } from '../utils/result';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/error.middleware';
import { emitToCompany } from '../lib/socket';

const router = Router();

// ============================================================================
// Attendance Roster
// ============================================================================

router.get('/roster', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await attendanceService.getRoster(req.companyId);
    res.json(result);
});

router.patch('/roster/add', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { employeeIds, department } = req.body;
    const result = await attendanceService.addToRoster(req.companyId, employeeIds, department);
    res.json(result);
});

router.delete('/roster/remove/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await attendanceService.removeFromRoster(req.companyId, req.params.id);
    res.json(result);
});

router.post('/roster/record/:id', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { type, timestamp } = req.body;
    if (!type || !['checkIn', 'checkOut'].includes(type)) {
        throw ApiError.badRequest('Tipo de registo inválido. Use "checkIn" para entrada ou "checkOut" para saída.');
    }
    const date = timestamp ? new Date(timestamp) : new Date();
    const result = await attendanceService.recordTime(req.companyId, req.params.id, type, date);
    res.json(result);
});

// ============================================================================
// Attendance (Generic/Bulk)
// ============================================================================

router.get('/attendance', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');

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

    const response = {
        data: records,
        summary,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
            hasMore: skip + records.length < total
        }
    };
    res.json(ResultHandler.success(response));
});

// Bulk attendance record via POST /attendance (for roster-based flow)
router.post('/attendance', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { employeeId, date, checkIn, checkOut, status, notes } = req.body;
    
    // Use service for consistency
    const result = await attendanceService.recordTime(
        req.companyId, 
        employeeId, 
        checkIn ? 'checkIn' : 'checkOut', 
        new Date(date)
    );
    res.json(result);
});

// ============================================================================
// Commission Rules
// ============================================================================

router.get('/commissions/rules', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const rules = await prisma.commissionRule.findMany({
        where: { companyId: req.companyId },
        include: {
            employee: { select: { id: true, name: true, code: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    res.json(ResultHandler.success(rules));
});

router.post('/commissions/rules', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { employeeId, role, type, rate, tiers, isActive } = req.body;

    if (!type) throw ApiError.badRequest('O tipo de comissão é obrigatório.');

    // Upsert by employeeId (unique) or create new role-based rule
    if (employeeId) {
        const rule = await prisma.commissionRule.upsert({
            where: { employeeId },
            update: { type, rate, tiers, isActive: isActive ?? true, companyId: req.companyId },
            create: { employeeId, type, rate, tiers, isActive: isActive ?? true, companyId: req.companyId }
        });
        return res.json(ResultHandler.success(rule, 'Regra de comissão atualizada'));
    }

    const rule = await prisma.commissionRule.create({
        data: { role, type, rate, tiers, isActive: isActive ?? true, companyId: req.companyId }
    });
    res.status(201).json(ResultHandler.success(rule, 'Regra de comissão criada'));
});

router.put('/commissions/rules/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const existing = await prisma.commissionRule.findFirst({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (!existing) throw ApiError.notFound('Regra de comissão não encontrada');

    const { type, rate, tiers, isActive } = req.body;
    const rule = await prisma.commissionRule.update({
        where: { id: req.params.id },
        data: { type, rate, tiers, isActive }
    });
    res.json(rule);
});

router.delete('/commissions/rules/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const existing = await prisma.commissionRule.findFirst({
        where: { id: req.params.id, companyId: req.companyId }
    });
    if (!existing) throw ApiError.notFound('Regra de comissão não encontrada');

    await prisma.commissionRule.delete({ where: { id: req.params.id } });
    res.json(ResultHandler.success(null, 'Regra de comissão removida com sucesso'));
});

// ============================================================================
// Payroll
// ============================================================================

router.get('/payroll', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await payrollService.list({ ...req.query }, req.companyId);
    res.json(result);
});

router.post('/payroll', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { employeeId, ...rest } = req.body;
    if (!employeeId) throw ApiError.badRequest('O ID do funcionário é obrigatório.');
    const result = await payrollService.upsert(employeeId, rest, req.companyId);
    res.json(result);
});

router.put('/payroll/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await payrollService.update(req.params.id, req.body, req.companyId);
    res.json(result);
});

router.post('/payroll/:id/process', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await payrollService.process(req.params.id, req.companyId);
    res.json(result);
});

router.post('/payroll/:id/mark-paid', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await payrollService.pay(req.params.id, req.companyId);
    res.json(result);
});

router.post('/payroll/:id/audit', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const { action, userId, userName, details } = req.body;
    if (!action) throw ApiError.badRequest('A ação de auditoria é obrigatória.');
    // Log audit entry via audit_logs
    const payroll = await prisma.payrollRecord.findFirst({
        where: { id: req.params.id, employee: { companyId: req.companyId } }
    });
    if (!payroll) throw ApiError.notFound('Folha de pagamento não encontrada');

    await prisma.auditLog.create({
        data: {
            action,
            entity: 'PayrollRecord',
            entityId: req.params.id,
            userId: userId || req.userId,
            companyId: req.companyId,
            newData: details ? { details, userName } : { userName }
        }
    });
    res.json({ message: 'Auditoria registada com sucesso' });
});

// ============================================================================
// Vacations
// ============================================================================

router.get('/vacations', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await vacationService.list(req.query, req.companyId);
    res.json(result);
});

router.post('/vacations', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = requestVacationSchema.parse(req.body);
    const { employeeId } = req.body;
    if (!employeeId) throw ApiError.badRequest('O ID do funcionário é obrigatório.');
    const result = await vacationService.request(employeeId, validatedData, req.companyId);
    res.status(201).json(result);
});

router.put('/vacations/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = approveVacationSchema.parse(req.body);
    const result = await vacationService.updateStatus(req.params.id, validatedData, req.companyId);
    res.json(result);
});

// ============================================================================
// Employees CRUD
// ============================================================================

router.get('/', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await employeesService.list(req.query, req.companyId);
    res.json(result);
});

router.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = createEmployeeSchema.parse(req.body);
    const result = await employeesService.create(validatedData, req.companyId);

    if (result.success && result.data) {
        emitToCompany(req.companyId, 'hr:new_employee', {
            id: result.data.id,
            name: result.data.name,
            department: (result.data as any).department,
            timestamp: new Date()
        });
    }

    res.status(201).json(result);
});

router.get('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const employee = await employeesService.getById(req.params.id, req.companyId);
    res.json(employee);
});

router.put('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const validatedData = updateEmployeeSchema.parse(req.body);
    const employee = await employeesService.update(req.params.id, validatedData, req.companyId);
    res.json(employee);
});

router.delete('/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await employeesService.delete(req.params.id, req.companyId);
    res.json(result);
});

// ============================================================================
// Per-Employee: Attendance
// ============================================================================

router.post('/:id/attendance', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
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
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
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

router.get('/:id/payroll-history', authenticate, async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada. Faça login novamente.');
    const result = await payrollService.list({ employeeId: req.params.id }, req.companyId);
    res.json(result.data);
});

export default router;
