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
                        args.where = { ...args.where, companyId };
                    }
                    // For mutations (ensure we don't accidentally update/delete other company's data)
                    if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
                        args.where = { ...args.where, companyId };
                    }
                    // For create (ensure companyId is set)
                    if (operation === 'create' || operation === 'createMany') {
                        if (Array.isArray(args.data)) {
                            args.data = args.data.map((d: Record<string, unknown>) => ({ ...d, companyId }));
                        } else {
                            args.data = { ...args.data, companyId };
                        }
                    }

                    // ðŸ“ Auto-Audit Interceptor for Mutations
                    if (['create', 'update', 'upsert', 'delete', 'updateMany', 'deleteMany'].includes(operation)) {
                        const auditData = {
                            userId: context?.userId,
                            userName: 'Sistema (Automado)', // In a real app, you'd fetch this or pass it in context
                            action: operation.toUpperCase(),
                            entity: model,
                            entityId: (args.where?.id as string) || (args.data?.id as string) || 'N/A',
                            newData: operation !== 'delete' ? args.data : undefined,
                            companyId
                        };

                        // Use the base client to avoid infinite loops and context issues
                        // We do this asynchronously to not block the main query
                        basePrisma.auditLog.create({ data: auditData }).catch(err => {
                            console.error('Audit Log Error:', err);
                        });
                    }
                }

                return query(args);
            },
        },
    },
});


