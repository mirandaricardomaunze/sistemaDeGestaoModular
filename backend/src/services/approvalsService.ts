import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { Result, ResultHandler } from '../utils/result';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import type {
    CreateApprovalRequestInput,
    DecideApprovalRequestInput,
    ListApprovalRequestsInput,
} from '../validation/approvals';
import { emitToModule } from '../lib/socket';

type ApprovalRequestRow = Prisma.ApprovalRequestGetPayload<Record<string, never>>;
type ApprovalListResult = ReturnType<typeof createPaginatedResponse<ApprovalRequestRow>>;

// Roles authorised to approve/reject. Kept explicit to make the policy auditable.
const DECISION_ROLES = new Set(['super_admin', 'admin', 'manager']);

export interface DecisionContext {
    userId: string;
    userName?: string;
    role: string;
}

export class ApprovalsService {
    async create(
        companyId: string,
        userId: string,
        userName: string | undefined,
        data: CreateApprovalRequestInput,
    ): Promise<Result<ApprovalRequestRow>> {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada.');
        if (!userId) throw ApiError.unauthorized();

        const created = await prisma.approvalRequest.create({
            data: {
                companyId,
                requestType: data.requestType,
                resourceType: data.resourceType ?? null,
                resourceId: data.resourceId ?? null,
                amount: data.amount ?? null,
                reason: data.reason,
                payload: (data.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
                expiresAt: data.expiresAt ?? null,
                requestedByUserId: userId,
                requestedByName: userName ?? null,
            },
        });

        emitToModule(companyId, 'approvals', 'approvals:created', {
            id: created.id,
            requestType: created.requestType,
            amount: created.amount,
            requestedBy: created.requestedByName,
            timestamp: created.createdAt,
        });

        return ResultHandler.success(created, 'Pedido de aprovação registado');
    }

    async list(
        companyId: string,
        params: ListApprovalRequestsInput,
    ): Promise<Result<ApprovalListResult>> {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada.');
        const { page, limit, skip } = getPaginationParams(params);

        const where: Prisma.ApprovalRequestWhereInput = { companyId };
        if (params.status) where.status = params.status as Prisma.ApprovalRequestWhereInput['status'];
        if (params.requestType) where.requestType = params.requestType as Prisma.ApprovalRequestWhereInput['requestType'];

        const [total, items] = await Promise.all([
            prisma.approvalRequest.count({ where }),
            prisma.approvalRequest.findMany({
                where,
                orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
                skip,
                take: limit,
            }),
        ]);

        return ResultHandler.success(createPaginatedResponse(items, page, limit, total));
    }

    async getById(companyId: string, id: string): Promise<Result<ApprovalRequestRow>> {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada.');
        const item = await prisma.approvalRequest.findFirst({
            where: { id, companyId },
        });
        if (!item) throw ApiError.notFound('Pedido de aprovação não encontrado');
        return ResultHandler.success(item);
    }

    async approve(
        companyId: string,
        id: string,
        ctx: DecisionContext,
        data: DecideApprovalRequestInput,
    ): Promise<Result<ApprovalRequestRow>> {
        return this.decide(companyId, id, 'approved', ctx, data);
    }

    async reject(
        companyId: string,
        id: string,
        ctx: DecisionContext,
        data: DecideApprovalRequestInput,
    ): Promise<Result<ApprovalRequestRow>> {
        return this.decide(companyId, id, 'rejected', ctx, data);
    }

    async cancel(companyId: string, id: string, requesterUserId: string): Promise<Result<ApprovalRequestRow>> {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada.');
        const existing = await prisma.approvalRequest.findFirst({ where: { id, companyId } });
        if (!existing) throw ApiError.notFound('Pedido de aprovação não encontrado');
        if (existing.status !== 'pending') {
            throw ApiError.badRequest('Apenas pedidos pendentes podem ser cancelados');
        }
        if (existing.requestedByUserId !== requesterUserId) {
            throw ApiError.forbidden('Apenas o autor pode cancelar este pedido');
        }

        const updated = await prisma.approvalRequest.update({
            where: { id },
            data: { status: 'cancelled' },
        });

        emitToModule(companyId, 'approvals', 'approvals:cancelled', { id });
        return ResultHandler.success(updated, 'Pedido cancelado');
    }

    private async decide(
        companyId: string,
        id: string,
        status: 'approved' | 'rejected',
        ctx: DecisionContext,
        data: DecideApprovalRequestInput,
    ): Promise<Result<ApprovalRequestRow>> {
        if (!companyId) throw ApiError.badRequest('Empresa não identificada.');
        if (!DECISION_ROLES.has(ctx.role)) {
            throw ApiError.forbidden('Apenas gestores podem aprovar ou rejeitar');
        }

        const existing = await prisma.approvalRequest.findFirst({
            where: { id, companyId },
        });
        if (!existing) throw ApiError.notFound('Pedido de aprovação não encontrado');
        if (existing.status !== 'pending') {
            throw ApiError.badRequest(`Pedido já foi ${existing.status}`);
        }
        if (existing.requestedByUserId === ctx.userId) {
            throw ApiError.forbidden('Não pode decidir o seu próprio pedido');
        }
        if (existing.expiresAt && existing.expiresAt < new Date()) {
            await prisma.approvalRequest.update({
                where: { id },
                data: { status: 'expired' },
            });
            throw ApiError.badRequest('Pedido expirou');
        }

        const updated = await prisma.approvalRequest.update({
            where: { id },
            data: {
                status,
                decidedByUserId: ctx.userId,
                decidedByName: ctx.userName ?? null,
                decidedAt: new Date(),
                decisionNotes: data.decisionNotes ?? null,
            },
        });

        emitToModule(companyId, 'approvals', `approvals:${status}`, {
            id: updated.id,
            requestType: updated.requestType,
            decidedBy: updated.decidedByName,
            timestamp: updated.decidedAt,
        });

        return ResultHandler.success(updated, status === 'approved' ? 'Pedido aprovado' : 'Pedido rejeitado');
    }

    // Mark a previously-approved request as consumed once the linked action
    // is finalized — prevents the same approval being reused (e.g. discount
    // applied to a different sale).
    async markConsumed(id: string, companyId: string): Promise<void> {
        await prisma.approvalRequest.updateMany({
            where: { id, companyId, status: 'approved' },
            data: { status: 'cancelled', decisionNotes: 'consumed' },
        });
    }

    async findApprovedFor(
        companyId: string,
        requestType: string,
        resourceType: string,
        resourceId: string,
    ): Promise<{ id: string; amount: number | null; payload: unknown } | null> {
        const item = await prisma.approvalRequest.findFirst({
            where: {
                companyId,
                requestType: requestType as Prisma.ApprovalRequestWhereInput['requestType'],
                resourceType,
                resourceId,
                status: 'approved',
            },
            orderBy: { decidedAt: 'desc' },
            select: { id: true, amount: true, payload: true },
        });
        if (!item) return null;
        return {
            id: item.id,
            amount: item.amount === null ? null : Number(item.amount),
            payload: item.payload,
        };
    }
}

export const approvalsService = new ApprovalsService();
