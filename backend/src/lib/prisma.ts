import { PrismaClient } from '@prisma/client';
import { tenantContext } from './context';
import { logger } from '../utils/logger';

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

                // List of models that HAVE companyId and should be filtered.
                // IMPORTANT: Add new models here whenever a model with companyId is added to the schema.
                const tenantModels = [
                    // Core
                    'User', 'Product', 'Category', 'Warehouse', 'StockMovement',
                    'Customer', 'Supplier', 'Sale', 'PharmacySale', 'Medication',
                    'Employee', 'Transaction', 'Invoice', 'Alert', 'Booking', 'Room',
                    // Stock & logistics
                    'StockTransfer', 'WarehouseStock', 'PriceTier', 'ProductBatch',
                    'PurchaseOrder', 'CreditNote', 'CustomerOrder', 'DocumentSeries',
                    // Restaurant
                    'RestaurantTable', 'RestaurantMenuItem', 'RestaurantOrder', 'RestaurantReservation',
                    // CRM
                    'FunnelStage', 'Opportunity', 'Campaign',
                    // HR
                    'AttendanceRecord', 'PayrollRecord', 'VacationRequest',
                    // Logistics / fleet
                    'Vehicle', 'Driver', 'Delivery', 'Parcel', 'DeliveryRoute',
                    'VehicleMaintenance', 'FuelSupply', 'VehicleIncident',
                    // Pharmacy
                    'Prescription', 'MedicationBatch', 'NarcoticRegister',
                    'PharmacyPartner', 'PartnerInvoice', 'BatchRecall',
                    // Finance & fiscal
                    'TaxConfig', 'TaxRetention', 'FiscalReport', 'FiscalDeadline', 'IvaRate',
                    // Payments & cash
                    'MpesaTransaction', 'CashSession', 'CreditPayment', 'BottleReturn',
                    'LoyaltyTransaction', 'CustomerHistory',
                    // Hospitality
                    'HousekeepingTask',
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

                }

                // Execute the actual query first
                const result = await query(args);

                // Audit AFTER the operation succeeds (fire-and-forget but errors are logged)
                if (tenantModels.includes(model) &&
                    ['create', 'update', 'upsert', 'delete', 'updateMany', 'deleteMany'].includes(operation)) {
                    const auditId = ((args as any).where?.id as string) ||
                        ((args as any).data?.id as string) ||
                        'N/A';

                    basePrisma.auditLog.create({
                        data: {
                            userId: context?.userId,
                            userName: context?.userName || 'Sistema (Autónomo)',
                            action: operation.toUpperCase(),
                            entity: model,
                            entityId: auditId,
                            newData: operation !== 'delete' ? (args as any).data : undefined,
                            companyId
                        }
                    }).catch((auditErr: unknown) => {
                        logger.error('CRITICAL: Audit log creation failed', { error: auditErr, model, operation });
                    });
                }

                return result;
            },
        },
    },
});

export type ExtendedPrismaClient = typeof prisma;


