import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// ============================================================================
// ALERT TYPES AND PRIORITIES
// ============================================================================

export const ALERT_MODULES = ['pos', 'hospitality', 'pharmacy', 'crm', 'invoices', 'inventory'] as const;
export type AlertModule = typeof ALERT_MODULES[number];

export const ALERT_TYPES = {
    // Inventory
    low_stock: 'low_stock',
    out_of_stock: 'out_of_stock',
    expired_product: 'expired_product',
    expiring_soon: 'expiring_soon',

    // Invoices
    payment_due: 'payment_due',
    payment_overdue: 'payment_overdue',

    // Hospitality
    checkout_today: 'checkout_today',
    checkout_overdue: 'checkout_overdue',
    room_cleaning_required: 'room_cleaning_required',
    booking_pending: 'booking_pending',

    // Pharmacy
    controlled_medication_low: 'controlled_medication_low',
    prescription_pending: 'prescription_pending',
    batch_expiring: 'batch_expiring',

    // CRM
    opportunity_stale: 'opportunity_stale',
    follow_up_due: 'follow_up_due',

    // POS
    cash_drawer_open: 'cash_drawer_open',
    daily_close_pending: 'daily_close_pending',

    // General
    system: 'system',
    custom: 'custom'
} as const;

export const ALERT_PRIORITIES = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low'
} as const;

// ============================================================================
// GET ALERTS
// ============================================================================

// Get all alerts with module filtering
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { type, module, priority, isRead, isResolved, limit = 50 } = req.query;

        const where: Record<string, unknown> = {
            companyId: req.companyId
        };

        if (type) where.type = type;
        if (module) where.module = module;
        if (priority) where.priority = priority;
        if (isRead !== undefined) where.isRead = isRead === 'true';
        if (isResolved !== undefined) where.isResolved = isResolved === 'true';

        const alerts = await prisma.alert.findMany({
            where,
            orderBy: [
                { isResolved: 'asc' },
                { priority: 'asc' },
                { createdAt: 'desc' }
            ],
            take: parseInt(String(limit))
        });

        res.json(alerts);
    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({ error: 'Erro ao buscar alertas' });
    }
});

// Get unread alerts count with module breakdown
router.get('/unread-count', authenticate, async (req: AuthRequest, res) => {
    try {
        const { module } = req.query;

        const where: any = {
            companyId: req.companyId,
            isRead: false,
            isResolved: false
        };

        if (module) where.module = module;

        const total = await prisma.alert.count({ where });

        const byPriority = await prisma.alert.groupBy({
            by: ['priority'],
            where,
            _count: true
        });

        const byModule = await prisma.alert.groupBy({
            by: ['module'],
            where: { companyId: req.companyId, isRead: false, isResolved: false },
            _count: true
        });

        res.json({
            total,
            byPriority: byPriority.reduce((acc: Record<string, number>, item: { priority: string | null; _count: number }) => {
                acc[item.priority || 'medium'] = item._count;
                return acc;
            }, {}),
            byModule: byModule.reduce((acc: Record<string, number>, item) => {
                acc[item.module || 'general'] = item._count;
                return acc;
            }, {})
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Erro ao contar alertas' });
    }
});

// Get alerts summary for dashboard
router.get('/summary', authenticate, async (req: AuthRequest, res) => {
    try {
        const baseWhere = {
            companyId: req.companyId,
            isResolved: false
        };

        const [total, unread, critical, high] = await Promise.all([
            prisma.alert.count({ where: baseWhere }),
            prisma.alert.count({ where: { ...baseWhere, isRead: false } }),
            prisma.alert.count({ where: { ...baseWhere, priority: 'critical' } }),
            prisma.alert.count({ where: { ...baseWhere, priority: 'high' } })
        ]);

        const recentAlerts = await prisma.alert.findMany({
            where: { ...baseWhere, isRead: false },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        res.json({
            total,
            unread,
            critical,
            high,
            recentAlerts
        });
    } catch (error) {
        console.error('Get alerts summary error:', error);
        res.status(500).json({ error: 'Erro ao obter resumo de alertas' });
    }
});

// ============================================================================
// ALERT ACTIONS
// ============================================================================

// Create alert
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { type, priority, title, message, module, relatedId, relatedType, actionUrl, metadata } = req.body;

        const alert = await prisma.alert.create({
            data: {
                type,
                priority: priority || 'medium',
                title,
                message,
                module,
                relatedId,
                relatedType,
                actionUrl,
                metadata,
                companyId: req.companyId
            }
        });

        res.status(201).json(alert);
    } catch (error) {
        console.error('Create alert error:', error);
        res.status(500).json({ error: 'Erro ao criar alerta' });
    }
});

// Mark alert as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res) => {
    try {
        const result = await prisma.alert.updateMany({
            where: { id: req.params.id, companyId: req.companyId },
            data: { isRead: true }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Alerta não encontrado' });
        }

        res.json({ message: 'Alerta marcado como lido' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Erro ao marcar como lido' });
    }
});

// Mark all alerts as read (optionally by module)
router.patch('/read-all', authenticate, async (req: AuthRequest, res) => {
    try {
        const { module } = req.body;

        const where: any = {
            companyId: req.companyId,
            isRead: false
        };

        if (module) where.module = module;

        const result = await prisma.alert.updateMany({
            where,
            data: { isRead: true }
        });

        res.json({
            message: 'Alertas marcados como lidos',
            count: result.count
        });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Erro ao marcar todos como lidos' });
    }
});

// Resolve alert
router.patch('/:id/resolve', authenticate, async (req: AuthRequest, res) => {
    try {
        const result = await prisma.alert.updateMany({
            where: { id: req.params.id, companyId: req.companyId },
            data: {
                isResolved: true,
                resolvedAt: new Date()
            }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Alerta não encontrado' });
        }

        res.json({ message: 'Alerta resolvido' });
    } catch (error) {
        console.error('Resolve alert error:', error);
        res.status(500).json({ error: 'Erro ao resolver alerta' });
    }
});

// Delete alert
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const result = await prisma.alert.deleteMany({
            where: { id: req.params.id, companyId: req.companyId }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Alerta não encontrado' });
        }

        res.json({ message: 'Alerta removido' });
    } catch (error) {
        console.error('Delete alert error:', error);
        res.status(500).json({ error: 'Erro ao remover alerta' });
    }
});

// Clear resolved alerts
router.delete('/clear/resolved', authenticate, async (req: AuthRequest, res) => {
    try {
        const result = await prisma.alert.deleteMany({
            where: {
                companyId: req.companyId,
                isResolved: true
            }
        });

        res.json({
            message: 'Alertas resolvidos removidos',
            count: result.count
        });
    } catch (error) {
        console.error('Clear resolved alerts error:', error);
        res.status(500).json({ error: 'Erro ao limpar alertas resolvidos' });
    }
});

// ============================================================================
// ALERT GENERATORS
// ============================================================================

// Generate all alerts
router.post('/generate', authenticate, async (req: AuthRequest, res) => {
    try {
        const alerts: unknown[] = [];

        // Generate inventory alerts
        const inventoryAlerts = await generateInventoryAlerts(req.companyId!);
        alerts.push(...inventoryAlerts);

        // Generate invoice alerts
        const invoiceAlerts = await generateInvoiceAlerts(req.companyId!);
        alerts.push(...invoiceAlerts);

        // Generate hospitality alerts
        const hospitalityAlerts = await generateHospitalityAlerts(req.companyId!);
        alerts.push(...hospitalityAlerts);

        res.json({
            generated: alerts.length,
            alerts,
            byModule: {
                inventory: inventoryAlerts.length,
                invoices: invoiceAlerts.length,
                hospitality: hospitalityAlerts.length
            }
        });
    } catch (error) {
        console.error('Generate alerts error:', error);
        res.status(500).json({ error: 'Erro ao gerar alertas' });
    }
});

// Generate alerts for a specific module
router.post('/generate/:module', authenticate, async (req: AuthRequest, res) => {
    try {
        const { module } = req.params;
        let alerts: unknown[] = [];

        switch (module) {
            case 'inventory':
                alerts = await generateInventoryAlerts(req.companyId!);
                break;
            case 'invoices':
                alerts = await generateInvoiceAlerts(req.companyId!);
                break;
            case 'hospitality':
                alerts = await generateHospitalityAlerts(req.companyId!);
                break;
            case 'pharmacy':
                alerts = await generatePharmacyAlerts(req.companyId!);
                break;
            case 'crm':
                alerts = await generateCRMAlerts(req.companyId!);
                break;
            default:
                return res.status(400).json({ error: `Módulo inválido: ${module}` });
        }

        res.json({
            module,
            generated: alerts.length,
            alerts
        });
    } catch (error) {
        console.error(`Generate ${req.params.module} alerts error:`, error);
        res.status(500).json({ error: 'Erro ao gerar alertas' });
    }
});

// ============================================================================
// ALERT GENERATOR FUNCTIONS
// ============================================================================

async function generateInventoryAlerts(companyId: string): Promise<unknown[]> {
    const alerts: unknown[] = [];

    // Get products with low or zero stock
    const products = await prisma.product.findMany({
        where: { isActive: true, companyId }
    });

    for (const product of products) {
        // Check for out of stock
        if (product.currentStock === 0) {
            const existing = await prisma.alert.findFirst({
                where: {
                    type: 'out_of_stock',
                    relatedId: product.id,
                    isResolved: false,
                    companyId
                }
            });

            if (!existing) {
                const alert = await prisma.alert.create({
                    data: {
                        type: 'out_of_stock',
                        priority: 'critical',
                        title: `Stock esgotado: ${product.name}`,
                        message: `O produto ${product.name} (${product.code}) está sem stock.`,
                        module: 'inventory',
                        relatedId: product.id,
                        relatedType: 'product',
                        actionUrl: `/inventory/products/${product.id}`,
                        companyId
                    }
                });
                alerts.push(alert);
            }
        }
        // Check for low stock
        else if (product.currentStock <= product.minStock) {
            const existing = await prisma.alert.findFirst({
                where: {
                    type: 'low_stock',
                    relatedId: product.id,
                    isResolved: false,
                    companyId
                }
            });

            if (!existing) {
                const alert = await prisma.alert.create({
                    data: {
                        type: 'low_stock',
                        priority: 'high',
                        title: `Stock baixo: ${product.name}`,
                        message: `${product.name} tem apenas ${product.currentStock} unidades (mínimo: ${product.minStock}).`,
                        module: 'inventory',
                        relatedId: product.id,
                        relatedType: 'product',
                        actionUrl: `/inventory/products/${product.id}`,
                        companyId
                    }
                });
                alerts.push(alert);
            }
        }

        // Check for expiring products (next 30 days)
        if (product.expiryDate) {
            const daysUntilExpiry = Math.ceil(
                (product.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );

            if (daysUntilExpiry > 0 && daysUntilExpiry <= 30) {
                const existing = await prisma.alert.findFirst({
                    where: {
                        type: 'expiring_soon',
                        relatedId: product.id,
                        isResolved: false,
                        companyId
                    }
                });

                if (!existing) {
                    const alert = await prisma.alert.create({
                        data: {
                            type: 'expiring_soon',
                            priority: daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 14 ? 'high' : 'medium',
                            title: `Produto a expirar: ${product.name}`,
                            message: `${product.name} expira em ${daysUntilExpiry} dias (${product.expiryDate.toLocaleDateString('pt-MZ')}).`,
                            module: 'inventory',
                            relatedId: product.id,
                            relatedType: 'product',
                            actionUrl: `/inventory/products/${product.id}`,
                            metadata: { daysUntilExpiry, expiryDate: product.expiryDate },
                            companyId
                        }
                    });
                    alerts.push(alert);
                }
            }
        }
    }

    return alerts;
}

async function generateInvoiceAlerts(companyId: string): Promise<unknown[]> {
    const alerts: unknown[] = [];
    const now = new Date();

    // Check overdue invoices
    const overdueInvoices = await prisma.invoice.findMany({
        where: {
            companyId,
            status: { in: ['sent', 'partial'] },
            dueDate: { lt: now },
            amountDue: { gt: 0 }
        }
    });

    for (const invoice of overdueInvoices) {
        const existing = await prisma.alert.findFirst({
            where: {
                type: 'payment_overdue',
                relatedId: invoice.id,
                isResolved: false,
                companyId
            }
        });

        if (!existing) {
            const daysOverdue = Math.ceil(
                (now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            const alert = await prisma.alert.create({
                data: {
                    type: 'payment_overdue',
                    priority: daysOverdue > 30 ? 'critical' : daysOverdue > 14 ? 'high' : 'medium',
                    title: `Fatura vencida: ${invoice.invoiceNumber}`,
                    message: `Fatura de ${invoice.customerName} vencida há ${daysOverdue} dias. Valor: ${Number(invoice.amountDue).toLocaleString('pt-MZ')} MT`,
                    module: 'invoices',
                    relatedId: invoice.id,
                    relatedType: 'invoice',
                    actionUrl: `/invoices/${invoice.id}`,
                    metadata: { daysOverdue, amountDue: invoice.amountDue },
                    companyId
                }
            });
            alerts.push(alert);
        }
    }

    // Check invoices due soon (next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const dueSoonInvoices = await prisma.invoice.findMany({
        where: {
            companyId,
            status: { in: ['sent', 'partial'] },
            dueDate: { gte: now, lte: sevenDaysFromNow },
            amountDue: { gt: 0 }
        }
    });

    for (const invoice of dueSoonInvoices) {
        const existing = await prisma.alert.findFirst({
            where: {
                type: 'payment_due',
                relatedId: invoice.id,
                isResolved: false,
                companyId
            }
        });

        if (!existing) {
            const daysToDue = Math.ceil(
                (invoice.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            const alert = await prisma.alert.create({
                data: {
                    type: 'payment_due',
                    priority: daysToDue <= 2 ? 'high' : 'medium',
                    title: `Fatura a vencer: ${invoice.invoiceNumber}`,
                    message: `Fatura de ${invoice.customerName} vence em ${daysToDue} dias. Valor: ${Number(invoice.amountDue).toLocaleString('pt-MZ')} MT`,
                    module: 'invoices',
                    relatedId: invoice.id,
                    relatedType: 'invoice',
                    actionUrl: `/invoices/${invoice.id}`,
                    metadata: { daysToDue, amountDue: invoice.amountDue },
                    companyId
                }
            });
            alerts.push(alert);
        }
    }

    return alerts;
}

async function generateHospitalityAlerts(companyId: string): Promise<unknown[]> {
    const alerts: unknown[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check today's checkouts
    const todayCheckouts = await prisma.booking.findMany({
        where: {
            companyId,
            status: 'checked_in',
            expectedCheckout: { gte: today, lt: tomorrow }
        },
        include: { room: true }
    });

    for (const booking of todayCheckouts) {
        const existing = await prisma.alert.findFirst({
            where: {
                type: 'checkout_today',
                relatedId: booking.id,
                isResolved: false,
                companyId
            }
        });

        if (!existing) {
            const checkoutTime = booking.expectedCheckout
                ? new Date(booking.expectedCheckout).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })
                : '12:00';

            const alert = await prisma.alert.create({
                data: {
                    type: 'checkout_today',
                    priority: 'medium',
                    title: `Check-out hoje: Q-${booking.room.number}`,
                    message: `${booking.customerName} - Check-out previsto às ${checkoutTime}`,
                    module: 'hospitality',
                    relatedId: booking.id,
                    relatedType: 'booking',
                    actionUrl: `/hospitality/bookings/${booking.id}`,
                    metadata: { roomNumber: booking.room.number, customerName: booking.customerName },
                    companyId
                }
            });
            alerts.push(alert);
        }
    }

    // Check overdue checkouts (past expected checkout time)
    const overdueCheckouts = await prisma.booking.findMany({
        where: {
            companyId,
            status: 'checked_in',
            expectedCheckout: { lt: now }
        },
        include: { room: true }
    });

    for (const booking of overdueCheckouts) {
        const existing = await prisma.alert.findFirst({
            where: {
                type: 'checkout_overdue',
                relatedId: booking.id,
                isResolved: false,
                companyId
            }
        });

        if (!existing) {
            const alert = await prisma.alert.create({
                data: {
                    type: 'checkout_overdue',
                    priority: 'high',
                    title: `Check-out atrasado: Q-${booking.room.number}`,
                    message: `${booking.customerName} deveria ter feito check-out mas ainda está hospedado.`,
                    module: 'hospitality',
                    relatedId: booking.id,
                    relatedType: 'booking',
                    actionUrl: `/hospitality/bookings/${booking.id}`,
                    companyId
                }
            });
            alerts.push(alert);
        }
    }

    // Check rooms needing cleaning
    const roomsNeedingCleaning = await prisma.room.findMany({
        where: {
            companyId,
            status: 'dirty'
        }
    });

    for (const room of roomsNeedingCleaning) {
        const existing = await prisma.alert.findFirst({
            where: {
                type: 'room_cleaning_required',
                relatedId: room.id,
                isResolved: false,
                companyId
            }
        });

        if (!existing) {
            const alert = await prisma.alert.create({
                data: {
                    type: 'room_cleaning_required',
                    priority: 'medium',
                    title: `Limpeza necessária: Q-${room.number}`,
                    message: `O quarto ${room.number} precisa de limpeza.`,
                    module: 'hospitality',
                    relatedId: room.id,
                    relatedType: 'room',
                    actionUrl: `/hospitality/housekeeping`,
                    companyId
                }
            });
            alerts.push(alert);
        }
    }

    // Check pending bookings
    const pendingBookings = await prisma.booking.findMany({
        where: {
            companyId,
            status: 'pending',
            checkIn: { gte: today, lt: tomorrow }
        },
        include: { room: true }
    });

    for (const booking of pendingBookings) {
        const existing = await prisma.alert.findFirst({
            where: {
                type: 'booking_pending',
                relatedId: booking.id,
                isResolved: false,
                companyId
            }
        });

        if (!existing) {
            const alert = await prisma.alert.create({
                data: {
                    type: 'booking_pending',
                    priority: 'medium',
                    title: `Reserva pendente: Q-${booking.room.number}`,
                    message: `${booking.customerName} tem check-in previsto para hoje.`,
                    module: 'hospitality',
                    relatedId: booking.id,
                    relatedType: 'booking',
                    actionUrl: `/hospitality/bookings/${booking.id}`,
                    companyId
                }
            });
            alerts.push(alert);
        }
    }

    return alerts;
}

async function generatePharmacyAlerts(companyId: string): Promise<unknown[]> {
    const alerts: unknown[] = [];

    // Check controlled medications with low stock
    const controlledMeds = await prisma.medication.findMany({
        where: {
            isControlled: true,
            product: { companyId, isActive: true }
        },
        include: { product: true }
    });

    for (const med of controlledMeds) {
        if (med.product.currentStock <= med.product.minStock) {
            const existing = await prisma.alert.findFirst({
                where: {
                    type: 'controlled_medication_low',
                    relatedId: med.id,
                    isResolved: false,
                    companyId
                }
            });

            if (!existing) {
                const alert = await prisma.alert.create({
                    data: {
                        type: 'controlled_medication_low',
                        priority: 'critical',
                        title: `Medicamento controlado com stock baixo`,
                        message: `${med.product.name} (controlado - ${med.controlLevel}) tem apenas ${med.product.currentStock} unidades.`,
                        module: 'pharmacy',
                        relatedId: med.id,
                        relatedType: 'medication',
                        actionUrl: `/pharmacy/medications/${med.id}`,
                        companyId
                    }
                });
                alerts.push(alert);
            }
        }
    }

    // Check pending prescriptions
    const pendingPrescriptions = await prisma.prescription.findMany({
        where: {
            companyId,
            status: 'pending'
        }
    });

    for (const prescription of pendingPrescriptions) {
        const existing = await prisma.alert.findFirst({
            where: {
                type: 'prescription_pending',
                relatedId: prescription.id,
                isResolved: false,
                companyId
            }
        });

        if (!existing) {
            const alert = await prisma.alert.create({
                data: {
                    type: 'prescription_pending',
                    priority: 'high',
                    title: `Receita pendente: ${prescription.prescriptionNo}`,
                    message: `Receita de ${prescription.patientName} aguarda dispensação.`,
                    module: 'pharmacy',
                    relatedId: prescription.id,
                    relatedType: 'prescription',
                    actionUrl: `/pharmacy/prescriptions/${prescription.id}`,
                    companyId
                }
            });
            alerts.push(alert);
        }
    }

    return alerts;
}

async function generateCRMAlerts(companyId: string): Promise<any[]> {
    const alerts: any[] = [];
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Check stale opportunities (no activity in 7 days)
    const staleOpportunities = await prisma.opportunity.findMany({
        where: {
            companyId,
            closedAt: null,
            updatedAt: { lt: sevenDaysAgo }
        },
        include: { customer: true }
    });

    for (const opp of staleOpportunities) {
        const existing = await prisma.alert.findFirst({
            where: {
                type: 'opportunity_stale',
                relatedId: opp.id,
                isResolved: false,
                companyId
            }
        });

        if (!existing) {
            const daysSinceUpdate = Math.ceil(
                (now.getTime() - opp.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
            );

            const alert = await prisma.alert.create({
                data: {
                    type: 'opportunity_stale',
                    priority: daysSinceUpdate > 14 ? 'high' : 'medium',
                    title: `Oportunidade parada: ${opp.title}`,
                    message: `Sem atividade há ${daysSinceUpdate} dias. Valor: ${Number(opp.value).toLocaleString('pt-MZ')} MT`,
                    module: 'crm',
                    relatedId: opp.id,
                    relatedType: 'opportunity',
                    actionUrl: `/crm/opportunities/${opp.id}`,
                    metadata: { daysSinceUpdate, value: opp.value },
                    companyId
                }
            });
            alerts.push(alert);
        }
    }

    return alerts;
}

export default router;
