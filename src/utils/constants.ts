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
    system: 'Multicore',
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
    in_stock: 'Em Stock',
    low_stock: 'Stock Baixo',
    out_of_stock: 'Sem Estoque',
};

export const PAGE_SIZE = 20;
export const PAGE_SIZE_GRID = 12;

export const CHART_TOOLTIP_STYLE = {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    fontSize: '12px',
    color: '#fff',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
    padding: '10px',
};
