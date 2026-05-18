import { AccountNature, AccountType, JournalEntryStatus } from '@prisma/client';
import { z } from 'zod';

export const AccountSchema = z.object({
    code: z.string().min(1).max(30),
    name: z.string().min(2).max(200),
    type: z.nativeEnum(AccountType),
    nature: z.nativeEnum(AccountNature),
    parentId: z.string().uuid().optional().nullable(),
    level: z.number().int().min(1).max(6).optional().default(1),
    allowsEntries: z.boolean().optional().default(true),
    isActive: z.boolean().optional().default(true)
});

export const JournalLineSchema = z.object({
    debitAccountId: z.string().uuid().optional().nullable(),
    creditAccountId: z.string().uuid().optional().nullable(),
    amount: z.number().positive('Valor deve ser positivo'),
    description: z.string().max(500).optional().nullable()
}).refine(
    (line) => Boolean(line.debitAccountId) !== Boolean(line.creditAccountId),
    'Cada linha deve ter uma conta de debito ou uma conta de credito, nao ambas'
);

export const JournalEntrySchema = z.object({
    date: z.coerce.date(),
    description: z.string().min(3).max(500),
    reference: z.string().max(100).optional().nullable(),
    status: z.nativeEnum(JournalEntryStatus).optional().default(JournalEntryStatus.POSTED),
    lines: z.array(JournalLineSchema).min(2, 'Lancamento deve ter pelo menos duas linhas')
});

export const ReportPeriodSchema = z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date()
}).refine((period) => period.startDate <= period.endDate, {
    message: 'Data inicial deve ser anterior a data final',
    path: ['startDate']
});

export const BalanceSheetQuerySchema = z.object({
    asOfDate: z.coerce.date()
});

export type AccountInput = z.infer<typeof AccountSchema>;
export type JournalEntryInput = z.infer<typeof JournalEntrySchema>;
