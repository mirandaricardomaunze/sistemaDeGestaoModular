---
name: payroll-unificado
description: "Guia para unificar os 4 motores de payroll independentes (Commercial, Pharmacy, Logistics, HR) num único motor global de processamento salarial com cálculo automático de IRT/INSS para Moçambique."
---

# Skill: Payroll Unificado (Motor Global)

> **Quando usar:** Ao trabalhar em qualquer funcionalidade de RH, salários,
> recibos de vencimento, IRT, INSS, ou processamento salarial.

---

## 🎯 Problema Actual

O sistema tem **4 motores de payroll separados** e independentes:
- `PayrollManager.tsx` (global)
- `CommercialPayrollManager.tsx` (comercial)
- `PharmacyPayrollManager.tsx` (farmácia)
- `LogisticsPayrollManager.tsx` (logística)

Cada um tem a sua lógica própria de cálculo, causando:
- Duplicação de código
- Inconsistência nos cálculos de IRT/INSS
- Impossibilidade de relatórios consolidados

---

## 🎯 Solução: Motor Único com Contexto de Módulo

Criar um **`PayrollEngine`** centralizado no backend que:
1. Calcula IRT segundo a tabela oficial MZ
2. Calcula INSS (3% empregado + 4% empregador)
3. Processa todos os módulos com um único serviço
4. Os componentes React usam o mesmo hook com `originModule`

---

## 📁 Estrutura de Ficheiros

```
backend/src/
  services/
    payrollEngine.service.ts    ← Motor central de cálculo (NOVO)
    payroll.service.ts          ← Orquestrador/persistência (NOVO)
  routes/
    payroll.routes.ts           ← Endpoints unificados (NOVO)
  utils/
    irtTables.ts                ← Tabelas IRT MZ 2024 (NOVO)

src/  (frontend)
  types/
    payroll.ts                  ← Tipos unificados (NOVO)
  services/api/
    payroll.api.ts              ← Cliente único (NOVO)
  hooks/
    usePayroll.ts               ← Hook unificado (MODIFICAR)
  components/employees/
    PayrollManager.tsx          ← Usar hook unificado (REFACTOR)
```

---

## 🛠️ PASSO 1 — Tabelas IRT Moçambique 2024

`backend/src/utils/irtTables.ts`:

```typescript
/**
 * Tabela IRT Moçambique 2024 (Imposto sobre Rendimento do Trabalho)
 * Fonte: Lei 33/2007 de 31 de Dezembro e actualizações subsequentes
 * NOTA: Verificar sempre com a AT-MZ as tabelas do ano fiscal corrente.
 */

export interface IRTBracket {
  min: number;   // Rendimento mínimo (inclusive)
  max: number;   // Rendimento máximo (exclusive) — Infinity para último escalão
  rate: number;  // Taxa marginal (0.10 = 10%)
  deduction: number; // Parcela a abater (MZN)
}

export const IRT_BRACKETS_2024: IRTBracket[] = [
  { min: 0,       max: 20249,   rate: 0,    deduction: 0 },
  { min: 20250,   max: 30000,   rate: 0.10, deduction: 2025 },
  { min: 30001,   max: 45000,   rate: 0.15, deduction: 3525 },
  { min: 45001,   max: 70000,   rate: 0.20, deduction: 5775 },
  { min: 70001,   max: 100000,  rate: 0.25, deduction: 9275 },
  { min: 100001,  max: Infinity, rate: 0.32, deduction: 16275 },
];

/**
 * Calcula o IRT para um dado rendimento bruto.
 * Fórmula: IRT = (rendimento × taxa) - parcela_a_abater
 */
export function calculateIRT(grossSalary: number): number {
  const bracket = IRT_BRACKETS_2024.find(
    (b) => grossSalary >= b.min && grossSalary < b.max
  );
  if (!bracket || bracket.rate === 0) return 0;
  const irt = grossSalary * bracket.rate - bracket.deduction;
  return Math.max(0, Math.round(irt * 100) / 100);
}

/** Taxa INSS empregado (3%) */
export const INSS_EMPLOYEE_RATE = 0.03;
/** Taxa INSS empregador (4%) */
export const INSS_EMPLOYER_RATE = 0.04;

/**
 * Calcula INSS do empregado sobre o salário base.
 */
export function calculateINSS(baseSalary: number): {
  employeeContribution: number;
  employerContribution: number;
} {
  return {
    employeeContribution: Math.round(baseSalary * INSS_EMPLOYEE_RATE * 100) / 100,
    employerContribution: Math.round(baseSalary * INSS_EMPLOYER_RATE * 100) / 100,
  };
}
```

---

## 🛠️ PASSO 2 — Motor de Cálculo

`backend/src/services/payrollEngine.service.ts`:

```typescript
import { calculateIRT, calculateINSS } from '../utils/irtTables';

export interface PayrollInput {
  baseSalary: number;
  allowances: Array<{ name: string; amount: number; taxable: boolean }>;
  deductions: Array<{ name: string; amount: number }>;
  bonuses: Array<{ name: string; amount: number; taxable: boolean }>;
}

export interface PayrollResult {
  baseSalary: number;
  totalAllowances: number;
  totalBonuses: number;
  grossSalary: number;         // Base + allowances taxáveis + bónus taxáveis
  inssEmployee: number;        // 3% do salário base
  inssEmployer: number;        // 4% do salário base
  irt: number;                 // IRT calculado sobre rendimento tributável
  totalDeductions: number;     // INSS + IRT + outras deduções
  netSalary: number;           // Líquido a pagar
  breakdown: {                 // Para o recibo de vencimento
    taxableIncome: number;
    nonTaxableAllowances: number;
    irtBracketRate: number;
  };
}

export class PayrollEngine {

  /**
   * Calcula o processamento salarial completo de um colaborador.
   * É o único lugar onde o cálculo IRT/INSS deve existir no sistema.
   *
   * IMPORTANTE: O backend é a autoridade final de cálculo.
   * O frontend pode fazer preview, mas os valores definitivos vêm daqui.
   */
  calculate(input: PayrollInput): PayrollResult {
    const { baseSalary, allowances, deductions, bonuses } = input;

    // Rendimentos tributáveis e não tributáveis
    const taxableAllowances = allowances
      .filter((a) => a.taxable)
      .reduce((s, a) => s + a.amount, 0);

    const nonTaxableAllowances = allowances
      .filter((a) => !a.taxable)
      .reduce((s, a) => s + a.amount, 0);

    const taxableBonuses = bonuses
      .filter((b) => b.taxable)
      .reduce((s, b) => s + b.amount, 0);

    const totalAllowances = taxableAllowances + nonTaxableAllowances;
    const totalBonuses = bonuses.reduce((s, b) => s + b.amount, 0);

    // Rendimento bruto tributável = base + allowances tributáveis + bónus tributáveis
    const taxableIncome = baseSalary + taxableAllowances + taxableBonuses;
    const grossSalary = taxableIncome + nonTaxableAllowances;

    // INSS calculado sobre o salário base
    const { employeeContribution: inssEmployee, employerContribution: inssEmployer } =
      calculateINSS(baseSalary);

    // IRT calculado sobre rendimento tributável após INSS
    const incomeAfterINSS = taxableIncome - inssEmployee;
    const irt = calculateIRT(incomeAfterINSS);

    // Deduções manuais (ex: adiantamentos, faltas)
    const manualDeductions = deductions.reduce((s, d) => s + d.amount, 0);
    const totalDeductions = inssEmployee + irt + manualDeductions;
    const netSalary = grossSalary - totalDeductions;

    // Determinar escalão IRT para o recibo
    const { IRT_BRACKETS_2024 } = require('../utils/irtTables');
    const bracket = IRT_BRACKETS_2024.find(
      (b: { min: number; max: number }) => incomeAfterINSS >= b.min && incomeAfterINSS < b.max
    );

    return {
      baseSalary,
      totalAllowances,
      totalBonuses,
      grossSalary,
      inssEmployee,
      inssEmployer,
      irt,
      totalDeductions,
      netSalary: Math.max(0, netSalary),
      breakdown: {
        taxableIncome,
        nonTaxableAllowances,
        irtBracketRate: bracket?.rate ?? 0,
      },
    };
  }
}

export const payrollEngine = new PayrollEngine();
```

---

## 🛠️ PASSO 3 — Serviço de Persistência

`backend/src/services/payroll.service.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { payrollEngine, type PayrollInput } from './payrollEngine.service';

const prisma = new PrismaClient();

export class PayrollService {

  /** Processa o salário de um colaborador e persiste. */
  async processEmployee(
    companyId: string,
    employeeId: string,
    month: number,
    year: number,
    input: PayrollInput,
    originModule: string,
  ) {
    // Verificar se já existe processamento para este mês
    const existing = await prisma.payrollRecord.findFirst({
      where: { companyId, employeeId, month, year },
    });
    if (existing) throw new Error(`Salário de ${month}/${year} já processado para este colaborador`);

    const result = payrollEngine.calculate(input);

    return prisma.$transaction(async (tx) => {
      const record = await tx.payrollRecord.create({
        data: {
          companyId,
          employeeId,
          month,
          year,
          originModule,
          baseSalary: result.baseSalary,
          grossSalary: result.grossSalary,
          inssEmployee: result.inssEmployee,
          inssEmployer: result.inssEmployer,
          irt: result.irt,
          totalDeductions: result.totalDeductions,
          netSalary: result.netSalary,
          allowances: JSON.stringify(input.allowances),
          deductions: JSON.stringify(input.deductions),
          bonuses: JSON.stringify(input.bonuses),
          status: 'PROCESSED',
        },
      });
      return { record, calculation: result };
    });
  }

  /** Busca processamentos com filtro de módulo. */
  async listPayroll(companyId: string, filters: {
    month?: number; year?: number; originModule?: string;
  }) {
    return prisma.payrollRecord.findMany({
      where: {
        companyId,
        ...(filters.month ? { month: filters.month } : {}),
        ...(filters.year ? { year: filters.year } : {}),
        ...(filters.originModule ? { originModule: filters.originModule } : {}),
      },
      include: { employee: { select: { name: true, position: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  /** Preview sem persistir — para o frontend mostrar o cálculo antes de confirmar. */
  previewCalculation(input: PayrollInput) {
    return payrollEngine.calculate(input);
  }
}

export const payrollService = new PayrollService();
```

---

## 🛠️ PASSO 4 — Schema Prisma (adicionar)

```prisma
model PayrollRecord {
  id              String   @id @default(cuid())
  companyId       String
  employeeId      String
  originModule    String   // 'commercial' | 'pharmacy' | 'logistics' | 'hr'
  month           Int
  year            Int
  baseSalary      Decimal  @db.Decimal(10, 2)
  grossSalary     Decimal  @db.Decimal(10, 2)
  inssEmployee    Decimal  @db.Decimal(10, 2)
  inssEmployer    Decimal  @db.Decimal(10, 2)
  irt             Decimal  @db.Decimal(10, 2)
  totalDeductions Decimal  @db.Decimal(10, 2)
  netSalary       Decimal  @db.Decimal(10, 2)
  allowances      Json     @default("[]")
  deductions      Json     @default("[]")
  bonuses         Json     @default("[]")
  status          String   @default("PROCESSED")
  createdAt       DateTime @default(now())

  company  Company  @relation(fields: [companyId], references: [id])
  employee Employee @relation(fields: [employeeId], references: [id])

  @@unique([companyId, employeeId, month, year])
  @@index([companyId, month, year])
  @@map("payroll_records")
}
```

---

## 🛠️ PASSO 5 — Hook Frontend Unificado

`src/hooks/usePayroll.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollAPI } from '../services/api/payroll.api';
import toast from 'react-hot-toast';

export function usePayrollList(filters: {
  month?: number; year?: number; originModule?: string;
}) {
  return useQuery({
    queryKey: ['payroll', filters],
    queryFn: () => payrollAPI.list(filters),
  });
}

export function usePayrollPreview() {
  return useMutation({
    mutationFn: payrollAPI.preview,
  });
}

export function useProcessPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payrollAPI.process,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll'] });
      toast.success('Salário processado com sucesso!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
```

---

## 🧪 TESTES

### Unitários do Motor — `payrollEngine.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../payrollEngine.service';
import { calculateIRT, calculateINSS } from '../../utils/irtTables';

const engine = new PayrollEngine();

// ── Testes das tabelas IRT ──────────────────────────────────────────────────

describe('calculateIRT (Tabela MZ 2024)', () => {
  it('deve retornar 0 para salário abaixo do mínimo tributável', () => {
    expect(calculateIRT(20000)).toBe(0);
  });

  it('deve calcular IRT para escalão de 10%', () => {
    // Salário 25000: (25000 × 0.10) - 2025 = 475
    expect(calculateIRT(25000)).toBe(475);
  });

  it('deve calcular IRT para escalão de 32%', () => {
    // Salário 150000: (150000 × 0.32) - 16275 = 31725
    expect(calculateIRT(150000)).toBe(31725);
  });
});

// ── Testes do INSS ──────────────────────────────────────────────────────────

describe('calculateINSS', () => {
  it('deve calcular 3% para empregado e 4% para empregador', () => {
    const { employeeContribution, employerContribution } = calculateINSS(50000);
    expect(employeeContribution).toBe(1500);
    expect(employerContribution).toBe(2000);
  });
});

// ── Testes do Motor Completo ────────────────────────────────────────────────

describe('PayrollEngine.calculate', () => {
  const baseInput = {
    baseSalary: 50000,
    allowances: [],
    deductions: [],
    bonuses: [],
  };

  it('deve calcular salário líquido correctamente', () => {
    const result = engine.calculate(baseInput);
    // INSS: 50000 × 3% = 1500
    expect(result.inssEmployee).toBe(1500);
    // IRT: (50000 - 1500 = 48500) → escalão 20%: (48500 × 0.20) - 5775 = 3925
    expect(result.irt).toBe(3925);
    // Líquido: 50000 - 1500 - 3925 = 44575
    expect(result.netSalary).toBe(44575);
  });

  it('deve tratar allowances não tributáveis correctamente', () => {
    const result = engine.calculate({
      ...baseInput,
      allowances: [{ name: 'Subsídio Alimentação', amount: 5000, taxable: false }],
    });
    // Subsídio alimentação não entra no IRT mas entra no bruto
    expect(result.grossSalary).toBe(55000);
    // IRT calculado só sobre 50000 (base)
    expect(result.breakdown.taxableIncome).toBe(50000);
  });

  it('deve incluir allowances tributáveis no IRT', () => {
    const result = engine.calculate({
      ...baseInput,
      allowances: [{ name: 'Bónus Desempenho', amount: 10000, taxable: true }],
    });
    expect(result.breakdown.taxableIncome).toBe(60000);
  });

  it('nunca deve retornar salário líquido negativo', () => {
    const result = engine.calculate({
      baseSalary: 10000,
      allowances: [],
      bonuses: [],
      deductions: [{ name: 'Adiantamento', amount: 50000 }],
    });
    expect(result.netSalary).toBeGreaterThanOrEqual(0);
  });
});
```

### Teste Manual — Verificação de Cálculo

```
Cenário: Colaborador com salário base de 50.000 MZN

1. Ir a RH → Processamento Salarial → "Novo Processamento"
2. Seleccionar colaborador com salário base 50.000 MZN
3. Verificar preview:
   - Salário Base:    50.000 MZN
   - INSS (3%):       1.500 MZN
   - Rendimento IRT:  48.500 MZN
   - IRT (20%):       3.925 MZN
   - Salário Líquido: 44.575 MZN
4. Confirmar e gerar recibo
5. Verificar PDF do recibo com os valores correctos
```

---

## ✅ Checklist de Conclusão

- [ ] `irtTables.ts` com tabelas 2024 e funções `calculateIRT` e `calculateINSS`
- [ ] `PayrollEngine` com método `calculate` puro (sem I/O)
- [ ] `PayrollService` com persistência e prevenção de duplicados
- [ ] Schema `PayrollRecord` migrado
- [ ] Rotas `/api/payroll` registadas
- [ ] Hook `usePayroll.ts` unificado
- [ ] Componentes antigos (`CommercialPayrollManager`, etc.) migrados para usar o hook unificado
- [ ] `tsc --noEmit` sem erros
- [ ] Testes de IRT: escalão 0%, 10%, 20%, 32% validados
- [ ] Teste de salário líquido nunca negativo
- [ ] Preview no frontend mostra os mesmos valores que o backend persiste
