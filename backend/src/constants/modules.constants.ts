/**
 * Business Modules Configuration
 * 
 * OPTIONAL_MODULES: Modules that can be selected during registration
 * CORE_MODULES: Always included with every company (POS, Invoices, CRM, HR, Fiscal)
 */

export interface BusinessModule {
    code: string;
    name: string;
    description: string;
    icon: string;
    color: string;
}

// Modules that companies can optionally select during registration
export const OPTIONAL_MODULES: BusinessModule[] = [
    {
        code: 'pharmacy',
        name: 'Farmácia',
        description: 'Gestão farmacêutica com controle de lotes e receitas',
        icon: '💊',
        color: '#14B8A6'
    },
    {
        code: 'inventory',
        name: 'Inventário',
        description: 'Gestão de stock e produtos',
        icon: '📦',
        color: '#3B82F6'
    },
    {
        code: 'hospitality',
        name: 'Hotelaria',
        description: 'Gestão de quartos e reservas',
        icon: '🏨',
        color: '#06B6D4'
    },
    {
        code: 'logistics',
        name: 'Logística',
        description: 'Gestão de entregas, rotas e frotas',
        icon: '🚚',
        color: '#F97316'
    },
];

// Core modules always included with every company
export const CORE_MODULES: BusinessModule[] = [
    { code: 'pos', name: 'Ponto de Venda', description: 'Sistema de vendas e caixa', icon: '💰', color: '#10B981' },
    { code: 'invoices', name: 'Faturas', description: 'Emissão de faturas e notas', icon: '📄', color: '#8B5CF6' },
    { code: 'crm', name: 'CRM', description: 'Gestão de clientes', icon: '👥', color: '#F59E0B' },
    { code: 'hr', name: 'Recursos Humanos', description: 'Gestão de funcionários', icon: '👔', color: '#EC4899' },
    { code: 'fiscal', name: 'Fiscal', description: 'Relatórios fiscais', icon: '📊', color: '#6366F1' },
];

// All modules combined
export const ALL_MODULES: BusinessModule[] = [...CORE_MODULES, ...OPTIONAL_MODULES];

// Helper to get module by code
export const getModuleByCode = (code: string): BusinessModule | undefined => {
    return ALL_MODULES.find(m => m.code === code);
};
