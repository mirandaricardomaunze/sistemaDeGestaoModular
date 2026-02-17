/**
 * Modules Constants
 * Static definition of all available business modules.
 * This ensures the application remains functional even if the database is reset
 * or connection issues occur during initial setup.
 */

export interface BusinessModule {
    code: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    isCore: boolean;
}

/**
 * Core modules - Always available to every business
 */
export const CORE_MODULES: BusinessModule[] = [
    {
        code: 'POS',
        name: 'Ponto de Venda',
        description: 'Sistema de ponto de venda para vendas rápidas e eficientes.',
        icon: 'HiOutlineShoppingCart',
        color: '#3B82F6',
        isCore: true
    },
    {
        code: 'CRM',
        name: 'CRM',
        description: 'Gestão de relacionamento com clientes e oportunidades de vendas.',
        icon: 'HiOutlineChartPie',
        color: '#8B5CF6',
        isCore: true
    },
    {
        code: 'HR',
        name: 'Recursos Humanos',
        description: 'Gestão de funcionários, folha de pagamento e presenças.',
        icon: 'HiOutlineUsers',
        color: '#EC4899',
        isCore: true
    },
    {
        code: 'FISCAL',
        name: 'Fiscal',
        description: 'Gestão fiscal, impostos e retenções.',
        icon: 'HiOutlineCalculator',
        color: '#10B981',
        isCore: true
    },
    {
        code: 'INVOICES',
        name: 'Faturas',
        description: 'Gestão de faturas e notas de crédito.',
        icon: 'HiOutlineDocumentText',
        color: '#F59E0B',
        isCore: true
    },
    {
        code: 'FINANCIAL',
        name: 'Finanças',
        description: 'Gestão financeira e transações.',
        icon: 'HiOutlineCurrencyDollar',
        color: '#14B8A6',
        isCore: true
    }
];

/**
 * Optional modules - Business owners can select these during registration
 */
export const OPTIONAL_MODULES: BusinessModule[] = [
    {
        code: 'PHARMACY',
        name: 'Farmácia',
        description: 'Gestão completa para farmácias e drogarias.',
        icon: 'HiOutlineBeaker',
        color: '#10B981',
        isCore: false
    },
    {
        code: 'COMMERCIAL',
        name: 'Comércio',
        description: 'Gestão de inventário, pedidos e produtos para comércio.',
        icon: 'HiOutlineShoppingCart',
        color: '#3B82F6',
        isCore: false
    },
    {
        code: 'BOTTLE_STORE',
        name: 'Garrafeira',
        description: 'Gestão especializada de bebidas e retornáveis.',
        icon: 'HiOutlineBuildingStorefront',
        color: '#8B5CF6',
        isCore: false
    },
    {
        code: 'HOSPITALITY',
        name: 'Hotelaria',
        description: 'Gestão hoteleira com quartos, reservas e hóspedes.',
        icon: 'HiOutlineHomeModern',
        color: '#F59E0B',
        isCore: false
    },
    {
        code: 'RESTAURANT',
        name: 'Restaurante',
        description: 'Gestão de mesas, pedidos e cozinha.',
        icon: 'HiOutlineCake',
        color: '#EF4444',
        isCore: false
    },
    {
        code: 'LOGISTICS',
        name: 'Logística',
        description: 'Gestão de frotas, entregas e encomendas.',
        icon: 'HiOutlineTruck',
        color: '#6366F1',
        isCore: false
    }
];

/**
 * Helper to get all modules for display
 */
export const ALL_MODULES = [...CORE_MODULES, ...OPTIONAL_MODULES];
