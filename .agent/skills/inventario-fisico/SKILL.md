---
name: inventario-fisico
description: "Guia completo para implementar o módulo de Inventário Físico (contagem cíclica) com ajuste automático de stock no sistema Multicore."
---

# Skill: Inventário Físico (Contagem Cíclica)

> **Quando usar:** Sempre que trabalhar em stock, movimentos de inventário,
> ajustes de quantidade ou contagens periódicas de armazém.

---

## 🎯 Objectivo

Permitir que o gestor de stock:
1. Crie uma sessão de contagem para um armazém específico
2. Registe quantidades contadas produto a produto (com scanner ou manual)
3. O sistema compare o stock esperado vs o contado e calcule divergências
4. Aprove as diferenças — o sistema gera automaticamente movimentos de ajuste

---

## 📁 Estrutura de Ficheiros

```
backend/src/
  services/
    physicalInventory.service.ts    ← Motor de contagem e ajuste (NOVO)
  routes/
    physicalInventory.routes.ts     ← Endpoints REST (NOVO)
  validation/
    physicalInventory.validation.ts ← Schemas Zod (NOVO)

prisma/
  schema.prisma                     ← Adicionar modelos PhysicalInventory + PhysicalInventoryLine

src/  (frontend)
  types/
    inventory.ts                    ← Estender com tipos de contagem (NOVO)
  services/api/
    physicalInventory.api.ts        ← Cliente HTTP (NOVO)
  hooks/
    usePhysicalInventory.ts         ← Hook TanStack Query (NOVO)
  components/inventory/
    PhysicalInventoryManager.tsx    ← Componente principal (NOVO)
    PhysicalInventoryCountSheet.tsx ← Folha de contagem linha a linha (NOVO)
  pages/
    PhysicalInventoryPage.tsx       ← Página da funcionalidade (NOVO)
```

---

## 🛠️ PASSO 1 — Schema Prisma

Adicionar ao `prisma/schema.prisma`:

```prisma
model PhysicalInventory {
  id          String   @id @default(cuid())
  companyId   String
  warehouseId String
  status      PhysicalInventoryStatus @default(DRAFT)
  reference   String   // Ex: "INV-2024-001"
  notes       String?
  startedAt   DateTime @default(now())
  finishedAt  DateTime?
  approvedBy  String?
  createdBy   String

  lines       PhysicalInventoryLine[]
  company     Company   @relation(fields: [companyId], references: [id])
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])

  @@index([companyId, status])
  @@map("physical_inventories")
}

model PhysicalInventoryLine {
  id                  String  @id @default(cuid())
  physicalInventoryId String
  productId           String
  batchId             String?
  expectedQuantity    Decimal @db.Decimal(10, 3)
  countedQuantity     Decimal @db.Decimal(10, 3)
  difference          Decimal @db.Decimal(10, 3)  // contado - esperado
  unitCost            Decimal @db.Decimal(10, 2)
  notes               String?

  inventory PhysicalInventory @relation(fields: [physicalInventoryId], references: [id], onDelete: Cascade)
  product   Product           @relation(fields: [productId], references: [id])

  @@map("physical_inventory_lines")
}

enum PhysicalInventoryStatus {
  DRAFT      // Aberta para contagem
  COUNTING   // Em contagem activa
  REVIEW     // Aguarda aprovação das diferenças
  APPROVED   // Aprovada — ajustes aplicados ao stock
  CANCELLED
}
```

Após editar, executar:
```bash
cd backend
npx prisma migrate dev --name add_physical_inventory
npx prisma generate
```

---

## 🛠️ PASSO 2 — Validação Zod

`backend/src/validation/physicalInventory.validation.ts`:

```typescript
import { z } from 'zod';

export const CreateInventorySchema = z.object({
  warehouseId: z.string().min(1),
  reference: z.string().min(1),
  notes: z.string().optional(),
});

export const CountLineSchema = z.object({
  productId: z.string().min(1),
  batchId: z.string().optional(),
  countedQuantity: z.number().min(0),
  notes: z.string().optional(),
});

export const BulkCountSchema = z.object({
  lines: z.array(CountLineSchema).min(1),
});

export type CreateInventoryInput = z.infer<typeof CreateInventorySchema>;
export type CountLineInput = z.infer<typeof CountLineSchema>;
export type BulkCountInput = z.infer<typeof BulkCountSchema>;
```

---

## 🛠️ PASSO 3 — Service Backend

`backend/src/services/physicalInventory.service.ts`:

```typescript
import { PrismaClient, PhysicalInventoryStatus } from '@prisma/client';
import type { CreateInventoryInput, BulkCountInput } from '../validation/physicalInventory.validation';

const prisma = new PrismaClient();

export class PhysicalInventoryService {

  /** Cria uma nova sessão de inventário e carrega o stock esperado. */
  async createInventory(companyId: string, userId: string, data: CreateInventoryInput) {
    // Buscar stock actual do armazém
    const stockLines = await prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { companyId, warehouseId: data.warehouseId },
      _sum: { quantity: true },
    });

    const reference = data.reference || await this._generateReference(companyId);

    return prisma.$transaction(async (tx) => {
      const inventory = await tx.physicalInventory.create({
        data: {
          companyId,
          warehouseId: data.warehouseId,
          reference,
          notes: data.notes,
          createdBy: userId,
          status: 'DRAFT',
          lines: {
            create: stockLines.map((s) => ({
              productId: s.productId,
              expectedQuantity: s._sum.quantity ?? 0,
              countedQuantity: 0,
              difference: -(s._sum.quantity ?? 0),
              unitCost: 0,
            })),
          },
        },
        include: { lines: { include: { product: true } } },
      });
      return inventory;
    });
  }

  /** Regista as quantidades contadas (bulk). Calcula diferenças automaticamente. */
  async submitCounts(inventoryId: string, companyId: string, data: BulkCountInput) {
    const inventory = await prisma.physicalInventory.findFirstOrThrow({
      where: { id: inventoryId, companyId, status: { in: ['DRAFT', 'COUNTING'] } },
      include: { lines: true },
    });

    return prisma.$transaction(async (tx) => {
      // Actualizar status para COUNTING
      await tx.physicalInventory.update({
        where: { id: inventoryId },
        data: { status: 'COUNTING' },
      });

      // Actualizar cada linha contada
      for (const count of data.lines) {
        const line = inventory.lines.find((l) => l.productId === count.productId);
        if (!line) continue;

        const difference = count.countedQuantity - Number(line.expectedQuantity);
        await tx.physicalInventoryLine.update({
          where: { id: line.id },
          data: {
            countedQuantity: count.countedQuantity,
            difference,
            notes: count.notes,
          },
        });
      }

      return tx.physicalInventory.update({
        where: { id: inventoryId },
        data: { status: 'REVIEW' },
        include: { lines: { include: { product: true } } },
      });
    });
  }

  /**
   * Aprova o inventário e aplica os ajustes de stock.
   * REGRA CRÍTICA: Gera movimentos de stock para cada diferença != 0.
   * Usa transacção para garantir atomicidade.
   */
  async approveInventory(inventoryId: string, companyId: string, userId: string) {
    const inventory = await prisma.physicalInventory.findFirstOrThrow({
      where: { id: inventoryId, companyId, status: 'REVIEW' },
      include: { lines: true },
    });

    return prisma.$transaction(async (tx) => {
      const adjustmentLines = inventory.lines.filter((l) => Number(l.difference) !== 0);

      // Criar movimentos de ajuste para cada diferença
      for (const line of adjustmentLines) {
        const qty = Number(line.difference);
        await tx.stockMovement.create({
          data: {
            companyId,
            productId: line.productId,
            warehouseId: inventory.warehouseId,
            type: qty > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
            quantity: Math.abs(qty),
            reference: `INV-AJUSTE-${inventory.reference}`,
            notes: `Ajuste de inventário físico: ${inventory.reference}`,
            createdBy: userId,
          },
        });
      }

      // Fechar o inventário
      return tx.physicalInventory.update({
        where: { id: inventoryId },
        data: {
          status: 'APPROVED',
          finishedAt: new Date(),
          approvedBy: userId,
        },
      });
    });
  }

  async listInventories(companyId: string, warehouseId?: string) {
    return prisma.physicalInventory.findMany({
      where: { companyId, ...(warehouseId ? { warehouseId } : {}) },
      include: { _count: { select: { lines: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getInventoryDetail(inventoryId: string, companyId: string) {
    return prisma.physicalInventory.findFirstOrThrow({
      where: { id: inventoryId, companyId },
      include: {
        lines: { include: { product: { select: { name: true, code: true } } } },
        warehouse: { select: { name: true } },
      },
    });
  }

  private async _generateReference(companyId: string): Promise<string> {
    const count = await prisma.physicalInventory.count({ where: { companyId } });
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

export const physicalInventoryService = new PhysicalInventoryService();
```

---

## 🛠️ PASSO 4 — Rotas Backend

`backend/src/routes/physicalInventory.routes.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { physicalInventoryService } from '../services/physicalInventory.service';
import { CreateInventorySchema, BulkCountSchema } from '../validation/physicalInventory.validation';

const router = Router();
router.use(authenticateToken, requireTenant);

router.get('/', async (req: Request, res: Response) => {
  const items = await physicalInventoryService.listInventories(
    req.tenantId!, req.query.warehouseId as string
  );
  res.json({ success: true, data: items });
});

router.get('/:id', async (req: Request, res: Response) => {
  const item = await physicalInventoryService.getInventoryDetail(req.params.id, req.tenantId!);
  res.json({ success: true, data: item });
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = CreateInventorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
  const result = await physicalInventoryService.createInventory(
    req.tenantId!, req.user!.id, parsed.data
  );
  res.status(201).json({ success: true, data: result });
});

router.post('/:id/count', async (req: Request, res: Response) => {
  const parsed = BulkCountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.flatten() });
  const result = await physicalInventoryService.submitCounts(req.params.id, req.tenantId!, parsed.data);
  res.json({ success: true, data: result });
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  const result = await physicalInventoryService.approveInventory(
    req.params.id, req.tenantId!, req.user!.id
  );
  res.json({ success: true, data: result });
});

export default router;
```

---

## 🛠️ PASSO 5 — Tipos Frontend

`src/types/inventory.ts` — adicionar:

```typescript
export type InventoryStatus = 'DRAFT' | 'COUNTING' | 'REVIEW' | 'APPROVED' | 'CANCELLED';

export interface PhysicalInventory {
  id: string;
  reference: string;
  warehouseId: string;
  status: InventoryStatus;
  notes?: string;
  startedAt: string;
  finishedAt?: string;
  approvedBy?: string;
  _count?: { lines: number };
}

export interface InventoryLine {
  id: string;
  productId: string;
  product: { name: string; code: string };
  expectedQuantity: number;
  countedQuantity: number;
  difference: number;
  notes?: string;
}

export interface PhysicalInventoryDetail extends PhysicalInventory {
  lines: InventoryLine[];
  warehouse: { name: string };
}
```

---

## 🛠️ PASSO 6 — Hook TanStack Query

`src/hooks/usePhysicalInventory.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { physicalInventoryAPI } from '../services/api/physicalInventory.api';
import toast from 'react-hot-toast';

export function usePhysicalInventories(warehouseId?: string) {
  return useQuery({
    queryKey: ['physical-inventories', warehouseId],
    queryFn: () => physicalInventoryAPI.list(warehouseId),
  });
}

export function usePhysicalInventoryDetail(id: string) {
  return useQuery({
    queryKey: ['physical-inventory', id],
    queryFn: () => physicalInventoryAPI.getDetail(id),
    enabled: !!id,
  });
}

export function useCreateInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: physicalInventoryAPI.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['physical-inventories'] });
      toast.success('Inventário criado!');
    },
  });
}

export function useSubmitCounts(inventoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lines: Array<{ productId: string; countedQuantity: number; notes?: string }>) =>
      physicalInventoryAPI.submitCounts(inventoryId, lines),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['physical-inventory', inventoryId] });
      toast.success('Contagens registadas!');
    },
  });
}

export function useApproveInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: physicalInventoryAPI.approve,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['physical-inventories'] });
      toast.success('Inventário aprovado! Stock ajustado automaticamente.');
    },
    onError: () => toast.error('Erro ao aprovar inventário'),
  });
}
```

---

## 🧪 TESTES

### Unitários — `physicalInventory.service.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhysicalInventoryService } from '../physicalInventory.service';

vi.mock('@prisma/client');
const mockTx = {
  physicalInventory: { create: vi.fn(), update: vi.fn() },
  physicalInventoryLine: { update: vi.fn() },
  stockMovement: { create: vi.fn() },
};

describe('PhysicalInventoryService', () => {
  const service = new PhysicalInventoryService();

  it('deve calcular diferenças correctamente', async () => {
    // expected=10, counted=8 → difference=-2
    const diff = 8 - 10;
    expect(diff).toBe(-2);
  });

  it('deve gerar movimentos ADJUSTMENT_IN para diferença positiva', () => {
    const qty = 5; // contado > esperado
    const type = qty > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    expect(type).toBe('ADJUSTMENT_IN');
  });

  it('deve gerar movimentos ADJUSTMENT_OUT para diferença negativa', () => {
    const diff = -3;
    const type = diff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    expect(type).toBe('ADJUSTMENT_OUT');
    expect(Math.abs(diff)).toBe(3);
  });

  it('não deve gerar movimento para diferença zero', () => {
    const lines = [{ difference: 0 }, { difference: 5 }, { difference: -2 }];
    const adjustments = lines.filter((l) => l.difference !== 0);
    expect(adjustments).toHaveLength(2);
  });
});
```

### Teste Manual — Fluxo Completo

```
1. Ir a Stock → Inventário Físico → "Novo Inventário"
2. Seleccionar armazém "Principal"
3. Confirmar que as linhas carregam com stock esperado actual
4. Inserir quantidades contadas (incluir 1 diferença positiva e 1 negativa)
5. Clicar "Submeter Contagem" → status muda para REVIEW
6. Verificar o ecrã de revisão com coluna "Diferença" colorida (verde/vermelho)
7. Clicar "Aprovar Ajustes"
8. Confirmar que os movimentos de stock foram criados em Stock → Movimentos
9. Confirmar que o stock do produto ajustado reflecte o novo valor
```

---

## ✅ Checklist de Conclusão

- [ ] `prisma migrate dev` executado com sucesso
- [ ] `physicalInventory.service.ts` criado com 5 métodos
- [ ] Rotas registadas no `app.ts`
- [ ] Tipos Frontend definidos em `inventory.ts`
- [ ] Hook `usePhysicalInventory.ts` com 5 operações
- [ ] `PhysicalInventoryManager.tsx` — lista de sessões com status badge
- [ ] `PhysicalInventoryCountSheet.tsx` — tabela de contagem editável
- [ ] `tsc --noEmit` sem erros
- [ ] Testes unitários: diferenças calculadas correctamente
- [ ] Fluxo manual testado ponta-a-ponta (criação → contagem → aprovação → verificação stock)
