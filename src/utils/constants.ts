/**
 * System Constants and Labels
 * Centralized display names for various system types and statuses.
 */

export const categoryLabels: Record<string, string> = {
    electronics: 'Eletrônicos',
    food: 'Alimentos',
    medicine: 'Medicamentos',
    clothing: 'Vestuário',
    furniture: 'Móveis',
    cosmetics: 'Cosméticos',
    beverages: 'Bebidas',
    cleaning: 'Limpeza',
    office: 'Escritório',
    other: 'Outros',
};

export const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    operator: 'Operador',
    cashier: 'Caixa',
    stock_keeper: 'Estoquista',
};

export const paymentMethodLabels: Record<string, string> = {
    cash: 'Dinheiro',
    card: 'Cartão',
    pix: 'PIX',
    transfer: 'Transferência',
    credit: 'Crédito',
};

export const alertTypeLabels: Record<string, string> = {
    low_stock: 'Estoque Baixo',
    expired_product: 'Produto Vencido',
    payment_due: 'Pagamento',
    order_delayed: 'Pedido Atrasado',
    system: 'Sistema',
    employee: 'Funcionário',
    sales: 'Vendas',
};

export const priorityLabels: Record<string, string> = {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Médio',
    low: 'Baixo',
};

export const statusLabels: Record<string, string> = {
    out_of_stock: 'Sem Estoque',
};
