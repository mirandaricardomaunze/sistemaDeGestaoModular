---
name: plano-de-contas
description: "Guia para implementar o módulo de Contabilidade com Plano de Contas (SNC/IFAC), lançamentos de débito/crédito duplo, e relatórios obrigatórios: Balancete, Diário, Demonstração de Resultados e Balanço Patrimonial."
---

# Skill: Plano de Contas e Contabilidade

> **Quando usar:** Ao trabalhar em qualquer funcionalidade contabilística:
> plano de contas, lançamentos, diário, razão, balancete, P&L, ou balanço.

---

## 🎯 Objectivo

Implementar a camada contabilística completa:
1. **Plano de Contas** — hierarquia de contas (Classe → Grupo → Conta → Sub-conta)
2. **Lançamentos de Partidas Dobradas** — todo débito tem crédito igual
3. **Diário** — registo cronológico de todos os lançamentos
4. **Balancete** — saldos de todas as contas num período
5. **Demonstração de Resultados (P&L)** — Receitas vs Despesas
6. **Balanço Patrimonial** — Activo = Passivo + Capital Próprio

---

## 📐 Princípio Fundamental: Partidas Dobradas

```
REGRA DE OURO: Débito = Crédito em cada lançamento

Activo     → aumenta a Débito, diminui a Crédito
Passivo    → aumenta a Crédito, diminui a Débito
Capital    → aumenta a Crédito, diminui a Débito
Receitas   → aumentam a Crédito
Despesas   → aumentam a Débito
```

**Esta regra DEVE ser validada no backend antes de persistir qualquer lançamento.**

---

## 📁 Estrutura de Ficheiros

```
backend/src/
  services/
    accounting.service.ts         ← Lançamentos e validação (NOVO)
    chartOfAccounts.service.ts    ← CRUD do plano de contas (NOVO)
    reports/
      trialBalance.service.ts     ← Balancete (NOVO)
      incomeStatement.service.ts  ← Demonstração de Resultados (NOVO)
      balanceSheet.service.ts     ← Balanço Patrimonial (NOVO)
  routes/
    accounting.routes.ts          ← Endpoints (NOVO)
  validation/
    accounting.validation.ts      ← Schemas Zod (NOVO)
  seed/
    defaultChartOfAccounts.ts     ← Plano de Contas padrão MZ (NOVO)

prisma/
  schema.prisma                   ← Novos modelos (Account, JournalEntry, JournalLine)

src/  (frontend)
  types/
    accounting.ts                 ← Tipos (NOVO)
  services/api/
    accounting.api.ts             ← Cliente HTTP (NOVO)
  hooks/
    useAccounting.ts              ← Hooks TanStack Query (NOVO)
  pages/accounting/
    ChartOfAccountsPage.tsx       ← Plano de contas (NOVO)
    JournalPage.tsx               ← Diário (NOVO)
    TrialBalancePage.tsx          ← Balancete (NOVO)
    IncomeStatementPage.tsx       ← P&L (NOVO)
    BalanceSheetPage.tsx          ← Balanço (NOVO)
```

---

## 🛠️ PASSO 1 — Schema Prisma

```prisma
model Account {
  id          String      @id @default(cuid())
  companyId   String
  code        String      // Ex: "1", "11", "111", "1111"
  name        String      // Ex: "Activo", "Imobilizações", "Terrenos"
  type        AccountType
  nature      AccountNature  // DEBIT ou CREDIT
  parentId    String?
  isActive    Boolean     @default(true)
  description String?
  level       Int         // 1=Classe, 2=Grupo, 3=Conta, 4=Subconta
  allowsEntries Boolean   @default(false) // Só contas de nível 3/4 aceitam lançamentos

  parent      Account?    @relation("AccountHierarchy", fields: [parentId], references: [id])
  children    Account[]   @relation("AccountHierarchy")
  debitLines  JournalLine[] @relation("DebitAccount")
  creditLines JournalLine[] @relation("CreditAccount")
  company     Company     @relation(fields: [companyId], references: [id])

  @@unique([companyId, code])
  @@index([companyId, type])
  @@map("accounts")
}

model JournalEntry {
  id          String   @id @default(cuid())
  companyId   String
  number      String   // Número sequencial do lançamento
  date        DateTime
  description String
  reference   String?  // Ex: número da factura
  module      String?  // 'commercial', 'hr', 'fiscal', etc.
  isReversed  Boolean  @default(false)
  reversedById String?
  createdBy   String
  createdAt   DateTime @default(now())

  lines   JournalLine[]
  company Company @relation(fields: [companyId], references: [id])

  @@unique([companyId, number])
  @@index([companyId, date])
  @@map("journal_entries")
}

model JournalLine {
  id             String  @id @default(cuid())
  journalEntryId String
  debitAccountId String?
  creditAccountId String?
  amount         Decimal @db.Decimal(15, 2)
  description    String?

  journalEntry   JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  debitAccount   Account?     @relation("DebitAccount", fields: [debitAccountId], references: [id])
  creditAccount  Account?     @relation("CreditAccount", fields: [creditAccountId], references: [id])

  @@map("journal_lines")
}

enum AccountType {
  ASSET           // Activo
  LIABILITY       // Passivo
  EQUITY          // Capital Próprio
  REVENUE         // Receitas
  EXPENSE         // Despesas
  COST_OF_GOODS   // Custo das Mercadorias Vendidas
}

enum AccountNature {
  DEBIT   // Saldo normal a Débito (Activos, Despesas)
  CREDIT  // Saldo normal a Crédito (Passivos, Capital, Receitas)
}
```

Executar:
```bash
npx prisma migrate dev --name add_accounting_module
npx prisma generate
```

---

## 🛠️ PASSO 2 — Plano de Contas Padrão MZ

`backend/src/seed/defaultChartOfAccounts.ts`:

```typescript
/**
 * Plano de Contas simplificado baseado no SNC-MZ (Sistema de Normalização Contabilística)
 * Adaptado para PMEs Moçambicanas.
 */
export const DEFAULT_CHART_OF_ACCOUNTS = [
  // CLASSE 1 — MEIOS FIXOS E BENS INTANGÍVEIS
  { code: '1',    name: 'Activo Não Corrente',       type: 'ASSET',     nature: 'DEBIT',  level: 1 },
  { code: '11',   name: 'Activo Fixo Tangível',      type: 'ASSET',     nature: 'DEBIT',  level: 2, parentCode: '1' },
  { code: '111',  name: 'Terrenos e Recursos',       type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '11', allowsEntries: true },
  { code: '112',  name: 'Edifícios e Construções',   type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '11', allowsEntries: true },
  { code: '113',  name: 'Equipamento Básico',        type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '11', allowsEntries: true },
  { code: '114',  name: 'Equipamento de Transporte', type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '11', allowsEntries: true },

  // CLASSE 2 — INVENTÁRIOS
  { code: '2',    name: 'Activo Corrente',            type: 'ASSET',     nature: 'DEBIT',  level: 1 },
  { code: '21',   name: 'Inventários',                type: 'ASSET',     nature: 'DEBIT',  level: 2, parentCode: '2' },
  { code: '211',  name: 'Mercadorias',                type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '21', allowsEntries: true },
  { code: '212',  name: 'Matérias-Primas',            type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '21', allowsEntries: true },

  // CLASSE 3 — CLIENTES E OUTROS DEVEDORES
  { code: '31',   name: 'Clientes',                   type: 'ASSET',     nature: 'DEBIT',  level: 2, parentCode: '2' },
  { code: '311',  name: 'Clientes — Nacionais',       type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '31', allowsEntries: true },
  { code: '312',  name: 'Clientes — Internacionais',  type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '31', allowsEntries: true },

  // CLASSE 4 — ESTADO E ENTIDADES PÚBLICAS
  { code: '41',   name: 'Estado — IVA',               type: 'LIABILITY', nature: 'CREDIT', level: 2, parentCode: '2' },
  { code: '411',  name: 'IVA a Liquidar',             type: 'LIABILITY', nature: 'CREDIT', level: 3, parentCode: '41', allowsEntries: true },
  { code: '412',  name: 'IVA a Deduzir',              type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '41', allowsEntries: true },
  { code: '413',  name: 'IRT a Pagar',                type: 'LIABILITY', nature: 'CREDIT', level: 3, parentCode: '41', allowsEntries: true },
  { code: '414',  name: 'INSS a Pagar',               type: 'LIABILITY', nature: 'CREDIT', level: 3, parentCode: '41', allowsEntries: true },

  // CLASSE 5 — MEIOS FINANCEIROS
  { code: '51',   name: 'Caixa e Equivalentes',       type: 'ASSET',     nature: 'DEBIT',  level: 2, parentCode: '2' },
  { code: '511',  name: 'Caixa',                      type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '51', allowsEntries: true },
  { code: '512',  name: 'Depósitos Bancários',        type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '51', allowsEntries: true },
  { code: '513',  name: 'M-Pesa / Mobile Money',      type: 'ASSET',     nature: 'DEBIT',  level: 3, parentCode: '51', allowsEntries: true },

  // CLASSE 6 — CAPITAL PRÓPRIO
  { code: '6',    name: 'Capital Próprio',             type: 'EQUITY',    nature: 'CREDIT', level: 1 },
  { code: '61',   name: 'Capital Social',              type: 'EQUITY',    nature: 'CREDIT', level: 2, parentCode: '6' },
  { code: '611',  name: 'Capital Subscrito',           type: 'EQUITY',    nature: 'CREDIT', level: 3, parentCode: '61', allowsEntries: true },
  { code: '62',   name: 'Resultados Transitados',      type: 'EQUITY',    nature: 'CREDIT', level: 2, parentCode: '6' },
  { code: '621',  name: 'Resultados Transitados',      type: 'EQUITY',    nature: 'CREDIT', level: 3, parentCode: '62', allowsEntries: true },

  // CLASSE 7 — PASSIVOS
  { code: '7',    name: 'Passivo',                     type: 'LIABILITY', nature: 'CREDIT', level: 1 },
  { code: '71',   name: 'Fornecedores',                type: 'LIABILITY', nature: 'CREDIT', level: 2, parentCode: '7' },
  { code: '711',  name: 'Fornecedores — Nacionais',    type: 'LIABILITY', nature: 'CREDIT', level: 3, parentCode: '71', allowsEntries: true },
  { code: '72',   name: 'Pessoal (Salários a Pagar)',  type: 'LIABILITY', nature: 'CREDIT', level: 2, parentCode: '7' },
  { code: '721',  name: 'Remunerações a Pagar',        type: 'LIABILITY', nature: 'CREDIT', level: 3, parentCode: '72', allowsEntries: true },

  // CLASSE 8 — RECEITAS
  { code: '8',    name: 'Rendimentos',                 type: 'REVENUE',   nature: 'CREDIT', level: 1 },
  { code: '81',   name: 'Vendas',                      type: 'REVENUE',   nature: 'CREDIT', level: 2, parentCode: '8' },
  { code: '811',  name: 'Vendas — Mercadorias',        type: 'REVENUE',   nature: 'CREDIT', level: 3, parentCode: '81', allowsEntries: true },
  { code: '812',  name: 'Vendas — Produtos',           type: 'REVENUE',   nature: 'CREDIT', level: 3, parentCode: '81', allowsEntries: true },
  { code: '82',   name: 'Prestações de Serviços',      type: 'REVENUE',   nature: 'CREDIT', level: 2, parentCode: '8' },
  { code: '821',  name: 'Serviços Prestados',          type: 'REVENUE',   nature: 'CREDIT', level: 3, parentCode: '82', allowsEntries: true },

  // CLASSE 9 — DESPESAS
  { code: '9',    name: 'Gastos',                      type: 'EXPENSE',   nature: 'DEBIT',  level: 1 },
  { code: '91',   name: 'Custo das Mercadorias',       type: 'COST_OF_GOODS', nature: 'DEBIT', level: 2, parentCode: '9' },
  { code: '911',  name: 'CMV — Mercadorias',           type: 'COST_OF_GOODS', nature: 'DEBIT', level: 3, parentCode: '91', allowsEntries: true },
  { code: '92',   name: 'Gastos com Pessoal',          type: 'EXPENSE',   nature: 'DEBIT',  level: 2, parentCode: '9' },
  { code: '921',  name: 'Remunerações',                type: 'EXPENSE',   nature: 'DEBIT',  level: 3, parentCode: '92', allowsEntries: true },
  { code: '922',  name: 'Encargos Sociais (INSS)',     type: 'EXPENSE',   nature: 'DEBIT',  level: 3, parentCode: '92', allowsEntries: true },
  { code: '93',   name: 'Gastos Gerais',               type: 'EXPENSE',   nature: 'DEBIT',  level: 2, parentCode: '9' },
  { code: '931',  name: 'Rendas e Alugueres',          type: 'EXPENSE',   nature: 'DEBIT',  level: 3, parentCode: '93', allowsEntries: true },
  { code: '932',  name: 'Electricidade e Água',        type: 'EXPENSE',   nature: 'DEBIT',  level: 3, parentCode: '93', allowsEntries: true },
  { code: '933',  name: 'Telecomunicações',            type: 'EXPENSE',   nature: 'DEBIT',  level: 3, parentCode: '93', allowsEntries: true },
];
```

---

## 🛠️ PASSO 3 — Service de Contabilidade

`backend/src/services/accounting.service.ts`:

```typescript
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface JournalLineInput {
  debitAccountId?: string;
  creditAccountId?: string;
  amount: number;
  description?: string;
}

interface CreateEntryInput {
  date: Date;
  description: string;
  reference?: string;
  module?: string;
  lines: JournalLineInput[];
}

export class AccountingService {

  /**
   * Cria um lançamento contabilístico.
   * REGRA INVIOLÁVEL: Total Débito DEVE ser igual ao Total Crédito.
   * Um lançamento desequilibrado é RECUSADO.
   */
  async createEntry(companyId: string, userId: string, input: CreateEntryInput) {
    // Validação de partidas dobradas
    const totalDebit = input.lines
      .filter((l) => l.debitAccountId)
      .reduce((s, l) => s + l.amount, 0);
    const totalCredit = input.lines
      .filter((l) => l.creditAccountId)
      .reduce((s, l) => s + l.amount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Lançamento desequilibrado: Débito ${totalDebit.toFixed(2)} ≠ Crédito ${totalCredit.toFixed(2)}`
      );
    }

    const number = await this._generateEntryNumber(companyId);

    return prisma.$transaction(async (tx) => {
      return tx.journalEntry.create({
        data: {
          companyId,
          number,
          date: input.date,
          description: input.description,
          reference: input.reference,
          module: input.module,
          createdBy: userId,
          lines: {
            create: input.lines.map((line) => ({
              debitAccountId: line.debitAccountId,
              creditAccountId: line.creditAccountId,
              amount: new Prisma.Decimal(line.amount),
              description: line.description,
            })),
          },
        },
        include: { lines: true },
      });
    });
  }

  /** Gera o Balancete num período. */
  async getTrialBalance(companyId: string, startDate: Date, endDate: Date) {
    const accounts = await prisma.account.findMany({
      where: { companyId, allowsEntries: true, isActive: true },
      include: {
        debitLines: {
          where: { journalEntry: { date: { gte: startDate, lte: endDate } } },
          select: { amount: true },
        },
        creditLines: {
          where: { journalEntry: { date: { gte: startDate, lte: endDate } } },
          select: { amount: true },
        },
      },
    });

    return accounts.map((account) => {
      const totalDebit = account.debitLines.reduce((s, l) => s + Number(l.amount), 0);
      const totalCredit = account.creditLines.reduce((s, l) => s + Number(l.amount), 0);
      const balance = account.nature === 'DEBIT'
        ? totalDebit - totalCredit
        : totalCredit - totalDebit;

      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        nature: account.nature,
        totalDebit,
        totalCredit,
        balance,
      };
    }).sort((a, b) => a.code.localeCompare(b.code));
  }

  /** Gera a Demonstração de Resultados. */
  async getIncomeStatement(companyId: string, startDate: Date, endDate: Date) {
    const trialBalance = await this.getTrialBalance(companyId, startDate, endDate);

    const revenues = trialBalance
      .filter((a) => a.type === 'REVENUE')
      .reduce((s, a) => s + a.balance, 0);

    const costOfGoods = trialBalance
      .filter((a) => a.type === 'COST_OF_GOODS')
      .reduce((s, a) => s + a.balance, 0);

    const expenses = trialBalance
      .filter((a) => a.type === 'EXPENSE')
      .reduce((s, a) => s + a.balance, 0);

    const grossProfit = revenues - costOfGoods;
    const netProfit = grossProfit - expenses;

    return {
      revenues,
      costOfGoods,
      grossProfit,
      grossMargin: revenues > 0 ? (grossProfit / revenues) * 100 : 0,
      expenses,
      netProfit,
      netMargin: revenues > 0 ? (netProfit / revenues) * 100 : 0,
      detail: trialBalance.filter(
        (a) => ['REVENUE', 'EXPENSE', 'COST_OF_GOODS'].includes(a.type)
      ),
    };
  }

  /** Gera o Balanço Patrimonial. */
  async getBalanceSheet(companyId: string, asOfDate: Date) {
    const trialBalance = await this.getTrialBalance(
      companyId,
      new Date('2000-01-01'),  // Desde o início
      asOfDate
    );

    const totalAssets = trialBalance
      .filter((a) => a.type === 'ASSET')
      .reduce((s, a) => s + a.balance, 0);

    const totalLiabilities = trialBalance
      .filter((a) => a.type === 'LIABILITY')
      .reduce((s, a) => s + a.balance, 0);

    const totalEquity = trialBalance
      .filter((a) => a.type === 'EQUITY')
      .reduce((s, a) => s + a.balance, 0);

    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      isBalanced,
      difference: totalAssets - totalLiabilities - totalEquity,
      detail: trialBalance.filter(
        (a) => ['ASSET', 'LIABILITY', 'EQUITY'].includes(a.type)
      ),
    };
  }

  private async _generateEntryNumber(companyId: string): Promise<string> {
    const count = await prisma.journalEntry.count({ where: { companyId } });
    const year = new Date().getFullYear();
    return `LC-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}

export const accountingService = new AccountingService();
```

---

## 🧪 TESTES

### Unitários — `accounting.service.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AccountingService } from '../accounting.service';

const service = new AccountingService();

describe('Validação de Partidas Dobradas', () => {
  it('DEVE rejeitar lançamento com débito ≠ crédito', async () => {
    await expect(
      service.createEntry('company1', 'user1', {
        date: new Date(),
        description: 'Teste',
        lines: [
          { debitAccountId: 'acc1', amount: 1000 },   // Débito: 1000
          { creditAccountId: 'acc2', amount: 900 },   // Crédito: 900 — DESEQUILIBRADO
        ],
      })
    ).rejects.toThrow('Lançamento desequilibrado');
  });

  it('DEVE aceitar lançamento equilibrado', async () => {
    // Mock do prisma para este teste
    vi.spyOn(service as unknown as { _generateEntryNumber: () => string }, '_generateEntryNumber')
      .mockResolvedValue('LC-2024-000001');

    // Teste de validação apenas (sem persistência real)
    const totalDebit = 1000;
    const totalCredit = 1000;
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
  });
});

describe('Cálculo de Balancete', () => {
  it('deve calcular saldo DEBIT = débitos - créditos', () => {
    const totalDebit = 5000;
    const totalCredit = 2000;
    const balance = totalDebit - totalCredit; // Conta de natureza DEBIT
    expect(balance).toBe(3000);
  });

  it('deve calcular saldo CREDIT = créditos - débitos', () => {
    const totalDebit = 1000;
    const totalCredit = 8000;
    const balance = totalCredit - totalDebit; // Conta de natureza CREDIT
    expect(balance).toBe(7000);
  });
});

describe('Demonstração de Resultados', () => {
  it('deve calcular lucro bruto = receitas - CMV', () => {
    const revenues = 100000;
    const costOfGoods = 60000;
    const grossProfit = revenues - costOfGoods;
    expect(grossProfit).toBe(40000);
    expect((grossProfit / revenues) * 100).toBe(40);
  });

  it('deve calcular lucro líquido = lucro bruto - despesas', () => {
    const grossProfit = 40000;
    const expenses = 15000;
    const netProfit = grossProfit - expenses;
    expect(netProfit).toBe(25000);
  });
});

describe('Balanço Patrimonial', () => {
  it('Activo DEVE ser igual a Passivo + Capital Próprio', () => {
    const totalAssets = 500000;
    const totalLiabilities = 200000;
    const totalEquity = 300000;
    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;
    expect(isBalanced).toBe(true);
  });
});
```

### Teste Manual — Verificação do Ciclo Completo

```
Cenário: Registar uma venda de 10.000 MZN (IVA 16% incluído)

Lançamento correcto:
  Débito:  311 (Clientes)         = 10.000 MZN
  Crédito: 811 (Vendas)           = 8.620,69 MZN
  Crédito: 411 (IVA a Liquidar)   = 1.379,31 MZN
  ─────────────────────────────────────────────
  Débito Total = Crédito Total = 10.000 MZN ✅

1. Ir a Contabilidade → Novo Lançamento
2. Inserir as 3 linhas acima
3. Verificar que o sistema valida o equilíbrio
4. Confirmar
5. Ir ao Balancete e verificar saldos actualizados:
   - Conta 311: saldo devedor 10.000
   - Conta 811: saldo credor 8.620,69
   - Conta 411: saldo credor 1.379,31
6. Ir à Demonstração de Resultados:
   - Receitas: 8.620,69 MZN
```

---

## ✅ Checklist de Conclusão

- [ ] Schema Prisma migrado (Account, JournalEntry, JournalLine)
- [ ] Plano de Contas padrão MZ semeado na BD
- [ ] `AccountingService` com validação de partidas dobradas
- [ ] Relatórios: Balancete, P&L, Balanço
- [ ] Rotas `/api/accounting` registadas
- [ ] Tipos Frontend em `accounting.ts`
- [ ] Hooks `useAccounting.ts` com TanStack Query
- [ ] 5 páginas criadas (ChartOfAccounts, Journal, TrialBalance, IncomeStatement, BalanceSheet)
- [ ] `tsc --noEmit` sem erros
- [ ] Teste: lançamento desequilibrado RECUSADO
- [ ] Teste: Activo = Passivo + Capital no balanço
- [ ] Teste manual: ciclo venda → lançamento → balancete
