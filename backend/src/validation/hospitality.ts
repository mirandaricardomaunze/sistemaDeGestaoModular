/**
 * Validation Schemas - Hospitality
 * 
 * Schemas for hotel rooms, reservations, guests, and related operations.
 */

import { z } from 'zod';

// ============================================================================
// Room Schemas
// ============================================================================

export const createRoomSchema = z.object({
    number: z.string().min(1, 'Número do quarto obrigatório').max(20, 'Número muito longo'),
    name: z.string().max(100, 'Nome muito longo').optional().nullable(),
    type: z.enum(['single', 'double', 'twin', 'suite', 'deluxe', 'presidential', 'family']),
    floor: z.number().int().optional().nullable(),
    capacity: z.number().int().positive('Capacidade deve ser maior que zero').optional().default(2),
    pricePerNight: z.number().positive('Preço deve ser maior que zero'),
    description: z.string().max(1000, 'Descrição muito longa').optional().nullable(),
    amenities: z.array(z.string().max(50)).max(20, 'Máximo de 20 comodidades').optional(),
    images: z.array(z.string().url('URL da imagem inválida')).max(10, 'Máximo de 10 imagens').optional(),
    isActive: z.boolean().optional().default(true)
});

export const updateRoomSchema = createRoomSchema.partial();

export const updateRoomStatusSchema = z.object({
    status: z.enum(['available', 'occupied', 'maintenance', 'cleaning', 'reserved'], {
        message: 'Status inválido'
    }),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

// ============================================================================
// Guest Schemas
// ============================================================================

export const createGuestSchema = z.object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200, 'Nome muito longo'),
    email: z.string().email('Email inválido').optional().nullable(),
    phone: z.string().max(50, 'Telefone muito longo').optional().nullable(),
    documentType: z.enum(['bi', 'passport', 'dire', 'other']).optional().default('bi'),
    documentNumber: z.string().max(50, 'Número do documento muito longo').optional().nullable(),
    nationality: z.string().max(100, 'Nacionalidade muito longa').optional().nullable(),
    birthDate: z.string().datetime({ message: 'Data de nascimento inválida' }).optional().nullable(),
    address: z.string().max(500, 'Endereço muito longo').optional().nullable(),
    city: z.string().max(100, 'Cidade muito longa').optional().nullable(),
    country: z.string().max(100, 'País muito longo').optional().nullable(),
    vipStatus: z.boolean().optional().default(false),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable(),
    preferences: z.record(z.string(), z.unknown()).optional()
});

export const updateGuestSchema = createGuestSchema.partial();

// ============================================================================
// Reservation Schemas
// ============================================================================

export const createReservationSchema = z.object({
    guestId: z.string().uuid('ID do hóspede inválido').optional().nullable(),
    guestName: z.string().max(200, 'Nome do hóspede muito longo').optional().nullable(),
    guestEmail: z.string().email('Email inválido').optional().nullable(),
    guestPhone: z.string().max(50, 'Telefone muito longo').optional().nullable(),
    roomId: z.string().uuid('ID do quarto inválido'),
    checkIn: z.string().datetime({ message: 'Data de check-in inválida' }),
    checkOut: z.string().datetime({ message: 'Data de check-out inválida' }),
    adults: z.number().int().positive('Número de adultos deve ser maior que zero').optional().default(1),
    children: z.number().int().min(0, 'Número de crianças não pode ser negativo').optional().default(0),
    pricePerNight: z.number().positive('Preço por noite deve ser maior que zero'),
    totalPrice: z.number().positive('Preço total deve ser maior que zero'),
    discount: z.number().min(0, 'Desconto não pode ser negativo').optional().default(0),
    deposit: z.number().min(0, 'Depósito não pode ser negativo').optional().default(0),
    source: z.enum(['direct', 'booking', 'expedia', 'airbnb', 'phone', 'walkin', 'other']).optional().default('direct'),
    specialRequests: z.string().max(1000, 'Pedidos especiais muito longos').optional().nullable(),
    notes: z.string().max(1000, 'Notas muito longas').optional().nullable()
}).refine(
    (data) => new Date(data.checkIn) < new Date(data.checkOut),
    { message: 'Check-in deve ser anterior ao check-out' }
);

export const updateReservationSchema = createReservationSchema.partial();

export const updateReservationStatusSchema = z.object({
    status: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'], {
        message: 'Status inválido'
    }),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

// ============================================================================
// Housekeeping Schemas
// ============================================================================

export const createHousekeepingTaskSchema = z.object({
    roomId: z.string().uuid('ID do quarto inválido'),
    type: z.enum(['cleaning', 'maintenance', 'inspection', 'turndown', 'deep_clean']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
    assignedTo: z.string().uuid('ID do funcionário inválido').optional().nullable(),
    scheduledFor: z.string().datetime({ message: 'Data agendada inválida' }).optional().nullable(),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

export const updateHousekeepingTaskSchema = z.object({
    status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
    completedAt: z.string().datetime({ message: 'Data de conclusão inválida' }).optional().nullable(),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

// ============================================================================
// Room Charge Schemas
// ============================================================================

export const createRoomChargeSchema = z.object({
    reservationId: z.string().uuid('ID da reserva inválido'),
    description: z.string().min(2, 'Descrição obrigatória').max(200, 'Descrição muito longa'),
    amount: z.number().positive('Valor deve ser maior que zero'),
    category: z.enum(['room_service', 'minibar', 'laundry', 'spa', 'restaurant', 'parking', 'other']).optional().default('other'),
    quantity: z.number().int().positive('Quantidade deve ser maior que zero').optional().default(1),
    notes: z.string().max(500, 'Notas muito longas').optional().nullable()
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type CreateHousekeepingTaskInput = z.infer<typeof createHousekeepingTaskSchema>;
export type CreateRoomChargeInput = z.infer<typeof createRoomChargeSchema>;
