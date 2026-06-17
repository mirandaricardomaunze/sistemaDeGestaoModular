import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { ResultHandler } from '../../utils/result';
import { getPaginationParams, createPaginatedResponse, parseFields } from '../../utils/pagination';
import { generateDeliveryNumber, generateRouteCode, generateTrackingNumber } from './shared';
import { warehousesService } from '../warehousesService';
import type { StockTransactionClient } from '../stockService';
import { emitToModule } from '../../lib/socket';

/** Actor performing a logistics action (for transfer approval/movements). */
type Actor = { userId?: string; userName?: string };

/** StockTransfer states that are terminal (no further stock impact). */
const TERMINAL_TRANSFER_STATES = ['received', 'completed', 'rejected', 'cancelled'];

const DELIVERY_FIELDS = [
    'id', 'number', 'status', 'priority', 'scheduledDate',
    'completedAt', 'totalAmount', 'driverId', 'vehicleId',
    'routeId', 'createdAt'
] as const;

const DEFAULT_LIMIT = 20;

type ListQuery = {
    page?: string | number;
    limit?: string | number;
    fields?: string;
    search?: string;
    active?: string | boolean;
    status?: string;
    priority?: string;
    driverId?: string;
    vehicleId?: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
};

type RouteInput = {
    name: string;
    code?: string;
    origin: string;
    destination: string;
    distanceKm?: number;
    estimatedDurationMin?: number;
    notes?: string | null;
    isActive?: boolean;
};

type DeliveryItemInput = {
    productId?: string | null;
    description: string;
    quantity: number;
    unitPrice?: number;
    weight?: number;
};

type DeliveryInput = {
    routeId?: string | null;
    driverId?: string | null;
    vehicleId?: string | null;
    customerId?: string | null;
    recipientName: string;
    recipientPhone?: string | null;
    recipientAddress?: string | null;
    deliveryAddress?: string;
    status?: string;
    priority?: string;
    scheduledDate?: string | Date | null;
    shippingCost?: number;
    totalAmount?: number;
    notes?: string | null;
    items?: DeliveryItemInput[];
    // ── Guia de transferência entre armazéns (kind = 'warehouse_transfer') ──
    kind?: 'shipment' | 'warehouse_transfer';
    sourceWarehouseId?: string | null;
    targetWarehouseId?: string | null;
    reason?: string | null;
};

type ParcelInput = {
    senderName: string;
    senderPhone?: string | null;
    recipientName: string;
    recipientPhone?: string | null;
    description?: string | null;
    weight?: number;
    fees?: number;
    warehouseId?: string | null;
    declaredValue?: number;
};

export class OperationsService {
    // ── Routes ────────────────────────────────────────────────────────────────

    async getRoutes(companyId: string, query: ListQuery) {
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...query });
        const { active, search } = query;
        const where: Prisma.DeliveryRouteWhereInput = { companyId };
        if (active !== undefined) where.isActive = active === 'true' || active === true;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { origin: { contains: search, mode: 'insensitive' } },
                { destination: { contains: search, mode: 'insensitive' } }
            ];
        }
        const [data, total] = await Promise.all([
            prisma.deliveryRoute.findMany({ where, skip, take: limit, orderBy: { name: 'asc' }, include: { _count: { select: { deliveries: true } } } }),
            prisma.deliveryRoute.count({ where })
        ]);
        return ResultHandler.success(createPaginatedResponse(data, page, limit, total));
    }

    async getRoute(companyId: string, id: string) {
        const route = await prisma.deliveryRoute.findFirst({
            where: { id, companyId }, include: { _count: { select: { deliveries: true } } }
        });
        if (!route) throw ApiError.notFound('Rota não encontrada');
        return ResultHandler.success(route);
    }

    async createRoute(companyId: string, data: RouteInput) {
        const code = await generateRouteCode(companyId);
        return ResultHandler.success(await prisma.deliveryRoute.create({
            data: { ...data, code, companyId, isActive: data.isActive ?? true } as Prisma.DeliveryRouteUncheckedCreateInput
        }));
    }

    async updateRoute(companyId: string, id: string, data: Partial<RouteInput>) {
        const route = await prisma.deliveryRoute.findFirst({ where: { id, companyId } });
        if (!route) throw ApiError.notFound('Rota não encontrada');
        return ResultHandler.success(await prisma.deliveryRoute.update({
            where: { id },
            data: data as Prisma.DeliveryRouteUncheckedUpdateInput
        }));
    }

    async deleteRoute(companyId: string, id: string) {
        const route = await prisma.deliveryRoute.findFirst({
            where: { id, companyId }, include: { _count: { select: { deliveries: true } } }
        });
        if (!route) throw ApiError.notFound('Rota não encontrada');
        if (route._count.deliveries > 0) throw ApiError.badRequest('Não é possível eliminar uma rota com entregas associadas');
        return prisma.deliveryRoute.delete({ where: { id } });
    }

    // ── Deliveries ────────────────────────────────────────────────────────────

    async getDeliveries(companyId: string, query: ListQuery) {
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...query });
        const { status, priority, driverId, vehicleId, search, startDate, endDate } = query;
        const where: Prisma.DeliveryWhereInput = { companyId };
        if (status) where.status = status as Prisma.DeliveryWhereInput['status'];
        if (priority) where.priority = priority as Prisma.DeliveryWhereInput['priority'];
        if (driverId) where.driverId = driverId;
        if (vehicleId) where.vehicleId = vehicleId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }
        if (search) {
            where.OR = [
                { number: { contains: search, mode: 'insensitive' } },
                { recipientName: { contains: search, mode: 'insensitive' } }
            ];
        }
        const projection = parseFields(query.fields, DELIVERY_FIELDS);
        const baseArgs = { where, skip, take: limit, orderBy: { createdAt: 'desc' as const } };
        const findArgs: Prisma.DeliveryFindManyArgs = projection
            ? { ...baseArgs, select: projection as Prisma.DeliverySelect }
            : { ...baseArgs, include: { driver: true, vehicle: true, route: true, items: true, transfer: { select: { id: true, number: true, status: true } } } };
        const [deliveries, total] = await Promise.all([
            prisma.delivery.findMany(findArgs),
            prisma.delivery.count({ where })
        ]);
        return ResultHandler.success({ deliveries, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    }

    async getDelivery(companyId: string, id: string) {
        const delivery = await prisma.delivery.findFirst({
            where: { id, companyId }, include: { driver: true, vehicle: true, route: true, items: true, transfer: { select: { id: true, number: true, status: true } } }
        });
        if (!delivery) throw ApiError.notFound('Entrega não encontrada');
        return ResultHandler.success(delivery);
    }

    /**
     * Assemble everything the Guia PDF needs in one place (keeps the route thin).
     * For a warehouse transfer, the canonical items come from the StockTransfer;
     * otherwise from the DeliveryItem rows. `validade` is the earliest active
     * batch expiry for each product (best-effort, single batched query).
     */
    async getDeliveryPdfData(companyId: string, id: string) {
        const delivery = await prisma.delivery.findFirst({
            where: { id, companyId },
            include: {
                driver: true,
                vehicle: true,
                items: { include: { product: { select: { code: true, barcode: true, weight: true, price: true, unit: true } } } },
                transfer: {
                    include: {
                        sourceWarehouse: { select: { name: true } },
                        targetWarehouse: { select: { name: true } },
                        items: { include: { product: { select: { name: true, code: true, barcode: true, weight: true, price: true, unit: true } } } }
                    }
                }
            }
        });
        if (!delivery) throw ApiError.notFound('Entrega não encontrada');

        const isTransfer = delivery.kind === 'warehouse_transfer' && !!delivery.transfer;

        // Normalise both item sources into a common shape.
        const raw = isTransfer
            ? delivery.transfer!.items.map((it) => ({
                productId: it.productId as string | null,
                description: it.product?.name ?? 'Produto',
                barcode: it.product?.barcode ?? null,
                reference: it.product?.code ?? null,
                quantity: Number(it.quantity),
                unit: it.product?.unit ?? 'un',
                unitPrice: Number(it.product?.price ?? 0),
                unitWeight: Number(it.product?.weight ?? 0)
            }))
            : delivery.items.map((it) => ({
                productId: it.productId,
                description: it.description || it.product?.code || 'Item',
                barcode: it.product?.barcode ?? null,
                reference: it.product?.code ?? null,
                quantity: Number(it.quantity),
                unit: it.product?.unit ?? 'un',
                unitPrice: Number(it.product?.price ?? 0),
                unitWeight: Number(it.weight ?? it.product?.weight ?? 0)
            }));

        // Earliest active batch expiry per product — one query, no N+1.
        const productIds = raw.map((r) => r.productId).filter((p): p is string => !!p);
        const expiryByProduct = new Map<string, Date>();
        if (productIds.length > 0) {
            const batches = await prisma.productBatch.findMany({
                where: { companyId, productId: { in: productIds }, status: 'active', quantity: { gt: 0 }, expiryDate: { not: null } },
                select: { productId: true, expiryDate: true },
                orderBy: { expiryDate: 'asc' }
            });
            for (const b of batches) {
                if (b.expiryDate && !expiryByProduct.has(b.productId)) expiryByProduct.set(b.productId, b.expiryDate);
            }
        }

        const items = raw.map((r) => ({
            barcode: r.barcode,
            reference: r.reference,
            description: r.description,
            expiry: r.productId ? expiryByProduct.get(r.productId) ?? null : null,
            quantity: r.quantity,
            unit: r.unit,
            value: r.unitPrice * r.quantity,
            weight: r.unitWeight * r.quantity
        }));

        return {
            delivery,
            items,
            sourceWarehouseName: isTransfer ? delivery.transfer!.sourceWarehouse?.name ?? null : null,
            targetWarehouseName: isTransfer ? delivery.transfer!.targetWarehouse?.name ?? null : null
        };
    }

    async createDelivery(companyId: string, data: DeliveryInput, actor: Actor = {}) {
        const userId = actor.userId || 'system';
        const userName = actor.userName || 'Sistema';
        const number = await generateDeliveryNumber(companyId);
        const isTransfer = data.kind === 'warehouse_transfer';

        const result = await prisma.$transaction(async (tx) => {
            const { items, kind, sourceWarehouseId, targetWarehouseId, reason, ...rest } = data;
            let transferId: string | undefined;

            // For a warehouse transfer, create + submit the backing StockTransfer
            // first so the Guia carries its id. Stock only moves later, on
            // dispatch/receive (see updateDeliveryStatus).
            if (isTransfer) {
                if (!sourceWarehouseId || !targetWarehouseId) {
                    throw ApiError.badRequest('Transferência exige armazém de origem e destino');
                }
                const transferItems = (items ?? [])
                    .filter((i) => i.productId)
                    .map((i) => ({ productId: i.productId as string, quantity: i.quantity }));
                if (transferItems.length === 0) {
                    throw ApiError.badRequest('Transferência exige pelo menos um produto com productId');
                }
                const transfer = await warehousesService.createAndSubmitTransferTx(
                    tx as unknown as StockTransactionClient,
                    companyId,
                    { sourceWarehouseId, targetWarehouseId, items: transferItems, responsible: userName, reason: reason ?? undefined },
                    userId,
                    userName
                );
                transferId = transfer.id;
            }

            const delivery = await tx.delivery.create({
                data: {
                    ...rest, number, companyId,
                    kind: isTransfer ? 'warehouse_transfer' : 'shipment',
                    transferId,
                    // A transfer Guia is born awaiting approval; it cannot depart yet.
                    status: isTransfer ? 'pending' : rest.status,
                    items: items && items.length ? { create: items } : undefined
                } as Prisma.DeliveryUncheckedCreateInput,
                include: { driver: true, vehicle: true, route: true, transfer: true }
            });
            if (!isTransfer && data.driverId && data.status === 'in_transit') {
                await tx.driver.update({ where: { id: data.driverId }, data: { status: 'on_delivery' } });
            }
            if (!isTransfer && data.vehicleId && data.status === 'in_transit') {
                await tx.vehicle.update({ where: { id: data.vehicleId }, data: { status: 'in_use' } });
            }
            return delivery;
        }, { timeout: 30000, maxWait: 10000 });

        // Notify the approvals inbox only after the transaction commits.
        if (isTransfer && result.transferId) {
            emitToModule(companyId, 'approvals', 'approvals:created', {
                resourceType: 'stock_transfer',
                resourceId: result.transferId,
                requestType: 'warehouse_transfer',
            });
        }
        return result;
    }

    async updateDelivery(companyId: string, id: string, data: Partial<DeliveryInput>) {
        const existing = await prisma.delivery.findFirst({ where: { id, companyId } });
        if (!existing) throw ApiError.notFound('Entrega não encontrada');
        const { items: _items, ...rest } = data;
        return ResultHandler.success(await prisma.delivery.update({
            where: { id },
            data: rest as Prisma.DeliveryUncheckedUpdateInput,
            include: { driver: true, vehicle: true, route: true, items: true }
        }));
    }

    async deleteDelivery(companyId: string, id: string) {
        const delivery = await prisma.delivery.findFirst({ where: { id, companyId }, include: { transfer: true } });
        if (!delivery) throw ApiError.notFound('Entrega não encontrada');
        if (['in_transit', 'out_for_delivery'].includes(delivery.status)) {
            throw ApiError.badRequest('Não é possível eliminar uma entrega em trânsito');
        }
        if (delivery.kind === 'warehouse_transfer' && delivery.transfer && !TERMINAL_TRANSFER_STATES.includes(delivery.transfer.status)) {
            throw ApiError.badRequest('Não é possível eliminar uma Guia de transferência com transferência ativa. Cancele a transferência primeiro.');
        }
        await prisma.deliveryItem.deleteMany({ where: { deliveryId: id } });
        return prisma.delivery.delete({ where: { id } });
    }

    async updateDeliveryStatus(
        companyId: string,
        id: string,
        status: string,
        extra: { recipientSign?: string; proofOfDelivery?: string; failureReason?: string },
        actor: Actor = {}
    ) {
        const userId = actor.userId || 'system';
        const userName = actor.userName || 'Sistema';
        const existing = await prisma.delivery.findFirst({ where: { id, companyId }, include: { transfer: true } });
        if (!existing) throw ApiError.notFound('Entrega não encontrada');

        const updateData: Prisma.DeliveryUncheckedUpdateInput = { status: status as Prisma.DeliveryUncheckedUpdateInput['status'] };
        if (status === 'in_transit') updateData.departureDate = new Date();
        else if (status === 'delivered') {
            updateData.deliveredDate = new Date();
            if (extra.recipientSign) updateData.recipientSign = extra.recipientSign;
            if (extra.proofOfDelivery) updateData.proofOfDelivery = extra.proofOfDelivery;
        } else if (status === 'failed') {
            updateData.failureReason = extra.failureReason;
            updateData.attempts = existing.attempts + 1;
        }

        const isTransfer = existing.kind === 'warehouse_transfer' && !!existing.transferId;

        return prisma.$transaction(async (tx) => {
            // Drive the backing StockTransfer through the same lifecycle as the
            // Guia, inside this transaction so stock + Guia commit atomically.
            if (isTransfer && existing.transferId) {
                const txc = tx as unknown as StockTransactionClient;
                if (status === 'in_transit') {
                    if (existing.transfer?.status !== 'approved') {
                        throw ApiError.badRequest('Guia não pode partir: a transferência aguarda aprovação.');
                    }
                    await warehousesService.dispatchTransferTx(txc, companyId, existing.transferId, userId, userName);
                } else if (status === 'delivered') {
                    await warehousesService.receiveTransferTx(txc, companyId, existing.transferId, userId, userName);
                } else if (['failed', 'cancelled', 'returned'].includes(status)) {
                    if (existing.transfer && !TERMINAL_TRANSFER_STATES.includes(existing.transfer.status)) {
                        await warehousesService.cancelTransferTx(txc, companyId, existing.transferId, userId, userName);
                    }
                }
            }

            const delivery = await tx.delivery.update({ where: { id }, data: updateData });
            if (['delivered', 'failed', 'cancelled'].includes(status)) {
                if (existing.driverId) await tx.driver.update({ where: { id: existing.driverId }, data: { status: 'available' } });
                if (existing.vehicleId) await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'available' } });
            }
            return ResultHandler.success(delivery);
        }, { timeout: 30000, maxWait: 10000 });
    }

    async payDelivery(companyId: string, id: string, data: { paymentMethod: string; amount?: number }) {
        const delivery = await prisma.delivery.findFirst({ where: { id, companyId } });
        if (!delivery) throw ApiError.notFound('Entrega não encontrada');
        if (delivery.isPaid) throw ApiError.badRequest('Esta entrega já foi paga');

        return prisma.$transaction(async (tx) => {
            const updated = await tx.delivery.update({ where: { id }, data: { isPaid: true } });
            await tx.transaction.create({
                data: {
                    companyId, module: 'logistics', category: 'payment', type: 'income',
                    amount: data.amount ?? delivery.shippingCost ?? 0,
                    paymentMethod: data.paymentMethod as Prisma.TransactionUncheckedCreateInput['paymentMethod'],
                    deliveryId: id,
                    description: `Pagamento da entrega ${delivery.number}`
                }
            });
            return ResultHandler.success(updated);
        });
    }

    // ── Parcels ───────────────────────────────────────────────────────────────

    async getParcels(companyId: string, query: ListQuery) {
        const { limit, skip, page } = getPaginationParams({ limit: DEFAULT_LIMIT, ...query });
        const { status, warehouseId, search } = query;
        const where: Prisma.ParcelWhereInput = { companyId };
        if (status) where.status = status as Prisma.ParcelWhereInput['status'];
        if (warehouseId) where.warehouseId = warehouseId;
        if (search) {
            where.OR = [
                { trackingNumber: { contains: search, mode: 'insensitive' } },
                { recipientName: { contains: search, mode: 'insensitive' } },
                { senderName: { contains: search, mode: 'insensitive' } }
            ];
        }
        const [parcels, total] = await Promise.all([
            prisma.parcel.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { warehouse: true } }),
            prisma.parcel.count({ where })
        ]);
        return ResultHandler.success({ parcels, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    }

    async getParcel(companyId: string, id: string) {
        const parcel = await prisma.parcel.findFirst({
            where: { id, companyId },
            include: { warehouse: true, notifications: { orderBy: { sentAt: 'desc' } } }
        });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return ResultHandler.success(parcel);
    }

    async trackParcel(companyId: string, trackingNumber: string) {
        const parcel = await prisma.parcel.findFirst({
            where: { trackingNumber, companyId },
            include: { warehouse: true, notifications: { orderBy: { sentAt: 'desc' } } }
        });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return ResultHandler.success(parcel);
    }

    async createParcel(companyId: string, data: ParcelInput) {
        const parcel = await prisma.parcel.create({
            data: { ...data, trackingNumber: generateTrackingNumber(), status: 'received', companyId } as Prisma.ParcelUncheckedCreateInput,
            include: { warehouse: true }
        });
        return ResultHandler.success(parcel);
    }

    async updateParcel(companyId: string, id: string, data: Partial<ParcelInput>) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return ResultHandler.success(await prisma.parcel.update({
            where: { id },
            data: data as Prisma.ParcelUncheckedUpdateInput,
            include: { warehouse: true }
        }));
    }

    async deleteParcel(companyId: string, id: string) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        if (parcel.status === 'picked_up') throw ApiError.badRequest('Não é possível eliminar uma encomenda já levantada');
        await prisma.parcelNotification.deleteMany({ where: { parcelId: id } });
        return prisma.parcel.delete({ where: { id } });
    }

    async registerParcelPickup(companyId: string, id: string, data: {
        pickedUpBy: string; pickedUpDocument?: string; pickupSignature?: string;
        paymentMethod?: string; isPaid?: boolean;
    }) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        if (parcel.status === 'picked_up') throw ApiError.badRequest('Encomenda já levantada');

        return prisma.$transaction(async (tx) => {
            const updated = await tx.parcel.update({
                where: { id },
                data: {
                    status: 'picked_up', pickedUpAt: new Date(),
                    pickedUpBy: data.pickedUpBy, pickedUpDocument: data.pickedUpDocument,
                    pickupSignature: data.pickupSignature,
                    isPaid: data.isPaid ?? parcel.isPaid,
                    paymentMethod: data.paymentMethod ?? parcel.paymentMethod
                },
                include: { warehouse: true }
            });
            if (data.isPaid && !parcel.isPaid && Number(parcel.fees) > 0) {
                await tx.transaction.create({
                    data: {
                        companyId, module: 'logistics', category: 'payment', type: 'income',
                        amount: parcel.fees,
                        paymentMethod: (data.paymentMethod || 'cash') as Prisma.TransactionUncheckedCreateInput['paymentMethod'],
                        parcelId: id,
                        description: `Levantamento da encomenda ${parcel.trackingNumber}`
                    }
                });
            }
            return ResultHandler.success(updated);
        });
    }

    async updateParcelStatus(companyId: string, id: string, status: string) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return ResultHandler.success(await prisma.parcel.update({
            where: { id },
            data: { status: status as Prisma.ParcelUncheckedUpdateInput['status'] }
        }));
    }

    async sendParcelNotification(companyId: string, id: string, data: { type?: string; recipient?: string; message: string }) {
        const parcel = await prisma.parcel.findFirst({ where: { id, companyId } });
        if (!parcel) throw ApiError.notFound('Encomenda não encontrada');
        return ResultHandler.success(await prisma.parcelNotification.create({
            data: {
                parcelId: id,
                type: (data.type || 'sms') as Prisma.ParcelNotificationUncheckedCreateInput['type'],
                recipient: data.recipient || parcel.recipientPhone,
                message: data.message,
                sentAt: new Date(),
                status: 'sent'
            }
        }));
    }
}
