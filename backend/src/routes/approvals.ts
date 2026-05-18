import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/error.middleware';
import { approvalsService } from '../services/approvalsService';
import {
    createApprovalRequestSchema,
    decideApprovalRequestSchema,
    listApprovalRequestsSchema,
} from '../validation/approvals';

const router = Router();
router.use(authenticate);

const STAFF_ROLES = ['super_admin', 'admin', 'manager', 'operator'] as const;
const DECISION_ROLES = ['super_admin', 'admin', 'manager'] as const;

function requireCompany(req: AuthRequest): { companyId: string; userId: string } {
    if (!req.companyId) throw ApiError.badRequest('Empresa não identificada.');
    if (!req.userId) throw ApiError.unauthorized();
    return { companyId: req.companyId, userId: req.userId };
}

router.get('/', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    const { companyId } = requireCompany(req);
    const params = listApprovalRequestsSchema.parse(req.query);
    res.json(await approvalsService.list(companyId, params));
});

router.get('/:id', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    const { companyId } = requireCompany(req);
    res.json(await approvalsService.getById(companyId, req.params.id));
});

router.post('/', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    const { companyId, userId } = requireCompany(req);
    const data = createApprovalRequestSchema.parse(req.body);
    res.status(201).json(await approvalsService.create(companyId, userId, req.userName, data));
});

router.post('/:id/approve', authorize(...DECISION_ROLES), async (req: AuthRequest, res) => {
    const { companyId, userId } = requireCompany(req);
    const data = decideApprovalRequestSchema.parse(req.body);
    res.json(await approvalsService.approve(companyId, req.params.id, {
        userId,
        userName: req.userName,
        role: req.userRole ?? 'manager',
    }, data));
});

router.post('/:id/reject', authorize(...DECISION_ROLES), async (req: AuthRequest, res) => {
    const { companyId, userId } = requireCompany(req);
    const data = decideApprovalRequestSchema.parse(req.body);
    res.json(await approvalsService.reject(companyId, req.params.id, {
        userId,
        userName: req.userName,
        role: req.userRole ?? 'manager',
    }, data));
});

router.post('/:id/cancel', authorize(...STAFF_ROLES), async (req: AuthRequest, res) => {
    const { companyId, userId } = requireCompany(req);
    res.json(await approvalsService.cancel(companyId, req.params.id, userId));
});

export default router;
