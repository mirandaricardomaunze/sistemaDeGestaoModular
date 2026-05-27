import { type ReactNode, useMemo } from 'react';
import { 
    useReactTable, 
    getCoreRowModel, 
    getSortedRowModel, 
    type ColumnDef, 
    type SortingState, 
    type OnChangeFn,
    type Table as TanStackTable
} from '@tanstack/react-table';
import { DataTable } from './DataTable';
import { Pagination } from './Pagination';
import { Card } from './Card';
import { Input } from './Input';
import { Button } from './Button';
import { ExportButton } from '../common/ExportButton';
import { HiOutlineMagnifyingGlass, HiOutlineArrowPath } from 'react-icons/hi2';
import { useCompanySettings } from '../../hooks/useSettings';
import type { ExportColumn } from '../../utils/exportUtils';
import { cn } from '../../utils/helpers';

interface SmartTableProps<TData> {
    /** Dados a serem exibidos */
    data: TData[];
    /** Definição das colunas */
    columns: ColumnDef<TData, unknown>[];
    /** Estado de carregamento */
    isLoading?: boolean;
    /** Estado de erro */
    isError?: boolean;
    /** Mensagem de erro */
    errorMessage?: string;
    /** Callback para tentar novamente após erro */
    onRetry?: () => void;
    
    /** Configuração de pesquisa */
    search?: {
        value: string;
        onChange: (value: string) => void;
        placeholder?: string;
    };
    
    /** Configuração de paginação */
    pagination?: {
        currentPage: number;
        totalItems: number;
        itemsPerPage: number;
        onPageChange: (page: number) => void;
        onItemsPerPageChange?: (size: number) => void;
        itemsPerPageOptions?: number[];
    };
    
    /** Estado de ordenação (controlado) */
    sorting?: SortingState;
    /** Callback para mudança de ordenação */
    onSortingChange?: OnChangeFn<SortingState>;
    
    /** Configuração de exportação */
    exportConfig?: {
        filename: string;
        title: string;
        columns: ExportColumn[];
        orientation?: 'portrait' | 'landscape';
    };
    
    /** Slot para filtros adicionais (Selects, DatePickers, etc) */
    renderFilters?: ReactNode;
    /** Slot para acções adicionais no cabeçalho */
    actions?: ReactNode;
    
    /** Título quando a tabela está vazia */
    emptyTitle?: string;
    /** Descrição quando a tabela está vazia */
    emptyDescription?: string;
    /** Acção a executar quando vazia (ex: "Novo Item") */
    onEmptyAction?: () => void;
    /** Label para o botão de acção vazia */
    emptyActionLabel?: string;
    /** Altura mínima do contentor da tabela */
    minHeight?: string | number;
    /** Classes CSS adicionais para o contentor */
    className?: string;
    
    /** Instância de tabela externa (opcional, para casos complexos) */
    tableInstance?: TanStackTable<TData>;
    
    /** Callback para botão de refresh manual */
    onRefresh?: () => void | Promise<unknown>;
    /** Label para o botão de refresh manual */
    refreshLabel?: string;
    
    /** Se deve esconder a barra de filtros/pesquisa */
    hideToolbar?: boolean;
    
    /** Função para renderizar o conteúdo expandido de uma linha */
    expandedRowRender?: (data: TData) => ReactNode;
    /** ID da linha que está expandida */
    expandedId?: string | number | null;
    rowClassName?: (data: TData) => string | undefined;

    /**
     * Renderiza cada linha como Card em viewports < md (mobile).
     * Quando definido, a tabela é escondida em mobile e substituída por uma
     * lista vertical de cards. Em >= md, mantém o comportamento normal.
     */
    mobileCardRender?: (row: TData) => ReactNode;
}

/**
 * SmartTable - Um componente de alto nível que unifica as funcionalidades padrão de tabelas do sistema.
 * 
 * Integra automaticamente:
 * - DataTable (TanStack Table)
 * - Barra de Pesquisa
 * - Filtros (via slots)
 * - Botão de Exportação (PDF/Excel)
 * - Paginação
 * - Estados de Carregamento e Vazio
 */
export function SmartTable<TData extends { id?: string | number }>({
    data,
    columns,
    isLoading = false,
    isError = false,
    errorMessage,
    onRetry,
    search,
    pagination,
    sorting,
    onSortingChange,
    exportConfig,
    renderFilters,
    actions,
    emptyTitle,
    emptyDescription,
    onEmptyAction,
    emptyActionLabel,
    minHeight = '450px',
    className,
    tableInstance,
    onRefresh,
    refreshLabel = 'Atualizar',
    hideToolbar = false,
    expandedRowRender,
    expandedId,
    rowClassName,
    mobileCardRender,
}: SmartTableProps<TData>) {
    const { settings: companySettings } = useCompanySettings();

    // Criar instância da tabela se não for fornecida externamente
    const internalTable = useReactTable({
        data,
        columns,
        state: {
            sorting,
        },
        onSortingChange,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
    });

    const table = tableInstance || internalTable;

    // Colunas formatadas para exportação (se configurado)
    const exportOptions = useMemo(() => {
        if (!exportConfig) return null;
        return {
            columns: exportConfig.columns,
            data: data as object[],
            orientation: exportConfig.orientation,
            companyName: companySettings?.companyName,
        };
    }, [exportConfig, data, companySettings]);

    return (
        <div className={cn("space-y-4", className)}>
            {/* Toolbar: Search, Filters & Actions */}
            {!hideToolbar && (
                <Card padding="md" className="relative z-20 overflow-visible bg-white dark:bg-dark-900/50 border border-slate-300/70 dark:border-white/10 shadow-card">
                    <div className="flex min-w-0 flex-col items-stretch gap-3 lg:flex-row lg:items-end lg:gap-4">
                        {/* Pesquisa */}
                        {search && (
                            <div className="min-w-0 flex-1">
                                <Input
                                    placeholder={search.placeholder || "Pesquisar..."}
                                    value={search.value}
                                    onChange={(e) => search.onChange(e.target.value)}
                                    leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5 text-primary-500" />}
                                    className="bg-white dark:bg-dark-800"
                                    size="sm"
                                />
                            </div>
                        )}

                        {/* Filtros Personalizados */}
                        {renderFilters && (
                            <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
                                {renderFilters}
                            </div>
                        )}

                        {/* Acções, Refresh & Exportação */}
                        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:ml-auto lg:w-auto lg:justify-end [&>*]:w-full sm:[&>*]:w-auto">
                            {actions}
                            
                            {onRefresh && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onRefresh}
                                    isLoading={isLoading}
                                    loadingText="Atualizando..."
                                    title="Atualizar dados"
                                    aria-label="Atualizar dados"
                                    leftIcon={<HiOutlineArrowPath className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                                    className="h-10 bg-white dark:bg-dark-800 shadow-sm"
                                >
                                    {refreshLabel}
                                </Button>
                            )}

                            {exportConfig && exportOptions && (
                                <ExportButton
                                    filename={exportConfig.filename}
                                    title={exportConfig.title}
                                    variant="outline"
                                    size="sm"
                                    options={exportOptions}
                                    className="shadow-sm"
                                    companyInfo={{
                                        name: companySettings?.companyName || 'MULTICORE',
                                        nuit: companySettings?.nuit,
                                        address: companySettings?.address,
                                        phone: companySettings?.phone,
                                        email: companySettings?.email
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </Card>
            )}

            {/* Mobile card list — < md (only when mobileCardRender provided) */}
            {mobileCardRender && !isLoading && !isError && data.length > 0 && (
                <div className="md:hidden space-y-2">
                    {data.map((row) => (
                        <div key={(row.id as string | number | undefined) ?? Math.random()}>
                            {mobileCardRender(row)}
                        </div>
                    ))}
                </div>
            )}

            {/* Table Container — hidden on mobile when mobileCardRender provided */}
            <Card
                padding="none"
                className={cn(
                    "border border-slate-300/70 dark:border-white/10 shadow-card overflow-hidden",
                    mobileCardRender && data.length > 0 && !isLoading && !isError && "hidden md:block"
                )}
            >
                <div className="max-w-full overflow-x-auto overscroll-x-contain scrollbar-thin">
                    <DataTable
                        table={table}
                        isLoading={isLoading}
                        isError={isError}
                        errorMessage={errorMessage}
                        onRetry={onRetry}
                        isEmpty={!isLoading && data.length === 0}
                        emptyTitle={emptyTitle}
                        emptyDescription={emptyDescription}
                        onEmptyAction={onEmptyAction}
                        emptyActionLabel={emptyActionLabel}
                        minHeight={minHeight}
                        renderExpandedRow={expandedRowRender}
                        isRowExpanded={(row) => row.id === expandedId}
                        rowClassName={rowClassName}
                    />
                </div>

                {/* Paginação */}
                {pagination && pagination.totalItems > 0 && (
                    <div className="px-3 sm:px-6 border-t border-slate-200/80 dark:border-dark-700 bg-slate-50/90 dark:bg-dark-900/30">
                        <Pagination
                            currentPage={pagination.currentPage}
                            totalItems={pagination.totalItems}
                            itemsPerPage={pagination.itemsPerPage}
                            onPageChange={pagination.onPageChange}
                            onItemsPerPageChange={pagination.onItemsPerPageChange}
                            itemsPerPageOptions={pagination.itemsPerPageOptions || [10, 25, 50, 100]}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
}
