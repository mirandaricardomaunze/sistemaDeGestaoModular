import { AccountNature, AccountType } from '@prisma/client';

export const DEFAULT_CHART_OF_ACCOUNTS = [
    { code: '1', name: 'Activo', type: AccountType.ASSET, nature: AccountNature.DEBIT, level: 1, allowsEntries: false },
    { code: '11', name: 'Caixa e Bancos', type: AccountType.ASSET, nature: AccountNature.DEBIT, level: 2, parentCode: '1', allowsEntries: true },
    { code: '12', name: 'Clientes', type: AccountType.ASSET, nature: AccountNature.DEBIT, level: 2, parentCode: '1', allowsEntries: true },
    { code: '2', name: 'Passivo', type: AccountType.LIABILITY, nature: AccountNature.CREDIT, level: 1, allowsEntries: false },
    { code: '21', name: 'Fornecedores', type: AccountType.LIABILITY, nature: AccountNature.CREDIT, level: 2, parentCode: '2', allowsEntries: true },
    { code: '22', name: 'Impostos a Pagar', type: AccountType.LIABILITY, nature: AccountNature.CREDIT, level: 2, parentCode: '2', allowsEntries: true },
    { code: '3', name: 'Capital Proprio', type: AccountType.EQUITY, nature: AccountNature.CREDIT, level: 1, allowsEntries: false },
    { code: '31', name: 'Capital Social', type: AccountType.EQUITY, nature: AccountNature.CREDIT, level: 2, parentCode: '3', allowsEntries: true },
    { code: '4', name: 'Custos das Mercadorias Vendidas', type: AccountType.COST_OF_GOODS, nature: AccountNature.DEBIT, level: 1, allowsEntries: true },
    { code: '6', name: 'Despesas Operacionais', type: AccountType.EXPENSE, nature: AccountNature.DEBIT, level: 1, allowsEntries: true },
    { code: '7', name: 'Receitas', type: AccountType.REVENUE, nature: AccountNature.CREDIT, level: 1, allowsEntries: false },
    { code: '71', name: 'Vendas de Mercadorias', type: AccountType.REVENUE, nature: AccountNature.CREDIT, level: 2, parentCode: '7', allowsEntries: true },
    { code: '72', name: 'Prestacao de Servicos', type: AccountType.REVENUE, nature: AccountNature.CREDIT, level: 2, parentCode: '7', allowsEntries: true }
] as const;
