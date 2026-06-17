import { tenantContext } from './context';
import { logger } from '../utils/logger';
import { auditQueue, AUDIT_JOB_OPTIONS } from '../queues/auditQueue';
import { basePrisma } from './prismaBase';

// Single PrismaClient instance shared between the tenant-extended `prisma`
// (used by routes/services) and the audit worker. Avoids exhausting the
// Supabase pool with duplicate connection pools.

// Shape of args common to Prisma operations we touch in the extension below.
// Each field is optional because not every operation passes every key.
type TenantArgs = {
    where?: Record<string, unknown> & { id?: string; companyId?: string };
    data?: Record<string, unknown> & { id?: string } | Array<Record<string, unknown>>;
};

// Models for which we capture the previous row (oldData) before an update/delete.
// Restricted to entities where "what changed" is auditable: fiscal documents,
// stock, pricing, customers/suppliers, fiscal config, employees, approvals.
// Excludes high-throughput caches/logs (StockMovement, AuditLog, dashboard caches)
// to avoid doubling DB load on writes.
const OLD_DATA_MODELS = new Set<string>([
    'Product', 'Sale', 'Invoice', 'CreditNote', 'DebitNote',
    'Customer', 'Supplier', 'Employee', 'CustomerOrder', 'PurchaseOrder',
    'SupplierInvoice', 'CompanySettings', 'CompanyModule', 'User',
    'PayrollRecord', 'ApprovalRequest', 'OrderCancellationRequest',
    'TaxConfig', 'IvaRate', 'IRPSBracket', 'DocumentSeries',
    'Warehouse', 'PriceTier', 'CommissionRule',
]);

// Map PascalCase model name → camelCase Prisma client accessor (e.g. CompanyModule → companyModule).
function modelAccessor(model: string): string {
    return model.charAt(0).toLowerCase() + model.slice(1);
}

// Fetch the existing row before an update/delete so the audit log can carry
// `oldData`. Returns null on any failure — never blocks the main mutation.
type FindUniqueClient = {
    findUnique?: (args: { where: { id: string } }) => Promise<unknown>;
};
async function fetchOldData(model: string, id: string): Promise<unknown> {
    if (!OLD_DATA_MODELS.has(model)) return null;
    try {
        const accessor = (basePrisma as unknown as Record<string, FindUniqueClient>)[modelAccessor(model)];
        if (!accessor?.findUnique) return null;
        return await accessor.findUnique({ where: { id } });
    } catch (err) {
        logger.warn('Failed to capture oldData for audit', { model, id, err });
        return null;
    }
}

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
                    'CompanyModule', 'CompanySettings', 'CalendarEvent',
                    // Stock & logistics
                    'StockTransfer', 'StockReservation', 'PriceTier', 'ProductBatch', 'WarehouseStock',
                    'PurchaseOrder', 'SupplierInvoice', 'CreditNote', 'DebitNote', 'CustomerOrder', 'OrderCancellationRequest', 'DocumentSeries', 'DocumentSeriesReservation',
                    // Restaurant
                    'RestaurantTable', 'RestaurantMenuItem', 'RestaurantOrder', 'RestaurantReservation',
                    // CRM
                    'FunnelStage', 'Opportunity', 'Campaign',
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
                    'CustomerHistory',
                    // Hospitality
                    'HousekeepingTask', 'BookingConsumption',
                    // Config & audit (company-scoped)
                    'AlertConfig', 'AuditLog', 'NotificationPreference', 'SalesTarget',
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

                // ── P5: Capture `oldData` for update/delete on critical models ──
                // Runs BEFORE the mutation so we record the row in its pre-change
                // state. Only fires for the allowlist (OLD_DATA_MODELS) and only
                // when we can target a single id — `updateMany`/`deleteMany` are
                // skipped to avoid fetching unbounded result sets.
                let oldData: object | undefined;
                const singleIdMutation =
                    tenantModels.includes(model)
                    && ['update', 'delete'].includes(operation)
                    && typeof tArgs.where?.id === 'string';
                if (singleIdMutation) {
                    const fetched = await fetchOldData(model, tArgs.where!.id as string);
                    // JSON round-trip normalises Prisma Decimal/Date into plain JSON.
                    oldData = fetched ? JSON.parse(JSON.stringify(fetched)) : undefined;
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
                        oldData,
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
                        if (process.env.NODE_ENV === 'test') {
                            // Em ambiente de teste, aguardamos a criação do log de auditoria para evitar concorrência e vazamento de conexões
                            await basePrisma.auditLog.create({ data: auditPayload }).catch((auditErr: unknown) => {
                                logger.error('CRITICAL: Audit log creation failed in test', { error: auditErr, model, operation });
                            });
                        } else {
                            basePrisma.auditLog.create({ data: auditPayload }).catch((auditErr: unknown) => {
                                logger.error('CRITICAL: Audit log creation failed', { error: auditErr, model, operation });
                            });
                        }
                    }
                }

                return result;
            },
        },
    },
});

export type ExtendedPrismaClient = typeof prisma;
