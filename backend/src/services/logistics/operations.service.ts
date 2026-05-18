import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../middleware/error.middleware';
import { ResultHandler } from '../../utils/result';
import { getPaginationParams, createPaginatedResponse, parseFields } from '../../utils/pagination';
import { generateDeliveryNumber, generateRouteCode, generateTrackingNumber } from './shared';

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
    status?: string;
    priority?: string;
    scheduledDate?: string | Date | null;
    shippingCost?: number;
    totalAmount?: number;
    notes?: string | null;
    items?: DeliveryItemInput[];
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
            : { ...baseArgs, include: { driver: true, vehicle: true, route: true, items: true } };
        const [deliveries, total] = await Promise.all([
            prisma.delivery.findMany(findArgs),
            prisma.delivery.count({ where })
        ]);
        return ResultHandler.success({ deliveries, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    }

    async getDelivery(companyId: string, id: string) {
        const delivery = await prisma.delivery.findFirst({
            where: { id, companyId }, include: { driver: true, vehicle: true, route: true, items: true }
        });
        if (!delivery) throw ApiError.notFound('Entrega não encontrada');
        return ResultHandler.success(delivery);
    }

    async createDelivery(companyId: string, data: DeliveryInput) {
        const number = await generateDeliveryNumber(companyId);
        return prisma.$transaction(async (tx) => {
            const { items, ...rest } = data;
            const delivery = await tx.delivery.create({
                data: {
                    ...rest, number, companyId,
                    items: items && items.length ? { create: items } : undefined
                } as Prisma.DeliveryUncheckedCreateInput,
                include: { driver: true, vehicle: true, route: true }
            });
            if (data.driverId && data.status === 'in_transit') {
                await tx.driver.update({ where: { id: data.driverId }, data: { status: 'on_delivery' } });
            }
            if (data.vehicleId && data.status === 'in_transit') {
                await tx.vehicle.update({ where: { id: data.vehicleId }, data: { status: 'in_use' } });
            }
            return delivery;
        });
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
        const delivery = await prisma.delivery.findFirst({ where: { id, companyId } });
        if (!delivery) throw ApiError.notFound('Entrega não encontrada');
        if (['in_transit', 'out_for_delivery'].includes(delivery.status)) {
            throw ApiError.badRequest('Não é possível eliminar uma entrega em trânsito');
        }
        await prisma.deliveryItem.deleteMany({ where: { deliveryId: id } });
        return prisma.delivery.delete({ where: { id } });
    }

    async updateDeliveryStatus(
        companyId: string,
        id: string,
        status: string,
        extra: { recipientSign?: string; proofOfDelivery?: string; failureReason?: string }
    ) {
        const existing = await prisma.delivery.findFirst({ where: { id, companyId } });
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

        return prisma.$transaction(async (tx) => {
            const delivery = await tx.delivery.update({ where: { id }, data: updateData });
            if (['delivered', 'failed', 'cancelled'].includes(status)) {
                if (existing.driverId) await tx.driver.update({ where: { id: existing.driverId }, data: { status: 'available' } });
                if (existing.vehicleId) await tx.vehicle.update({ where: { id: existing.vehicleId }, data: { status: 'available' } });
            }
            return ResultHandler.success(delivery);
        });
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
