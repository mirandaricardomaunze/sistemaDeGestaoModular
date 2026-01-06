import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from './auth';

/**
 * Manually log an audit entry
 */
export const logAudit = async (params: {
    userId?: string;
    userName?: string;
    action: string;
    entity: string;
    entityId?: string;
    oldData?: Record<string, unknown>;  // ✅ Fixed: was 'any'
    newData?: Record<string, unknown>;  // ✅ Fixed: was 'any'
    ipAddress?: string;
    userAgent?: string;
}) => {
    try {
        // Fetch user name if not provided but userId exists
        let userName = params.userName;
        if (!userName && params.userId) {
            const user = await prisma.user.findUnique({
                where: { id: params.userId },
                select: { name: true }
            });
            userName = user?.name || 'Sistema';
        }

        await prisma.auditLog.create({
            data: {
                userId: params.userId,
                userName: userName || 'Anônimo',
                action: params.action,
                entity: params.entity,
                entityId: params.entityId,
                oldData: params.oldData ? JSON.parse(JSON.stringify(params.oldData)) : null,
                newData: params.newData ? JSON.parse(JSON.stringify(params.newData)) : null,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
            }
        });
    } catch (error) {
        console.error('Audit log creation failed:', error);
    }
};

/**
 * Middleware for automatic auditing of successful mutations
 */
export const auditMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    // We only care about mutations: POST, PUT, DELETE, PATCH
    const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];

    if (methods.includes(req.method)) {
        // Use 'finish' event to log after the response has been sent
        res.on('finish', () => {
            // Only log if the request was successful
            if (res.statusCode >= 200 && res.statusCode < 300) {
                // Determine entity from the first part of the URL (e.g., /api/products -> products)
                const pathParts = req.baseUrl.replace('/api/', '').split('/');
                const entity = pathParts[0] || 'unknown';

                // Determine action
                let action = req.method;
                if (req.method === 'POST') action = 'CREATE';
                if (req.method === 'PUT' || req.method === 'PATCH') action = 'UPDATE';
                if (req.method === 'DELETE') action = 'DELETE';

                // Skip auth/login logs to avoid duplicate or noise (they have their own logic usually)
                if (entity === 'auth' && (req.path === '/login' || req.path === '/register')) return;

                // Prepare data
                const entityId = req.params.id || (res as any).entityId; // Some routes might set entityId on res

                // Filter out sensitive data from req.body if it's an update/create
                const body = { ...req.body };
                const sensitiveFields = ['password', 'token', 'secret', 'creditCard'];
                sensitiveFields.forEach(field => delete body[field]);

                logAudit({
                    userId: req.userId,
                    action,
                    entity,
                    entityId,
                    newData: req.method !== 'DELETE' ? body : undefined,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent']
                });
            }
        });
    }

    next();
};
