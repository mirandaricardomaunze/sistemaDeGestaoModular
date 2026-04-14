import { prisma } from '../lib/prisma';

export interface AuditLogParams {
    userId?: string;
    userName?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldData?: any;
    newData?: any;
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
                    oldData: params.oldData,
                    newData: params.newData,
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

    async list(params: { companyId: string, page?: number, limit?: number, action?: string, entity?: string }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = { companyId: params.companyId };
        if (params.action) where.action = params.action;
        if (params.entity) where.entity = params.entity;

        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: { user: { select: { name: true, email: true } } }
            })
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
