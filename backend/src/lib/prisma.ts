import { PrismaClient } from '@prisma/client';
import { tenantContext } from './context';

const basePrisma = new PrismaClient();

export const prisma = basePrisma.$extends({
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                const context = tenantContext.getStore();
                const companyId = context?.companyId;

                // Skip filtering if no companyId in context (e.g., during login)
                // or if the model doesn't have companyId (need to be careful here)
                if (!companyId) {
                    return query(args);
                }

                // List of models that HAVE companyId and should be filtered
                const tenantModels = [
                    'User', 'Product', 'Category', 'Warehouse', 'StockMovement',
                    'Customer', 'Supplier', 'Sale', 'PharmacySale', 'Medication',
                    'Employee', 'Transaction', 'Invoice', 'Alert', 'Booking', 'Room'
                ];

                if (tenantModels.includes(model)) {
                    // For read operations
                    if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
                        (args as any).where = { ...(args as any).where, companyId };
                    }
                    // For mutations
                    if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
                        (args as any).where = { ...(args as any).where, companyId };
                    }
                    // For create
                    if (operation === 'create' || operation === 'createMany') {
                        if (Array.isArray((args as any).data)) {
                            (args as any).data = (args as any).data.map((d: Record<string, unknown>) => ({ ...d, companyId }));
                        } else {
                            (args as any).data = { ...(args as any).data, companyId };
                        }
                    }

                    // Audit logic ...
                    if (['create', 'update', 'upsert', 'delete', 'updateMany', 'deleteMany'].includes(operation)) {
                        try {
                            const auditId = ((args as any).where?.id as string) ||
                                ((args as any).data?.id as string) ||
                                'N/A';

                            const auditData = {
                                userId: context?.userId,
                                userName: context?.userName || 'Sistema (Autónomo)',
                                action: operation.toUpperCase(),
                                entity: model,
                                entityId: auditId,
                                newData: operation !== 'delete' ? (args as any).data : undefined,
                                companyId
                            };

                            basePrisma.auditLog.create({ data: auditData }).catch(err => {
                                console.error('Audit Log Sync Error:', err.message);
                            });
                        } catch (auditErr) {
                            console.error('Audit Log Preparation Error:', auditErr);
                        }
                    }
                }

                // Global Security: Always omit sensitive fields from User unless explicitly requested

                // Note: We stick to manual sanitizeUser to avoid breaking complex queries (like includes).


                return query(args);
            },
        },
    },
});

export type ExtendedPrismaClient = typeof prisma;


