import { PrismaClient } from '@prisma/client';
import { tenantContext } from './context';
import { logger } from '../utils/logger';
import { auditQueue, AUDIT_JOB_OPTIONS } from '../queues/auditQueue';

// ── P5 Performance Fix ───────────────────────────────────────────────────────
// O basePrisma usado aqui é independente do prismaBase.ts.
// O prismaBase.ts é usado APENAS pelo auditWorker para evitar recursão.
// Este basePrisma (abaixo) é o cliente que alimenta a extensão de tenant.
const basePrisma = new PrismaClient();

// Shape of args common to Prisma operations we touch in the extension below.
// Each field is optional because not every operation passes every key.
type TenantArgs = {
    where?: Record<string, unknown> & { id?: string; companyId?: string };
    data?: Record<string, unknown> & { id?: string } | Array<Record<string, unknown>>;
};

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
                    'StockTransfer', 'StockReservation', 'PriceTier', 'ProductBatch', 'WarehouseStock',
                    'PurchaseOrder', 'SupplierInvoice', 'CreditNote', 'DebitNote', 'CustomerOrder', 'OrderCancellationRequest', 'DocumentSeries',
                    // Restaurant
                    'RestaurantTable', 'RestaurantMenuItem', 'RestaurantOrder', 'RestaurantReservation',
                    // CRM
                    'FunnelStage', 'Opportunity', 'Campaign', 'Interaction',
                    // HR
                    'AttendanceRecord', 'PayrollRecord', 'VacationRequest', 'AcademicQualification',
                    'CommissionRule',
                    // Accounting
                    'Account', 'JournalEntry', 'PhysicalInventory',
                    // Logistics / fleet
                    'Vehicle', 'Driver', 'Delivery', 'Parcel', 'DeliveryRoute',
                    'VehicleMaintenance', 'FuelSupply', 'VehicleIncident',
                    // Pharmacy
                    'Prescription', 'MedicationBatch', 'NarcoticRegister',
                    'PharmacyPartner', 'PartnerInvoice', 'BatchRecall', 'DrugInteraction',
                    'PharmacyDashboardCache',
                    // Finance & fiscal
                    'TaxConfig', 'TaxRetention', 'FiscalReport', 'FiscalDeadline', 'IvaRate',
                    'IRPSBracket',
                    // Payments & cash
                    'MpesaTransaction', 'CashSession', 'CreditPayment', 'BottleReturn',
                    'LoyaltyTransaction', 'CustomerHistory',
                    // Hospitality
                    'HousekeepingTask', 'BookingConsumption',
                    // Config & audit (company-scoped)
                    'AlertConfig', 'AuditLog', 'SalesTarget',
                    // Approvals workflow (generic request/approve flow shared by every module)
                    'ApprovalRequest',
                ];

                const tArgs = args as TenantArgs;
                if (tenantModels.includes(model)) {
                    // For read operations
                    if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
                        tArgs.where = { ...tArgs.where, companyId };
                    }
                    // For mutations
                    if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
                        tArgs.where = { ...tArgs.where, companyId };
                    }
                    // For create
                    if (operation === 'create' || operation === 'createMany') {
                        if (Array.isArray(tArgs.data)) {
                            tArgs.data = tArgs.data.map((d) => ({ ...d, companyId }));
                        } else {
                            tArgs.data = { ...(tArgs.data as Record<string, unknown> | undefined), companyId };
                        }
                    }
                }

                // Execute the actual query first
                const result = await query(args);

                // ── P5: Audit AFTER the operation succeeds ───────────────────
                // Enfileira via BullMQ (Redis) em vez de escrever directamente.
                // Benefício: sem N+1 em bulk ops, rate-limited a 50 writes/s,
                //            não bloqueia o request mesmo em carga elevada.
                // Fallback: se Redis não disponível (auditQueue = null), escreve
                //           directamente como antes — nunca perde audit logs.
                if (tenantModels.includes(model) &&
                    ['create', 'update', 'upsert', 'delete', 'updateMany', 'deleteMany'].includes(operation)) {
                    const dataObj = Array.isArray(tArgs.data) ? undefined : tArgs.data;
                    const auditId = tArgs.where?.id || dataObj?.id || 'N/A';

                    const auditPayload = {
                        userId: context?.userId,
                        userName: context?.userName || 'Sistema (Autónomo)',
                        action: operation.toUpperCase(),
                        entity: model,
                        entityId: auditId,
                        newData: operation !== 'delete' ? (tArgs.data as object | undefined) : undefined,
                        companyId,
                    };

                    if (auditQueue) {
                        // Redis disponível → enfileirar (async, rate-limited)
                        auditQueue.add('write', auditPayload, AUDIT_JOB_OPTIONS).catch((err: unknown) => {
                            logger.error('CRITICAL: Failed to enqueue audit log', { error: err, model, operation });
                        });
                    } else {
                        // Fallback → escrita directa (comportamento anterior)
                        basePrisma.auditLog.create({ data: auditPayload }).catch((auditErr: unknown) => {
                            logger.error('CRITICAL: Audit log creation failed', { error: auditErr, model, operation });
                        });
                    }
                }

                return result;
            },
        },
    },
});

export type ExtendedPrismaClient = typeof prisma;
