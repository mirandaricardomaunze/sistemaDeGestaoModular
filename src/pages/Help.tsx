/**
 * Help Page - Professional Multi-Module Documentation
 * 
 * Comprehensive help system with:
 * - Module-specific guides
 * - Search functionality
 * - Expandable FAQ sections
 * - Video tutorials (placeholders)
 * - Multi-company aware content
 */

import { useState, useMemo } from 'react';
import {
    HiOutlineQuestionMarkCircle,
    HiOutlineSearch,
    HiOutlineBookOpen,
    HiOutlineChevronDown,
    HiOutlineChevronRight,
    HiOutlinePlay,
    HiOutlineLightBulb,
    HiOutlineSupport,
    HiOutlineExternalLink,
} from 'react-icons/hi';
import {
    HiOutlineBeaker,
    HiOutlineBuildingStorefront,
    HiOutlineHomeModern,
    HiOutlineTruck,
    HiOutlineShoppingCart,
    HiOutlineUsers,
    HiOutlineBriefcase,
    HiOutlineDocumentText,
    HiOutlineCurrencyDollar,
    HiOutlineChartBar,
    HiOutlineCube,
    HiOutlineClipboardDocumentList,
} from 'react-icons/hi2';
import { Card, Button, Input } from '../components/ui';
import { useTenant } from '../contexts/TenantContext';
import { cn } from '../utils/helpers';

// Help content structure
interface HelpSection {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    description: string;
    moduleCode?: string; // If set, only shows for companies with this module
    topics: HelpTopic[];
}

interface HelpTopic {
    id: string;
    title: string;
    content: string;
    steps?: string[];
    tips?: string[];
}

// All help sections organized by module
const HELP_SECTIONS: HelpSection[] = [
    // CORE - Always visible
    {
        id: 'getting-started',
        title: 'Primeiros Passos',
        icon: HiOutlineLightBulb,
        color: '#10B981',
        description: 'Aprenda o básico do sistema',
        topics: [
            {
                id: 'login',
                title: 'Como fazer login',
                content: 'O acesso ao sistema é feito através do email e senha registados na criação da conta.',
                steps: [
                    'Aceda ao endereço do sistema no navegador',
                    'Introduza o seu email corporativo',
                    'Introduza a sua senha',
                    'Clique em "Entrar"'
                ],
                tips: ['Se esqueceu a senha, clique em "Esqueci minha senha"', 'Use um navegador moderno como Chrome, Firefox ou Edge']
            },
            {
                id: 'navigation',
                title: 'Navegação no sistema',
                content: 'O menu lateral permite aceder rapidamente a todas as funcionalidades.',
                steps: [
                    'O menu principal está à esquerda do ecrã',
                    'Clique num item para aceder à secção',
                    'Use a barra de pesquisa no topo para encontrar qualquer coisa',
                    'O ícone do utilizador no canto superior direito dá acesso às configurações'
                ],
                tips: ['Em ecrãs pequenos, o menu pode ser expandido clicando no ícone de menu', 'Use atalhos de teclado para maior produtividade']
            },
            {
                id: 'dark-mode',
                title: 'Modo escuro',
                content: 'O sistema suporta modo claro e escuro para maior conforto visual.',
                steps: [
                    'Clique no ícone de sol/lua no canto superior direito',
                    'O sistema alternará entre modo claro e escuro'
                ],
                tips: ['O modo escolhido é guardado automaticamente', 'O modo escuro reduz o cansaço visual em ambientes com pouca luz']
            }
        ]
    },
    {
        id: 'pos',
        title: 'Ponto de Venda (POS)',
        icon: HiOutlineShoppingCart,
        color: '#3B82F6',
        description: 'Sistema de vendas rápido e eficiente',
        topics: [
            {
                id: 'new-sale',
                title: 'Criar uma nova venda',
                content: 'O POS permite criar vendas de forma rápida e intuitiva.',
                steps: [
                    'Aceda ao POS através do menu lateral',
                    'Pesquise produtos pelo nome ou código',
                    'Clique no produto para adicionar ao carrinho',
                    'Ajuste quantidades se necessário',
                    'Selecione o cliente (opcional)',
                    'Escolha o método de pagamento',
                    'Finalize a venda'
                ],
                tips: ['Use o leitor de código de barras para maior rapidez', 'Pode aplicar descontos antes de finalizar']
            },
            {
                id: 'payment-methods',
                title: 'Métodos de pagamento',
                content: 'O sistema suporta múltiplos métodos de pagamento.',
                steps: [
                    'Dinheiro - Introduza o valor recebido para calcular troco',
                    'M-Pesa - Confirme a transação no telemóvel',
                    'Cartão - Use o terminal de pagamento',
                    'Transferência - Aguarde confirmação bancária'
                ],
                tips: ['Pode dividir o pagamento entre vários métodos', 'Vendas a crédito requerem selecção de cliente']
            },
            {
                id: 'print-receipt',
                title: 'Imprimir recibo',
                content: 'Imprima recibos para os clientes após cada venda.',
                steps: [
                    'Após finalizar a venda, clique em "Imprimir Recibo"',
                    'Selecione a impressora configurada',
                    'O recibo será impresso automaticamente'
                ],
                tips: ['Configure a impressora em Definições > Impressora', 'Pode reimprimir recibos anteriores na secção de Vendas']
            }
        ]
    },
    {
        id: 'inventory',
        title: 'Gestão de Stock',
        icon: HiOutlineCube,
        color: '#8B5CF6',
        description: 'Controlo completo do inventário',
        topics: [
            {
                id: 'add-product',
                title: 'Adicionar produtos',
                content: 'Registe novos produtos no sistema com todos os detalhes.',
                steps: [
                    'Aceda a Inventário no menu',
                    'Clique em "Novo Produto"',
                    'Preencha os dados obrigatórios: código, nome, preço',
                    'Adicione informações adicionais como categoria e fornecedor',
                    'Defina o stock mínimo para alertas',
                    'Clique em "Guardar"'
                ],
                tips: ['Use códigos de barras para facilitar a identificação', 'Defina margens de lucro adequadas']
            },
            {
                id: 'stock-adjustment',
                title: 'Ajustar stock',
                content: 'Corrija o stock quando houver diferenças entre sistema e físico.',
                steps: [
                    'Localize o produto no Inventário',
                    'Clique no botão de ajuste de stock',
                    'Selecione o tipo: Entrada ou Saída',
                    'Indique a quantidade e motivo',
                    'Confirme o ajuste'
                ],
                tips: ['Faça inventários regulares', 'Documente sempre o motivo dos ajustes']
            },
            {
                id: 'low-stock-alerts',
                title: 'Alertas de stock baixo',
                content: 'O sistema alerta automaticamente quando produtos atingem stock mínimo.',
                steps: [
                    'Configure o stock mínimo em cada produto',
                    'Aceda a Alertas no menu para ver notificações',
                    'Produtos com stock baixo aparecem destacados'
                ],
                tips: ['Revise os alertas diariamente', 'Configure notificações por email se disponível']
            }
        ]
    },
    {
        id: 'crm',
        title: 'Gestão de Clientes (CRM)',
        icon: HiOutlineUsers,
        color: '#EC4899',
        description: 'Relacionamento e fidelização de clientes',
        topics: [
            {
                id: 'add-customer',
                title: 'Registar clientes',
                content: 'Mantenha uma base de dados completa dos seus clientes.',
                steps: [
                    'Aceda a Clientes no menu',
                    'Clique em "Novo Cliente"',
                    'Preencha os dados: nome, contacto, NUIT',
                    'Adicione endereço para entregas',
                    'Guarde o registo'
                ],
                tips: ['Clientes registados podem comprar a crédito', 'O histórico de compras fica automaticamente associado']
            },
            {
                id: 'customer-history',
                title: 'Histórico de compras',
                content: 'Veja todo o histórico de transações de um cliente.',
                steps: [
                    'Aceda ao perfil do cliente',
                    'Clique na aba "Histórico"',
                    'Veja todas as compras e valores gastos'
                ],
                tips: ['Use o histórico para ofertas personalizadas', 'Identifique padrões de compra']
            }
        ]
    },
    {
        id: 'hr',
        title: 'Recursos Humanos',
        icon: HiOutlineBriefcase,
        color: '#F59E0B',
        description: 'Gestão de funcionários e salários',
        topics: [
            {
                id: 'add-employee',
                title: 'Registar funcionários',
                content: 'Registe todos os colaboradores da empresa.',
                steps: [
                    'Aceda a Funcionários no menu',
                    'Clique em "Novo Funcionário"',
                    'Preencha dados pessoais e profissionais',
                    'Defina o salário base e subsídios',
                    'Configure horário de trabalho'
                ],
                tips: ['Mantenha os dados sempre actualizados', 'Configure permissões de acesso adequadas']
            },
            {
                id: 'attendance',
                title: 'Controlo de presenças',
                content: 'Registe a assiduidade dos funcionários.',
                steps: [
                    'Aceda a RH > Presenças',
                    'Selecione o funcionário e a data',
                    'Marque como Presente, Ausente ou Justificado',
                    'Adicione notas se necessário'
                ],
                tips: ['Revise as presenças antes do processamento de salários', 'Faltas injustificadas afectam o salário']
            }
        ]
    },
    {
        id: 'fiscal',
        title: 'Módulo Fiscal',
        icon: HiOutlineDocumentText,
        color: '#14B8A6',
        description: 'Gestão de impostos e facturas',
        topics: [
            {
                id: 'invoice-types',
                title: 'Tipos de documentos',
                content: 'O sistema emite vários tipos de documentos fiscais.',
                steps: [
                    'Factura (FT) - Documento fiscal completo',
                    'Factura Simplificada (FS) - Para valores até 5.000 MT',
                    'Recibo (RC) - Comprovativo de pagamento',
                    'Nota de Crédito (NC) - Para devoluções'
                ],
                tips: ['Escolha o tipo correcto para cada situação', 'Todos os documentos são numerados automaticamente']
            },
            {
                id: 'tax-reports',
                title: 'Relatórios fiscais',
                content: 'Gere relatórios para declarações fiscais.',
                steps: [
                    'Aceda a Fiscal > Relatórios',
                    'Selecione o período (mês/trimestre)',
                    'Escolha o tipo de relatório',
                    'Exporte em PDF ou Excel'
                ],
                tips: ['Guarde cópias dos relatórios mensais', 'Verifique os dados antes de submeter às autoridades']
            }
        ]
    },
    {
        id: 'reports',
        title: 'Relatórios e Análises',
        icon: HiOutlineChartBar,
        color: '#6366F1',
        description: 'Insights e métricas do negócio',
        topics: [
            {
                id: 'sales-reports',
                title: 'Relatórios de vendas',
                content: 'Analise o desempenho das vendas.',
                steps: [
                    'Aceda a Relatórios no menu',
                    'Selecione "Vendas" como tipo',
                    'Escolha o período de análise',
                    'Clique em "Gerar Relatório"'
                ],
                tips: ['Compare períodos para identificar tendências', 'Exporte para Excel para análises avançadas']
            },
            {
                id: 'export-data',
                title: 'Exportar dados',
                content: 'Exporte relatórios em PDF ou Excel.',
                steps: [
                    'Gere o relatório desejado',
                    'Clique no botão de exportação',
                    'Escolha PDF para impressão ou Excel para análise',
                    'O ficheiro será descarregado automaticamente'
                ],
                tips: ['PDFs são ideais para arquivo', 'Excel permite manipular os dados']
            }
        ]
    },
    // MODULE-SPECIFIC SECTIONS
    {
        id: 'pharmacy',
        title: 'Módulo Farmácia',
        icon: HiOutlineBeaker,
        color: '#10B981',
        description: 'Gestão especializada para farmácias',
        moduleCode: 'PHARMACY',
        topics: [
            {
                id: 'medications',
                title: 'Gestão de medicamentos',
                content: 'Registe e gerencie medicamentos com informações farmacêuticas.',
                steps: [
                    'Aceda a Farmácia > Medicamentos',
                    'Clique em "Novo Medicamento"',
                    'Preencha: DCI, dosagem, forma farmacêutica',
                    'Indique se requer receita ou é controlado',
                    'Configure temperatura de armazenamento',
                    'Associe lotes com validade'
                ],
                tips: ['Use o código ATC para classificação internacional', 'Medicamentos controlados requerem registo especial']
            },
            {
                id: 'prescriptions',
                title: 'Gestão de receitas',
                content: 'Registe receitas médicas e dispense medicamentos.',
                steps: [
                    'Aceda a Farmácia > Receitas',
                    'Clique em "Nova Receita"',
                    'Preencha dados do prescritor e paciente',
                    'Adicione os medicamentos prescritos',
                    'Dispense pela venda no POS'
                ],
                tips: ['Verifique sempre a validade da receita', 'Controlados requerem retenção de cópia']
            },
            {
                id: 'batch-expiry',
                title: 'Controlo de validade',
                content: 'Monitorize lotes e datas de validade.',
                steps: [
                    'Aceda a Farmácia > Stock',
                    'Veja alertas de produtos a expirar',
                    'Priorize vendas por FEFO (First Expire, First Out)',
                    'Registe quebras de produtos vencidos'
                ],
                tips: ['Configure alertas para 90 dias antes da validade', 'Separe produtos vencidos imediatamente']
            },
            {
                id: 'sarr-report',
                title: 'Relatório SARR',
                content: 'Gere relatórios para o Ministério da Saúde.',
                steps: [
                    'Aceda a Farmácia > Auditoria',
                    'Selecione o período do relatório',
                    'Clique em "Gerar SARR"',
                    'Revise os dados e exporte em PDF'
                ],
                tips: ['O SARR é obrigatório para substâncias controladas', 'Mantenha registos por 5 anos']
            }
        ]
    },
    {
        id: 'hospitality',
        title: 'Módulo Hotelaria',
        icon: HiOutlineHomeModern,
        color: '#F59E0B',
        description: 'Gestão de quartos e reservas',
        moduleCode: 'HOSPITALITY',
        topics: [
            {
                id: 'room-management',
                title: 'Gestão de quartos',
                content: 'Configure e gerencie os quartos do hotel.',
                steps: [
                    'Aceda a Hotel > Quartos',
                    'Adicione quartos com tipo e preço',
                    'Configure amenidades disponíveis',
                    'Defina políticas de cancelamento'
                ],
                tips: ['Mantenha fotos actualizadas dos quartos', 'Ajuste preços por época']
            },
            {
                id: 'reservations',
                title: 'Gestão de reservas',
                content: 'Crie e gerencie reservas de hóspedes.',
                steps: [
                    'Aceda a Hotel > Reservas',
                    'Clique em "Nova Reserva"',
                    'Selecione datas e tipo de quarto',
                    'Registe dados do hóspede',
                    'Confirme a reserva'
                ],
                tips: ['Verifique disponibilidade antes de confirmar', 'Envie confirmação por email ao hóspede']
            },
            {
                id: 'checkin-checkout',
                title: 'Check-in e Check-out',
                content: 'Processe entrada e saída de hóspedes.',
                steps: [
                    'No dia de chegada, abra a reserva',
                    'Verifique documentos do hóspede',
                    'Clique em "Fazer Check-in"',
                    'No dia de saída, processe o Check-out',
                    'Gere a factura final'
                ],
                tips: ['Verifique consumos extras antes do check-out', 'Solicite avaliação do serviço']
            }
        ]
    },
    {
        id: 'logistics',
        title: 'Módulo Logística',
        icon: HiOutlineTruck,
        color: '#6366F1',
        description: 'Gestão de frotas e entregas',
        moduleCode: 'LOGISTICS',
        topics: [
            {
                id: 'vehicles',
                title: 'Gestão de veículos',
                content: 'Registe e monitorize a frota de veículos.',
                steps: [
                    'Aceda a Logística > Veículos',
                    'Adicione veículos com matrícula e tipo',
                    'Configure manutenções programadas',
                    'Atribua motoristas responsáveis'
                ],
                tips: ['Mantenha documentação actualizada', 'Programe revisões preventivas']
            },
            {
                id: 'deliveries',
                title: 'Gestão de entregas',
                content: 'Crie e acompanhe entregas.',
                steps: [
                    'Aceda a Logística > Entregas',
                    'Crie nova entrega com destino',
                    'Atribua veículo e motorista',
                    'Acompanhe o estado em tempo real'
                ],
                tips: ['Agrupe entregas por zona', 'Notifique clientes sobre o estado']
            }
        ]
    },
    {
        id: 'bottle-store',
        title: 'Módulo Garrafeira',
        icon: HiOutlineBuildingStorefront,
        color: '#8B5CF6',
        description: 'Gestão especializada de bebidas',
        moduleCode: 'BOTTLE_STORE',
        topics: [
            {
                id: 'beverages',
                title: 'Gestão de bebidas',
                content: 'Registe bebidas com todas as informações relevantes.',
                steps: [
                    'Aceda a Garrafeira > Produtos',
                    'Adicione bebidas com categoria e formato',
                    'Configure preços por unidade e caixa',
                    'Defina stock mínimo'
                ],
                tips: ['Organize por tipo: cervejas, vinhos, espirituosas', 'Controle temperatura de refrigerados']
            },
            {
                id: 'returnables',
                title: 'Gestão de retornáveis',
                content: 'Controle cascos e garrafas retornáveis.',
                steps: [
                    'Configure produtos retornáveis',
                    'Registe saída com a venda',
                    'Registe retorno na devolução',
                    'Acompanhe saldo de retornáveis por cliente'
                ],
                tips: ['Cobre caução de vasilhame', 'Reconcilie mensalmente com fornecedores']
            }
        ]
    },
    // FAQ Section
    {
        id: 'faq',
        title: 'Perguntas Frequentes',
        icon: HiOutlineQuestionMarkCircle,
        color: '#EF4444',
        description: 'Respostas às dúvidas mais comuns',
        topics: [
            {
                id: 'forgot-password',
                title: 'Esqueci a minha senha',
                content: 'Clique em "Esqueci minha senha" no ecrã de login. Receberá um email com instruções para redefinir.',
                tips: ['Verifique a pasta de spam', 'O link expira em 24 horas']
            },
            {
                id: 'no-products',
                title: 'Não aparecem produtos no POS',
                content: 'Verifique se os produtos têm stock disponível e se estão activos. Actualize a página se necessário.',
                tips: ['Verifique filtros activos', 'Confirme que os produtos têm preço definido']
            },
            {
                id: 'print-error',
                title: 'Erro ao imprimir',
                content: 'Verifique se a impressora está ligada e configurada correctamente em Definições > Impressora.',
                tips: ['Teste com uma impressão de teste', 'Verifique papel e tinta']
            },
            {
                id: 'data-backup',
                title: 'Como fazer backup dos dados',
                content: 'Os dados são guardados automaticamente na cloud. Pode exportar relatórios específicos em qualquer altura.',
                tips: ['Exporte dados críticos regularmente', 'O sistema faz backups automáticos diários']
            }
        ]
    }
];

export default function Help() {
    const { hasModule } = useTenant();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState<string>('getting-started');
    const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

    // Filter sections based on active modules
    const visibleSections = useMemo(() => {
        return HELP_SECTIONS.filter(section => {
            if (!section.moduleCode) return true; // Core sections always visible
            return hasModule(section.moduleCode);
        });
    }, [hasModule]);

    // Filter by search
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return visibleSections;

        const query = searchQuery.toLowerCase();
        return visibleSections.map(section => ({
            ...section,
            topics: section.topics.filter(topic =>
                topic.title.toLowerCase().includes(query) ||
                topic.content.toLowerCase().includes(query) ||
                topic.steps?.some(s => s.toLowerCase().includes(query)) ||
                topic.tips?.some(t => t.toLowerCase().includes(query))
            )
        })).filter(section => section.topics.length > 0);
    }, [visibleSections, searchQuery]);

    const currentSection = filteredSections.find(s => s.id === activeSection) || filteredSections[0];

    const toggleTopic = (topicId: string) => {
        setExpandedTopics(prev => {
            const next = new Set(prev);
            if (next.has(topicId)) {
                next.delete(topicId);
            } else {
                next.add(topicId);
            }
            return next;
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900">
            {/* Header */}
            <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-800 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                            <HiOutlineBookOpen className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">Centro de Ajuda</h1>
                            <p className="text-primary-100 font-medium">Guias, tutoriais e respostas às suas dúvidas</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative max-w-xl">
                        <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Pesquisar ajuda..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar - Section Navigation */}
                    <div className="lg:col-span-1">
                        <Card className="sticky top-24 p-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4 px-2">
                                Categorias
                            </h3>
                            <nav className="space-y-1">
                                {filteredSections.map(section => {
                                    const Icon = section.icon;
                                    const isActive = activeSection === section.id;
                                    return (
                                        <button
                                            key={section.id}
                                            onClick={() => setActiveSection(section.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                                                isActive
                                                    ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                                                    : "hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-700 dark:text-gray-300"
                                            )}
                                        >
                                            <div
                                                className="p-1.5 rounded-lg"
                                                style={{ backgroundColor: `${section.color}20` }}
                                            >
                                                <Icon className="w-4 h-4" style={{ color: section.color }} />
                                            </div>
                                            <span className="text-sm font-semibold truncate">{section.title}</span>
                                            <span className="ml-auto text-xs text-gray-400 bg-gray-100 dark:bg-dark-600 px-2 py-0.5 rounded-full">
                                                {section.topics.length}
                                            </span>
                                        </button>
                                    );
                                })}
                            </nav>

                            {/* Quick Links */}
                            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-700">
                                <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3 px-2">
                                    Suporte
                                </h3>
                                <div className="space-y-2">
                                    <a
                                        href="mailto:suporte@sistema.co.mz"
                                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary-600 transition-colors"
                                    >
                                        <HiOutlineSupport className="w-4 h-4" />
                                        Contactar Suporte
                                    </a>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3">
                        {currentSection && (
                            <div className="space-y-6">
                                {/* Section Header */}
                                <div className="flex items-center gap-4">
                                    <div
                                        className="p-3 rounded-2xl"
                                        style={{ backgroundColor: `${currentSection.color}20` }}
                                    >
                                        <currentSection.icon
                                            className="w-6 h-6"
                                            style={{ color: currentSection.color }}
                                        />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                                            {currentSection.title}
                                        </h2>
                                        <p className="text-gray-500 dark:text-gray-400">
                                            {currentSection.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Topics */}
                                <div className="space-y-4">
                                    {currentSection.topics.map(topic => {
                                        const isExpanded = expandedTopics.has(topic.id);
                                        return (
                                            <Card key={topic.id} className="overflow-hidden">
                                                <button
                                                    onClick={() => toggleTopic(topic.id)}
                                                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors"
                                                >
                                                    <span className="font-bold text-gray-900 dark:text-white">
                                                        {topic.title}
                                                    </span>
                                                    {isExpanded ? (
                                                        <HiOutlineChevronDown className="w-5 h-5 text-gray-400" />
                                                    ) : (
                                                        <HiOutlineChevronRight className="w-5 h-5 text-gray-400" />
                                                    )}
                                                </button>

                                                {isExpanded && (
                                                    <div className="px-5 pb-5 border-t border-gray-100 dark:border-dark-700 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                                                            {topic.content}
                                                        </p>

                                                        {topic.steps && topic.steps.length > 0 && (
                                                            <div className="mb-4">
                                                                <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">
                                                                    Passos
                                                                </h4>
                                                                <ol className="space-y-2">
                                                                    {topic.steps.map((step, idx) => (
                                                                        <li
                                                                            key={idx}
                                                                            className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300"
                                                                        >
                                                                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold">
                                                                                {idx + 1}
                                                                            </span>
                                                                            {step}
                                                                        </li>
                                                                    ))}
                                                                </ol>
                                                            </div>
                                                        )}

                                                        {topic.tips && topic.tips.length > 0 && (
                                                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <HiOutlineLightBulb className="w-4 h-4 text-amber-600" />
                                                                    <span className="text-xs font-black uppercase tracking-wider text-amber-600">
                                                                        Dicas
                                                                    </span>
                                                                </div>
                                                                <ul className="space-y-1">
                                                                    {topic.tips.map((tip, idx) => (
                                                                        <li
                                                                            key={idx}
                                                                            className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2"
                                                                        >
                                                                            <span className="text-amber-500">•</span>
                                                                            {tip}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </Card>
                                        );
                                    })}
                                </div>

                                {/* No results */}
                                {currentSection.topics.length === 0 && (
                                    <Card className="p-12 text-center">
                                        <HiOutlineSearch className="w-12 h-12 mx-auto text-gray-300 dark:text-dark-600 mb-4" />
                                        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">
                                            Nenhum resultado encontrado
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400">
                                            Tente pesquisar com outros termos
                                        </p>
                                    </Card>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
