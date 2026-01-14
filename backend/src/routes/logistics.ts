/**
 * Logistics Module API Routes
 * Includes: Vehicles, Drivers, Routes, Deliveries, Parcels
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { cacheService } from '../services/cache.service';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

// ============================================================================
// DASHBOARD - Logistics KPIs
// ============================================================================

router.get('/dashboard', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;

        // Check cache first
        const cacheKey = `logistics:dashboard:${companyId}`;
        const cached = cacheService.get(cacheKey);
        if (cached) {
            logger.info('Logistics dashboard cache hit');
            return res.json(cached);
        }

        const [
            vehicles,
            drivers,
            routes,
            deliveries,
            parcels,
            recentDeliveries
        ] = await Promise.all([
            prisma.vehicle.count({ where: { companyId } }),
            prisma.driver.count({ where: { companyId } }),
            prisma.deliveryRoute.count({ where: { companyId } }),
            prisma.delivery.count({ where: { companyId } }),
            prisma.parcel.count({ where: { companyId } }),
            prisma.delivery.findMany({
                where: { companyId },
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    driver: true,
                    vehicle: true,
                    route: true
                }
            })
        ]);

        // Get status breakdown
        const [pendingDeliveries, inTransitDeliveries, deliveredToday] = await Promise.all([
            prisma.delivery.count({ where: { companyId, status: 'pending' } }),
            prisma.delivery.count({ where: { companyId, status: 'in_transit' } }),
            prisma.delivery.count({
                where: {
                    companyId,
                    status: 'delivered',
                    deliveredDate: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }
            })
        ]);

        // Get vehicle and driver availability
        const [availableVehicles, availableDrivers] = await Promise.all([
            prisma.vehicle.count({ where: { companyId, status: 'available' } }),
            prisma.driver.count({ where: { companyId, status: 'available' } })
        ]);

        // Get pending parcels
        const pendingParcels = await prisma.parcel.count({
            where: { companyId, status: { in: ['received', 'awaiting_pickup'] } }
        });

        // Get financial summaries from unified transaction pool
        const [pickupRevenue, deliveryRevenue] = await Promise.all([
            prisma.transaction.aggregate({
                where: { companyId, module: 'logistics', category: 'logistics', type: 'income', parcelId: { not: null } },
                _sum: { amount: true }
            }),
            prisma.transaction.aggregate({
                where: { companyId, module: 'logistics', category: 'logistics', type: 'income', deliveryId: { not: null } },
                _sum: { amount: true }
            })
        ]);

        // Get deliveries by province
        const deliveriesByProvince = await prisma.delivery.groupBy({
            by: ['province'],
            where: { companyId, province: { not: null } },
            _count: { id: true }
        });

        const result = {
            totals: {
                vehicles,
                drivers,
                routes,
                deliveries,
                parcels
            },
            stats: {
                pendingDeliveries,
                inTransitDeliveries,
                deliveredToday,
                availableVehicles,
                availableDrivers,
                pendingParcels,
                pickupRevenue: Number(pickupRevenue._sum.amount || 0),
                deliveryRevenue: Number(deliveryRevenue._sum.amount || 0),
                deliveriesByProvince: deliveriesByProvince.map(p => ({
                    province: p.province,
                    count: p._count.id
                }))
            },
            recentDeliveries
        };

        // Cache for 2 minutes
        cacheService.set(cacheKey, result, 120);

        res.json(result);
    } catch (error) {
        logger.error('Error fetching logistics dashboard:', error);
        res.status(500).json({ error: 'Erro ao carregar dashboard de logística' });
    }
});

// ============================================================================
// VEHICLES - CRUD
// ============================================================================

const vehicleSchema = z.object({
    plate: z.string().min(1, 'Matrícula obrigatória'),
    brand: z.string().min(1, 'Marca obrigatória'),
    model: z.string().min(1, 'Modelo obrigatório'),
    year: z.number().optional().nullable(),
    type: z.enum(['truck', 'van', 'motorcycle', 'car', 'bicycle', 'other']).default('truck'),
    capacity: z.number().optional().nullable(),
    capacityUnit: z.string().optional().nullable(),
    fuelType: z.string().optional().nullable(),
    status: z.enum(['available', 'in_use', 'maintenance', 'inactive']).default('available'),
    insuranceExpiry: z.string().optional().nullable(),
    mileage: z.number().optional().default(0),
    notes: z.string().optional().nullable()
});

router.get('/vehicles', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { status, type, search, page = '1', limit = '20' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { companyId };
        if (status) where.status = status;
        if (type) where.type = type;
        if (search) {
            where.OR = [
                { plate: { contains: search as string, mode: 'insensitive' } },
                { brand: { contains: search as string, mode: 'insensitive' } },
                { model: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        const [vehicles, total] = await Promise.all([
            prisma.vehicle.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' },
                include: {
                    maintenances: {
                        take: 1,
                        orderBy: { date: 'desc' }
                    },
                    _count: {
                        select: { deliveries: true }
                    }
                }
            }),
            prisma.vehicle.count({ where })
        ]);

        res.json({
            data: vehicles,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + vehicles.length < total
            }
        });
    } catch (error) {
        logger.error('Error fetching vehicles:', error);
        res.status(500).json({ error: 'Erro ao listar veículos' });
    }
});

router.get('/vehicles/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        const vehicle = await prisma.vehicle.findFirst({
            where: { id, companyId },
            include: {
                maintenances: {
                    orderBy: { date: 'desc' }
                },
                deliveries: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!vehicle) {
            return res.status(404).json({ error: 'Veículo não encontrado' });
        }

        res.json(vehicle);
    } catch (error) {
        console.error('Error fetching vehicle:', error);
        res.status(500).json({ error: 'Erro ao obter veículo' });
    }
});

router.post('/vehicles', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const data = vehicleSchema.parse(req.body);

        // Check if plate already exists
        const existing = await prisma.vehicle.findFirst({
            where: { companyId, plate: data.plate }
        });
        if (existing) {
            return res.status(400).json({ error: 'Já existe um veículo com esta matrícula' });
        }

        const vehicle = await prisma.vehicle.create({
            data: {
                ...data,
                insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : null,
                companyId
            }
        });

        res.status(201).json(vehicle);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error creating vehicle:', error);
        res.status(500).json({ error: 'Erro ao criar veículo' });
    }
});

router.put('/vehicles/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const data = vehicleSchema.partial().parse(req.body);

        const vehicle = await prisma.vehicle.updateMany({
            where: { id, companyId },
            data: {
                ...data,
                insuranceExpiry: data.insuranceExpiry ? new Date(data.insuranceExpiry) : undefined
            }
        });

        if (vehicle.count === 0) {
            return res.status(404).json({ error: 'Veículo não encontrado' });
        }

        const updated = await prisma.vehicle.findUnique({ where: { id } });
        res.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error updating vehicle:', error);
        res.status(500).json({ error: 'Erro ao actualizar veículo' });
    }
});

router.delete('/vehicles/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        const result = await prisma.vehicle.deleteMany({
            where: { id, companyId }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Veículo não encontrado' });
        }

        res.json({ message: 'Veículo eliminado com sucesso' });
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({ error: 'Erro ao eliminar veículo' });
    }
});

// ============================================================================
// DRIVERS - CRUD
// ============================================================================

const driverSchema = z.object({
    code: z.string().min(1, 'Código obrigatório'),
    name: z.string().min(1, 'Nome obrigatório'),
    phone: z.string().min(1, 'Telefone obrigatório'),
    email: z.string().email().optional().nullable(),
    licenseNumber: z.string().min(1, 'Número de carta obrigatório'),
    licenseType: z.string().optional().nullable(),
    licenseExpiry: z.string().optional().nullable(),
    status: z.enum(['available', 'on_delivery', 'off_duty', 'inactive']).default('available'),
    hireDate: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    emergencyContact: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
});

router.get('/drivers', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { status, search, page = '1', limit = '20' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { companyId };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { code: { contains: search as string, mode: 'insensitive' } },
                { phone: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        const [drivers, total] = await Promise.all([
            prisma.driver.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { name: 'asc' },
                include: {
                    _count: {
                        select: { deliveries: true }
                    }
                }
            }),
            prisma.driver.count({ where })
        ]);

        res.json({
            data: drivers,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + drivers.length < total
            }
        });
    } catch (error) {
        logger.error('Error fetching drivers:', error);
        res.status(500).json({ error: 'Erro ao listar motoristas' });
    }
});

router.get('/drivers/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        const driver = await prisma.driver.findFirst({
            where: { id, companyId },
            include: {
                deliveries: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    include: { route: true, vehicle: true }
                }
            }
        });

        if (!driver) {
            return res.status(404).json({ error: 'Motorista não encontrado' });
        }

        res.json(driver);
    } catch (error) {
        console.error('Error fetching driver:', error);
        res.status(500).json({ error: 'Erro ao obter motorista' });
    }
});

router.post('/drivers', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const data = driverSchema.parse(req.body);

        // Check if code already exists
        const existing = await prisma.driver.findFirst({
            where: { companyId, code: data.code }
        });
        if (existing) {
            return res.status(400).json({ error: 'Já existe um motorista com este código' });
        }

        const driver = await prisma.driver.create({
            data: {
                ...data,
                licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : null,
                hireDate: data.hireDate ? new Date(data.hireDate) : null,
                companyId
            }
        });

        res.status(201).json(driver);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error creating driver:', error);
        res.status(500).json({ error: 'Erro ao criar motorista' });
    }
});

router.put('/drivers/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const data = driverSchema.partial().parse(req.body);

        const result = await prisma.driver.updateMany({
            where: { id, companyId },
            data: {
                ...data,
                licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : undefined,
                hireDate: data.hireDate ? new Date(data.hireDate) : undefined
            }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Motorista não encontrado' });
        }

        const updated = await prisma.driver.findUnique({ where: { id } });
        res.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error updating driver:', error);
        res.status(500).json({ error: 'Erro ao actualizar motorista' });
    }
});

router.delete('/drivers/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        const result = await prisma.driver.deleteMany({
            where: { id, companyId }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Motorista não encontrado' });
        }

        res.json({ message: 'Motorista eliminado com sucesso' });
    } catch (error) {
        console.error('Error deleting driver:', error);
        res.status(500).json({ error: 'Erro ao eliminar motorista' });
    }
});

// ============================================================================
// DELIVERY ROUTES - CRUD
// ============================================================================

const routeSchema = z.object({
    code: z.string().min(1, 'Código obrigatório'),
    name: z.string().min(1, 'Nome obrigatório'),
    origin: z.string().min(1, 'Origem obrigatória'),
    destination: z.string().min(1, 'Destino obrigatório'),
    distance: z.number().optional().nullable(),
    estimatedTime: z.number().optional().nullable(),
    tollCost: z.number().optional().nullable(),
    fuelEstimate: z.number().optional().nullable(),
    isActive: z.boolean().default(true),
    notes: z.string().optional().nullable()
});

router.get('/routes', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { active, search, page = '1', limit = '20' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = { companyId };
        if (active !== undefined) where.isActive = active === 'true';
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { code: { contains: search as string, mode: 'insensitive' } },
                { origin: { contains: search as string, mode: 'insensitive' } },
                { destination: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        const [routes, total] = await Promise.all([
            prisma.deliveryRoute.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { name: 'asc' },
                include: {
                    _count: {
                        select: { deliveries: true }
                    }
                }
            }),
            prisma.deliveryRoute.count({ where })
        ]);

        res.json({
            data: routes,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + routes.length < total
            }
        });
    } catch (error) {
        logger.error('Error fetching routes:', error);
        res.status(500).json({ error: 'Erro ao listar rotas' });
    }
});

router.get('/routes/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        const route = await prisma.deliveryRoute.findFirst({
            where: { id, companyId },
            include: {
                deliveries: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!route) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }

        res.json(route);
    } catch (error) {
        console.error('Error fetching route:', error);
        res.status(500).json({ error: 'Erro ao obter rota' });
    }
});

router.post('/routes', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const data = routeSchema.parse(req.body);

        // Check if code already exists
        const existing = await prisma.deliveryRoute.findFirst({
            where: { companyId, code: data.code }
        });
        if (existing) {
            return res.status(400).json({ error: 'Já existe uma rota com este código' });
        }

        const route = await prisma.deliveryRoute.create({
            data: {
                ...data,
                companyId
            }
        });

        res.status(201).json(route);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error creating route:', error);
        res.status(500).json({ error: 'Erro ao criar rota' });
    }
});

router.put('/routes/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const data = routeSchema.partial().parse(req.body);

        const result = await prisma.deliveryRoute.updateMany({
            where: { id, companyId },
            data
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }

        const updated = await prisma.deliveryRoute.findUnique({ where: { id } });
        res.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error updating route:', error);
        res.status(500).json({ error: 'Erro ao actualizar rota' });
    }
});

router.delete('/routes/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        const result = await prisma.deliveryRoute.deleteMany({
            where: { id, companyId }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Rota não encontrada' });
        }

        res.json({ message: 'Rota eliminada com sucesso' });
    } catch (error) {
        console.error('Error deleting route:', error);
        res.status(500).json({ error: 'Erro ao eliminar rota' });
    }
});

// ============================================================================
// DELIVERIES - CRUD & Status Management
// ============================================================================

const deliverySchema = z.object({
    orderId: z.string().optional().nullable(),
    customerId: z.string().optional().nullable(),
    routeId: z.string().optional().nullable(),
    vehicleId: z.string().optional().nullable(),
    driverId: z.string().optional().nullable(),
    status: z.enum(['pending', 'scheduled', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled']).default('pending'),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    scheduledDate: z.string().optional().nullable(),
    recipientName: z.string().optional().nullable(),
    recipientPhone: z.string().optional().nullable(),
    deliveryAddress: z.string().min(1, 'Endereço obrigatório'),
    country: z.string().optional().default('Moçambique'),
    province: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    shippingCost: z.number().optional().default(0),
    isPaid: z.boolean().default(false),
    notes: z.string().optional().nullable(),
    items: z.array(z.object({
        productId: z.string().optional().nullable(),
        description: z.string().min(1),
        quantity: z.number().default(1),
        weight: z.number().optional().nullable()
    })).optional()
});

// Generate delivery number
async function generateDeliveryNumber(companyId: string): Promise<string> {
    const today = new Date();
    const prefix = `DEL-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;

    const count = await prisma.delivery.count({
        where: {
            companyId,
            number: { startsWith: prefix }
        }
    });

    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

router.get('/deliveries', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { status, priority, driverId, vehicleId, search, startDate, endDate, page = '1', limit = '20' } = req.query;

        const where: any = { companyId };
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (driverId) where.driverId = driverId;
        if (vehicleId) where.vehicleId = vehicleId;
        if (search) {
            where.OR = [
                { number: { contains: search as string, mode: 'insensitive' } },
                { recipientName: { contains: search as string, mode: 'insensitive' } },
                { deliveryAddress: { contains: search as string, mode: 'insensitive' } }
            ];
        }
        if (startDate || endDate) {
            where.scheduledDate = {};
            if (startDate) where.scheduledDate.gte = new Date(startDate as string);
            if (endDate) where.scheduledDate.lte = new Date(endDate as string);
        }

        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const [deliveries, total] = await Promise.all([
            prisma.delivery.findMany({
                where,
                skip,
                take: parseInt(limit as string),
                orderBy: { createdAt: 'desc' },
                include: {
                    driver: true,
                    vehicle: true,
                    route: true,
                    items: true
                }
            }),
            prisma.delivery.count({ where })
        ]);

        res.json({
            deliveries,
            pagination: {
                total,
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                totalPages: Math.ceil(total / parseInt(limit as string))
            }
        });
    } catch (error) {
        console.error('Error fetching deliveries:', error);
        res.status(500).json({ error: 'Erro ao listar entregas' });
    }
});

router.get('/deliveries/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        const delivery = await prisma.delivery.findFirst({
            where: { id, companyId },
            include: {
                driver: true,
                vehicle: true,
                route: true,
                items: {
                    include: { product: true }
                }
            }
        });

        if (!delivery) {
            return res.status(404).json({ error: 'Entrega não encontrada' });
        }

        res.json(delivery);
    } catch (error) {
        console.error('Error fetching delivery:', error);
        res.status(500).json({ error: 'Erro ao obter entrega' });
    }
});

router.post('/deliveries', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(403).json({ error: 'Company ID não encontrado' });
        }

        const data = deliverySchema.parse(req.body);
        const number = await generateDeliveryNumber(companyId);

        const delivery = await prisma.delivery.create({
            data: {
                number,
                orderId: data.orderId,
                customerId: data.customerId,
                routeId: data.routeId,
                vehicleId: data.vehicleId,
                driverId: data.driverId,
                status: data.status,
                priority: data.priority,
                scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : null,
                recipientName: data.recipientName,
                recipientPhone: data.recipientPhone,
                deliveryAddress: data.deliveryAddress,
                country: data.country,
                province: data.province,
                city: data.city,
                shippingCost: data.shippingCost,
                isPaid: data.isPaid,
                notes: data.notes,
                companyId,
                items: data.items ? {
                    create: data.items.map(item => ({
                        productId: item.productId,
                        description: item.description,
                        quantity: item.quantity,
                        weight: item.weight
                    }))
                } : undefined
            },
            include: {
                driver: true,
                vehicle: true,
                route: true,
                items: true
            }
        });

        // Update driver status if assigned
        if (data.driverId && data.status === 'in_transit') {
            await prisma.driver.update({
                where: { id: data.driverId },
                data: { status: 'on_delivery' }
            });
        }

        // Update vehicle status if assigned
        if (data.vehicleId && data.status === 'in_transit') {
            await prisma.vehicle.update({
                where: { id: data.vehicleId },
                data: { status: 'in_use' }
            });
        }

        res.status(201).json(delivery);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error creating delivery:', error);
        res.status(500).json({ error: 'Erro ao criar entrega' });
    }
});

router.put('/deliveries/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const data = deliverySchema.partial().parse(req.body);

        const existing = await prisma.delivery.findFirst({
            where: { id, companyId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Entrega não encontrada' });
        }

        const delivery = await prisma.delivery.update({
            where: { id },
            data: {
                ...data,
                scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
                items: undefined
            },
            include: {
                driver: true,
                vehicle: true,
                route: true,
                items: true
            }
        });

        res.json(delivery);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error updating delivery:', error);
        res.status(500).json({ error: 'Erro ao actualizar entrega' });
    }
});

// Update delivery status
router.put('/deliveries/:id/status', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const { status, failureReason, recipientSign, proofOfDelivery } = req.body;

        const existing = await prisma.delivery.findFirst({
            where: { id, companyId },
            include: { driver: true, vehicle: true }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Entrega não encontrada' });
        }

        const updateData: any = { status };

        if (status === 'in_transit') {
            updateData.departureDate = new Date();
        } else if (status === 'delivered') {
            updateData.deliveredDate = new Date();
            if (recipientSign) updateData.recipientSign = recipientSign;
            if (proofOfDelivery) updateData.proofOfDelivery = proofOfDelivery;
        } else if (status === 'failed') {
            updateData.failureReason = failureReason;
            updateData.attempts = existing.attempts + 1;
        }

        const delivery = await prisma.delivery.update({
            where: { id },
            data: updateData,
            include: {
                driver: true,
                vehicle: true,
                route: true,
                items: true
            }
        });

        // Update driver and vehicle status on completion
        if (['delivered', 'failed', 'cancelled'].includes(status)) {
            if (existing.driverId) {
                await prisma.driver.update({
                    where: { id: existing.driverId },
                    data: { status: 'available' }
                });
            }
            if (existing.vehicleId) {
                await prisma.vehicle.update({
                    where: { id: existing.vehicleId },
                    data: { status: 'available' }
                });
            }
        }

        res.json(delivery);
    } catch (error) {
        console.error('Error updating delivery status:', error);
        res.status(500).json({ error: 'Erro ao actualizar estado da entrega' });
    }
});

// Pay delivery shipping fee
router.post('/deliveries/:id/pay', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const { paymentMethod, amount } = req.body;

        const delivery = await prisma.delivery.findFirst({
            where: { id, companyId }
        });

        if (!delivery) {
            return res.status(404).json({ error: 'Entrega não encontrada' });
        }

        if (delivery.isPaid) {
            return res.status(400).json({ error: 'Taxa de entrega já está paga' });
        }

        const paidAmount = amount || (delivery.shippingCost ? Number(delivery.shippingCost) : 0);

        // Create financial transaction
        const transaction = await prisma.transaction.create({
            data: {
                type: 'income',
                category: 'logistics',
                description: `Pagamento de Entrega: ${delivery.number}`,
                amount: paidAmount,
                date: new Date(),
                status: 'completed',
                paymentMethod: (paymentMethod as any) || 'cash',
                companyId,
                module: 'logistics',
                deliveryId: id
            }
        });

        const updatedDelivery = await prisma.delivery.update({
            where: { id },
            data: {
                isPaid: true,
                transactionId: transaction.id
            }
        });

        res.json(updatedDelivery);
    } catch (error) {
        console.error('Error paying delivery:', error);
        res.status(500).json({ error: 'Erro ao registar pagamento de entrega' });
    }
});

router.delete('/deliveries/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        const existing = await prisma.delivery.findFirst({
            where: { id, companyId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Entrega não encontrada' });
        }

        await prisma.delivery.delete({ where: { id } });

        res.json({ message: 'Entrega eliminada com sucesso' });
    } catch (error) {
        console.error('Error deleting delivery:', error);
        res.status(500).json({ error: 'Erro ao eliminar entrega' });
    }
});

// ============================================================================
// PARCELS - CRUD & Pickup Management
// ============================================================================

const parcelSchema = z.object({
    senderName: z.string().min(1, 'Nome do remetente obrigatório'),
    senderPhone: z.string().min(1, 'Telefone do remetente obrigatório'),
    senderEmail: z.string().email().optional().nullable(),
    senderAddress: z.string().optional().nullable(),
    recipientName: z.string().min(1, 'Nome do destinatário obrigatório'),
    recipientPhone: z.string().min(1, 'Telefone do destinatário obrigatório'),
    recipientEmail: z.string().email().optional().nullable(),
    recipientAddress: z.string().optional().nullable(),
    recipientDocument: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    weight: z.number().optional().nullable(),
    dimensions: z.string().optional().nullable(),
    warehouseId: z.string().optional().nullable(),
    storageLocation: z.string().optional().nullable(),
    expectedPickup: z.string().optional().nullable(),
    fees: z.number().default(0),
    isPaid: z.boolean().default(false),
    paymentMethod: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
});

// Generate tracking number
function generateTrackingNumber(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'PKG';
    for (let i = 0; i < 9; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

router.get('/parcels', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { status, warehouseId, search, page = '1', limit = '20' } = req.query;

        const where: any = { companyId };
        if (status) where.status = status;
        if (warehouseId) where.warehouseId = warehouseId;
        if (search) {
            where.OR = [
                { trackingNumber: { contains: search as string, mode: 'insensitive' } },
                { recipientName: { contains: search as string, mode: 'insensitive' } },
                { recipientPhone: { contains: search as string, mode: 'insensitive' } },
                { senderName: { contains: search as string, mode: 'insensitive' } }
            ];
        }

        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const [parcels, total] = await Promise.all([
            prisma.parcel.findMany({
                where,
                skip,
                take: parseInt(limit as string),
                orderBy: { createdAt: 'desc' },
                include: {
                    warehouse: true,
                    notifications: {
                        take: 5,
                        orderBy: { sentAt: 'desc' }
                    }
                }
            }),
            prisma.parcel.count({ where })
        ]);

        res.json({
            parcels,
            pagination: {
                total,
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                totalPages: Math.ceil(total / parseInt(limit as string))
            }
        });
    } catch (error) {
        console.error('Error fetching parcels:', error);
        res.status(500).json({ error: 'Erro ao listar encomendas' });
    }
});

// Get parcel by tracking number (public)
router.get('/parcels/track/:trackingNumber', async (req: Request, res: Response) => {
    try {
        const { trackingNumber } = req.params;

        const parcel = await prisma.parcel.findFirst({
            where: { trackingNumber },
            select: {
                trackingNumber: true,
                status: true,
                receivedAt: true,
                expectedPickup: true,
                pickedUpAt: true,
                description: true,
                warehouse: {
                    select: { name: true, location: true }
                }
            }
        });

        if (!parcel) {
            return res.status(404).json({ error: 'Encomenda não encontrada' });
        }

        res.json(parcel);
    } catch (error) {
        console.error('Error tracking parcel:', error);
        res.status(500).json({ error: 'Erro ao rastrear encomenda' });
    }
});

router.get('/parcels/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        const parcel = await prisma.parcel.findFirst({
            where: { id, companyId },
            include: {
                warehouse: true,
                notifications: {
                    orderBy: { sentAt: 'desc' }
                }
            }
        });

        if (!parcel) {
            return res.status(404).json({ error: 'Encomenda não encontrada' });
        }

        res.json(parcel);
    } catch (error) {
        console.error('Error fetching parcel:', error);
        res.status(500).json({ error: 'Erro ao obter encomenda' });
    }
});

router.post('/parcels', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        if (!companyId) {
            return res.status(403).json({ error: 'Company ID não encontrado' });
        }

        const data = parcelSchema.parse(req.body);
        const trackingNumber = generateTrackingNumber();

        const parcel = await prisma.parcel.create({
            data: {
                trackingNumber,
                senderName: data.senderName,
                senderPhone: data.senderPhone,
                senderEmail: data.senderEmail,
                senderAddress: data.senderAddress,
                recipientName: data.recipientName,
                recipientPhone: data.recipientPhone,
                recipientEmail: data.recipientEmail,
                recipientAddress: data.recipientAddress,
                recipientDocument: data.recipientDocument,
                description: data.description,
                weight: data.weight,
                dimensions: data.dimensions,
                warehouseId: data.warehouseId,
                storageLocation: data.storageLocation,
                expectedPickup: data.expectedPickup ? new Date(data.expectedPickup) : null,
                fees: data.fees,
                notes: data.notes,
                status: 'received',
                companyId
            },
            include: {
                warehouse: true
            }
        });

        res.status(201).json(parcel);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error creating parcel:', error);
        res.status(500).json({ error: 'Erro ao criar encomenda' });
    }
});

router.put('/parcels/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const data = parcelSchema.partial().parse(req.body);

        const existing = await prisma.parcel.findFirst({
            where: { id, companyId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Encomenda não encontrada' });
        }

        const parcel = await prisma.parcel.update({
            where: { id },
            data: {
                ...data,
                expectedPickup: data.expectedPickup ? new Date(data.expectedPickup) : undefined
            },
            include: {
                warehouse: true
            }
        });

        res.json(parcel);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error updating parcel:', error);
        res.status(500).json({ error: 'Erro ao actualizar encomenda' });
    }
});

// Register parcel pickup
router.post('/parcels/:id/pickup', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const { pickedUpBy, pickedUpDocument, pickupSignature, paymentMethod, isPaid, receiverRelationship, paidAmount } = req.body;

        const existing = await prisma.parcel.findFirst({
            where: { id, companyId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Encomenda não encontrada' });
        }

        if (existing.status === 'picked_up') {
            return res.status(400).json({ error: 'Encomenda já foi levantada' });
        }

        // Handle financial transaction if paid
        let transactionId: string | undefined;
        if (isPaid && (paidAmount || existing.fees > 0)) {
            const transaction = await prisma.transaction.create({
                data: {
                    type: 'income',
                    category: 'logistics',
                    description: `Levantamento de Encomenda: ${existing.trackingNumber}`,
                    amount: paidAmount || existing.fees,
                    date: new Date(),
                    status: 'completed',
                    paymentMethod: (paymentMethod as any) || 'cash',
                    companyId,
                    module: 'logistics',
                    parcelId: id
                }
            });
            transactionId = transaction.id;
        }

        const parcel = await prisma.parcel.update({
            where: { id },
            data: {
                status: 'picked_up',
                pickedUpAt: new Date(),
                pickedUpBy,
                pickedUpDocument,
                pickupSignature,
                paymentMethod,
                isPaid: isPaid ?? true,
                receiverRelationship,
                transactionId
            },
            include: {
                warehouse: true
            }
        });

        res.json(parcel);
    } catch (error) {
        console.error('Error registering parcel pickup:', error);
        res.status(500).json({ error: 'Erro ao registar levantamento' });
    }
});

// Update parcel status
router.put('/parcels/:id/status', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const { status } = req.body;

        const existing = await prisma.parcel.findFirst({
            where: { id, companyId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Encomenda não encontrada' });
        }

        const parcel = await prisma.parcel.update({
            where: { id },
            data: { status },
            include: {
                warehouse: true
            }
        });

        res.json(parcel);
    } catch (error) {
        console.error('Error updating parcel status:', error);
        res.status(500).json({ error: 'Erro ao actualizar estado da encomenda' });
    }
});

// Send notification for parcel
router.post('/parcels/:id/notify', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;
        const { type, recipient, message } = req.body;

        const existing = await prisma.parcel.findFirst({
            where: { id, companyId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Encomenda não encontrada' });
        }

        const notification = await prisma.parcelNotification.create({
            data: {
                parcelId: id,
                type: type || 'sms',
                recipient: recipient || existing.recipientPhone,
                message,
                status: 'sent' // In production, this would be set after actual sending
            }
        });

        // TODO: Integrate with SMS/Email service to actually send notification

        res.json(notification);
    } catch (error) {
        console.error('Error sending parcel notification:', error);
        res.status(500).json({ error: 'Erro ao enviar notificação' });
    }
});

router.delete('/parcels/:id', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { id } = req.params;

        const existing = await prisma.parcel.findFirst({
            where: { id, companyId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'Encomenda não encontrada' });
        }

        await prisma.parcel.delete({ where: { id } });

        res.json({ message: 'Encomenda eliminada com sucesso' });
    } catch (error) {
        console.error('Error deleting parcel:', error);
        res.status(500).json({ error: 'Erro ao eliminar encomenda' });
    }
});

// ============================================================================
// VEHICLE MAINTENANCE
// ============================================================================

const maintenanceSchema = z.object({
    vehicleId: z.string(),
    type: z.enum(['preventive', 'corrective', 'inspection', 'emergency']).default('preventive'),
    description: z.string().min(1, 'Descrição obrigatória'),
    cost: z.number().min(0),
    date: z.string().optional(),
    nextDate: z.string().optional().nullable(),
    mileageAt: z.number().optional().nullable(),
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).default('scheduled'),
    provider: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
});

router.get('/maintenances', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const { vehicleId, status, page = '1', limit = '20' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};
        if (vehicleId) where.vehicleId = vehicleId;
        if (status) where.status = status;

        // Filter by company's vehicles
        if (companyId) {
            where.vehicle = { companyId };
        }

        const [maintenances, total] = await Promise.all([
            prisma.vehicleMaintenance.findMany({
                where,
                skip: skip,
                take: limitNum,
                orderBy: { date: 'desc' },
                include: {
                    vehicle: true
                }
            }),
            prisma.vehicleMaintenance.count({ where })
        ]);

        res.json({
            data: maintenances,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
                hasMore: skip + maintenances.length < total
            }
        });
    } catch (error) {
        logger.error('Error fetching maintenances:', error);
        res.status(500).json({ error: 'Erro ao listar manutenções' });
    }
});

router.post('/maintenances', async (req: Request, res: Response) => {
    try {
        const companyId = req.user?.companyId;
        const data = maintenanceSchema.parse(req.body);

        // Verify vehicle belongs to company
        const vehicle = await prisma.vehicle.findFirst({
            where: { id: data.vehicleId, companyId }
        });

        if (!vehicle) {
            return res.status(404).json({ error: 'Veículo não encontrado' });
        }

        const maintenance = await prisma.vehicleMaintenance.create({
            data: {
                vehicleId: data.vehicleId,
                type: data.type,
                description: data.description,
                cost: data.cost,
                date: data.date ? new Date(data.date) : new Date(),
                nextDate: data.nextDate ? new Date(data.nextDate) : null,
                mileageAt: data.mileageAt,
                status: data.status,
                provider: data.provider,
                notes: data.notes
            },
            include: {
                vehicle: true
            }
        });

        // Professional Fiscal Integration: Create Expense Transaction
        if (data.cost > 0 && (data.status === 'completed' || data.status === 'in_progress')) {
            await prisma.transaction.create({
                data: {
                    type: 'expense',
                    category: 'maintenance',
                    description: `Manutenção ${data.type}: ${vehicle.plate} - ${data.description}`,
                    amount: data.cost,
                    date: maintenance.date,
                    status: data.status === 'completed' ? 'completed' : 'pending',
                    companyId,
                    module: 'logistics',
                    reference: vehicle.plate
                }
            });
        }

        // Update vehicle maintenance dates
        await prisma.vehicle.update({
            where: { id: data.vehicleId },
            data: {
                lastMaintenance: maintenance.date,
                nextMaintenance: maintenance.nextDate,
                mileage: data.mileageAt ?? vehicle.mileage
            }
        });

        res.status(201).json(maintenance);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error creating maintenance:', error);
        res.status(500).json({ error: 'Erro ao criar manutenção' });
    }
});

router.put('/maintenances/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const data = maintenanceSchema.partial().parse(req.body);

        const maintenance = await prisma.vehicleMaintenance.update({
            where: { id },
            data: {
                ...data,
                date: data.date ? new Date(data.date) : undefined,
                nextDate: data.nextDate ? new Date(data.nextDate) : undefined
            },
            include: {
                vehicle: true
            }
        });

        res.json(maintenance);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error('Error updating maintenance:', error);
        res.status(500).json({ error: 'Erro ao actualizar manutenção' });
    }
});

router.delete('/maintenances/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.vehicleMaintenance.delete({ where: { id } });

        res.json({ message: 'Manutenção eliminada com sucesso' });
    } catch (error) {
        console.error('Error deleting maintenance:', error);
        res.status(500).json({ error: 'Erro ao eliminar manutenção' });
    }
});

export default router;
