/**
 * Maps the first segment of a React Query `queryKey` to a Portuguese
 * human-readable label. Used by the page-transition loader so the
 * "A carregar..." message names what is actually being fetched, rather
 * than making a generic (and possibly false) claim.
 *
 * Unmapped keys are returned as-is — still truthful, just less polished.
 */
const QUERY_LABELS: Record<string, string> = {
    // Comercial / fiscal
    sales: 'vendas',
    invoices: 'facturas',
    'credit-notes': 'notas de crédito',
    'debit-notes': 'notas de débito',
    'customer-orders': 'encomendas',
    'purchase-orders': 'ordens de compra',
    'supplier-invoices': 'facturas de fornecedor',
    'document-series': 'séries de documentos',
    'tax-config': 'configuração fiscal',
    'iva-rates': 'taxas IVA',
    'fiscal-reports': 'relatórios fiscais',
    'fiscal-deadlines': 'prazos fiscais',
    // Catálogo / stock
    products: 'produtos',
    categories: 'categorias',
    warehouses: 'armazéns',
    'warehouse-stocks': 'stock por armazém',
    'stock-movements': 'movimentos de stock',
    'stock-transfers': 'transferências de stock',
    'stock-reservations': 'reservas de stock',
    'product-batches': 'lotes',
    batches: 'lotes',
    'physical-inventory': 'inventário físico',
    // CRM
    customers: 'clientes',
    suppliers: 'fornecedores',
    campaigns: 'campanhas',
    opportunities: 'oportunidades',
    'funnel-stages': 'estágios do funil',
    'loyalty-transactions': 'pontos de fidelização',
    // POS / caixa
    'cash-sessions': 'sessões de caixa',
    'cash-movements': 'movimentos de caixa',
    'credit-payments': 'pagamentos a crédito',
    // Farmácia
    medications: 'medicamentos',
    prescriptions: 'receitas',
    'medication-batches': 'lotes farmacêuticos',
    'pharmacy-partners': 'parceiros de farmácia',
    'narcotic-register': 'registo de narcóticos',
    'batch-recalls': 'recolhas de lote',
    'drug-interactions': 'interacções medicamentosas',
    // Hotelaria / restauração
    bookings: 'reservas',
    rooms: 'quartos',
    'housekeeping-tasks': 'tarefas de housekeeping',
    'restaurant-tables': 'mesas',
    'restaurant-orders': 'pedidos da cozinha',
    'restaurant-menu-items': 'itens de menu',
    'restaurant-reservations': 'reservas de mesa',
    bottlestore: 'garrafeira',
    // Logística
    vehicles: 'viaturas',
    drivers: 'motoristas',
    deliveries: 'entregas',
    parcels: 'encomendas em trânsito',
    'delivery-routes': 'rotas',
    'vehicle-maintenance': 'manutenção de viaturas',
    'fuel-supplies': 'abastecimentos',
    'vehicle-incidents': 'incidentes',
    // RH / financeiro
    employees: 'colaboradores',
    attendance: 'assiduidade',
    'payroll-records': 'folha salarial',
    'vacation-requests': 'férias',
    'academic-qualifications': 'qualificações',
    'commission-rules': 'regras de comissão',
    transactions: 'transacções',
    'accounting-accounts': 'plano de contas',
    'journal-entries': 'lançamentos contabilísticos',
    'trial-balance': 'balancete',
    'income-statement': 'demonstração de resultados',
    'balance-sheet': 'balanço',
    // Sistema
    alerts: 'alertas',
    'audit-logs': 'auditoria',
    'audit-stats': 'estatísticas de auditoria',
    approvals: 'aprovações',
    company: 'empresa',
    'company-settings': 'configurações da empresa',
    'company-modules': 'módulos',
    users: 'utilizadores',
    notifications: 'notificações',
    dashboard: 'painel',
    'mpesa-transactions': 'transacções M-Pesa',
};

/**
 * Resolves a query key into its human label.
 * Returns `null` when the key is empty or not a string at position 0.
 */
export function labelForQueryKey(key: readonly unknown[]): string | null {
    const first = key[0];
    if (typeof first !== 'string' || first.length === 0) return null;
    return QUERY_LABELS[first] ?? first;
}

/**
 * Formats a list of resource labels into a Portuguese phrase suitable for the
 * loader subtitle. Caps at 3 named labels + "mais N" so a busy boot does not
 * produce a 12-word run-on sentence.
 *
 *   []                              → ''
 *   ['vendas']                      → 'vendas'
 *   ['vendas', 'clientes']          → 'vendas e clientes'
 *   ['vendas', 'clientes', 'p.']    → 'vendas, clientes e p.'
 *   ['a', 'b', 'c', 'd']            → 'a, b, c e mais 1'
 */
export function formatResourceList(labels: string[]): string {
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
    if (labels.length === 3) return `${labels[0]}, ${labels[1]} e ${labels[2]}`;
    const head = labels.slice(0, 3).join(', ');
    const rest = labels.length - 3;
    return `${head} e mais ${rest}`;
}
