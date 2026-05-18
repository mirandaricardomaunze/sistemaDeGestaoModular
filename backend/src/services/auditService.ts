import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { parseFields } from '../utils/pagination';

const AUDIT_FIELD_ALLOWLIST = [
    'id', 'userId', 'userName', 'action', 'entity', 'entityId',
    'ipAddress', 'createdAt',
    'user.name', 'user.email'
] as const;

export interface AuditLogParams {
    userId?: string;
    userName?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldData?: Prisma.InputJsonValue | unknown;
    newData?: Prisma.InputJsonValue | unknown;
    ipAddress?: string;
    userAgent?: string;
    companyId?: string;
}

export class AuditService {
    async log(params: AuditLogParams) {
        try {
            return await prisma.auditLog.create({
                data: {
                    userId: params.userId,
                    userName: params.userName,
                    action: params.action,
                    entity: params.entity,
                    entityId: params.entityId,
                    oldData: params.oldData as Prisma.InputJsonValue | undefined,
                    newData: params.newData as Prisma.InputJsonValue | undefined,
                    ipAddress: params.ipAddress,
                    userAgent: params.userAgent,
                    companyId: params.companyId,
                }
            });
        } catch (error) {
            console.error('Failed to create audit log:', error);
            // We don't throw here to avoid breaking the main business flow
        }
    }

    async list(params: { companyId: string, page?: number, limit?: number, action?: string, entity?: string, fields?: string }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;

        const where: Prisma.AuditLogWhereInput = { companyId: params.companyId };
        if (params.action) where.action = params.action;
        if (params.entity) where.entity = params.entity;

        const projection = parseFields(params.fields, AUDIT_FIELD_ALLOWLIST);
        const baseArgs = {
            where,
            orderBy: { createdAt: 'desc' as const },
            skip,
            take: limit,
        };
        const findArgs: Prisma.AuditLogFindManyArgs = projection
            ? { ...baseArgs, select: projection as Prisma.AuditLogSelect }
            : { ...baseArgs, include: { user: { select: { name: true, email: true } } } };

        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany(findArgs)
        ]);

        return {
            data: logs,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}

export const auditService = new AuditService();
