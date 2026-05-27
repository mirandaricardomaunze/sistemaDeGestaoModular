import React, { type ReactNode } from 'react';
import { flexRender, type Table as TanStackTable } from '@tanstack/react-table';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { cn } from '../../utils/helpers';
import { HiOutlineMagnifyingGlass } from 'react-icons/hi2';

interface TableContainerProps {
    children: ReactNode;
    isLoading?: boolean;
    isEmpty?: boolean;
    isError?: boolean;
    errorMessage?: string;
    onRetry?: () => void;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyIcon?: ReactNode;
    onEmptyAction?: () => void;
    emptyActionLabel?: string;
    minHeight?: string | number;
    className?: string;
    loadingRows?: number;
    loadingColumns?: number;
    loadingMessage?: string;
}

interface TableLoadingStateProps {
    rows?: number;
    columns?: number;
    message?: string;
    className?: string;
}

export function TableLoadingState({
    rows = 8,
    columns = 5,
    message = 'A carregar dados...',
    className,
}: TableLoadingStateProps) {
    return (
        <div className={cn('absolute inset-0 z-10 bg-white/96 dark:bg-dark-900/96', className)}>
            <div className="flex h-full min-h-[240px] flex-col">
                <div className="border-b border-slate-200/80 dark:border-dark-700 bg-slate-100 dark:bg-dark-800">
                    <div className="grid gap-4 px-6 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                        {Array.from({ length: columns }).map((_, index) => (
                            <div key={index} className="h-3 rounded-full bg-slate-300/80 dark:bg-dark-700 animate-pulse" />
                        ))}
                    </div>
                </div>

                <div className="flex-1 divide-y divide-slate-100 dark:divide-dark-700/60">
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <div
                            key={rowIndex}
                            className="grid gap-4 px-6 py-4"
                            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                        >
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <div
                                    key={colIndex}
                                    className={cn(
                                        'h-4 rounded-full bg-slate-200 dark:bg-dark-700 animate-pulse',
                                        colIndex === columns - 1 && 'w-2/3',
                                        colIndex === 0 && 'w-4/5'
                                    )}
                                />
                            ))}
                        </div>
                    ))}
                </div>

                <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center pointer-events-none">
                    <div className="inline-flex items-center gap-3 rounded-full border border-slate-200/90 dark:border-dark-700 bg-white dark:bg-dark-800 px-4 py-2 shadow-card">
                        <span className="h-2.5 w-2.5 rounded-full bg-primary-600 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-gray-400">
                            {message}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function TableContainer({
    children,
    isLoading,
    isEmpty,
    isError,
    errorMessage,
    onRetry,
    emptyTitle,
    emptyDescription,
    emptyIcon,
    onEmptyAction,
    emptyActionLabel,
    minHeight = '600px',
    className,
    loadingRows,
    loadingColumns,
    loadingMessage,
}: TableContainerProps) {
    return (
        <div className={cn("relative max-w-full overflow-x-auto overscroll-x-contain transition-all duration-300 scrollbar-thin", className)} style={{ minHeight }}>
            {isLoading ? (
                <TableLoadingState rows={loadingRows} columns={loadingColumns} message={loadingMessage} />
            ) : isError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white dark:bg-dark-900 border-2 border-red-100 dark:border-red-900/10">
                    <div className="text-red-500 mb-4 text-center">
                        <p className="font-semibold mb-2">Ocorreu um erro ao carregar os dados</p>
                        {errorMessage && <p className="text-sm opacity-80">{errorMessage}</p>}
                    </div>
                    {onRetry && (
                        <Button
                            onClick={onRetry}
                            variant="primary"
                            size="sm"
                        >
                            Tentar Novamente
                        </Button>
                    )}
                </div>
            ) : isEmpty ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white dark:bg-dark-900 rounded-lg">
                    <EmptyState
                        icon={emptyIcon || <HiOutlineMagnifyingGlass className="w-12 h-12 text-slate-400" />}
                        title={emptyTitle || "Nenhum resultado encontrado"}
                        description={emptyDescription || "Tente ajustar seus filtros ou termos de busca."}
                        action={onEmptyAction ? {
                            label: emptyActionLabel || "Adicionar Novo",
                            onClick: onEmptyAction
                        } : undefined}
                    />
                </div>
            ) : null}
            <div className={cn(isEmpty ? "invisible" : "visible")}>
                {children}
            </div>
        </div>
    );
}

interface DataTableProps<TData> extends Omit<TableContainerProps, 'children'> {
    table: TanStackTable<TData>;
    /** Função para renderizar o conteúdo expandido de uma linha */
    renderExpandedRow?: (data: TData) => ReactNode;
    /** Função para determinar se uma linha está expandida */
    isRowExpanded?: (data: TData) => boolean;
    rowClassName?: (data: TData) => string | undefined;
}

interface SimpleTableColumn {
    key: string;
    label: ReactNode;
    className?: string;
}

interface SimpleTableProps extends Omit<TableContainerProps, 'children' | 'isEmpty'> {
    columns: SimpleTableColumn[];
    children: ReactNode;
    isEmpty?: boolean;
    tableClassName?: string;
    theadClassName?: string;
    headerRowClassName?: string;
    tbodyClassName?: string;
}

export function SimpleTable({
    columns,
    children,
    isLoading,
    isEmpty,
    tableClassName,
    theadClassName,
    headerRowClassName,
    tbodyClassName,
    loadingColumns,
    ...props
}: SimpleTableProps) {
    return (
        <TableContainer
            isLoading={isLoading}
            isEmpty={isEmpty}
            loadingColumns={loadingColumns ?? columns.length}
            {...props}
        >
            <table className={cn('w-full min-w-[640px] text-sm border-collapse', tableClassName)}>
                <thead className={theadClassName}>
                    <tr
                        className={cn(
                            'text-[10px] text-slate-500 dark:text-gray-400 border-b border-slate-200/80 dark:border-dark-700 bg-slate-100 dark:bg-dark-800 uppercase tracking-[0.2em] font-black',
                            headerRowClassName
                        )}
                    >
                        {columns.map((column) => (
                            <th key={column.key} className={cn('px-4 sm:px-6 py-4 text-left align-middle', column.className)}>
                                <div className="min-w-0 break-words">{column.label}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className={cn('divide-y divide-slate-200/80 dark:divide-dark-700/50', tbodyClassName)}>
                    {children}
                </tbody>
            </table>
        </TableContainer>
    );
}

export function DataTable<TData>({
    table,
    isLoading,
    isEmpty,
    renderExpandedRow,
    isRowExpanded,
    rowClassName,
    ...props
}: DataTableProps<TData>) {
    const isDataEmpty = isEmpty || table.getRowModel().rows.length === 0;
    const visibleColumnCount = table.getVisibleLeafColumns().length || 5;

    return (
        <TableContainer
            isLoading={isLoading}
            isEmpty={isDataEmpty}
            loadingColumns={props.loadingColumns ?? visibleColumnCount}
            {...props}
        >
            <table className="w-full min-w-[720px] table-auto divide-y divide-slate-200/80 dark:divide-dark-700/50">
                <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    className="px-4 sm:px-6 py-4 text-left text-xs font-black text-slate-700 dark:text-gray-400 uppercase tracking-wider bg-slate-100 dark:bg-dark-800 cursor-pointer select-none hover:bg-slate-200/70 dark:hover:bg-dark-700 transition-colors align-middle"
                                    style={{ minHeight: '48px' }}
                                    onClick={header.column.getToggleSortingHandler()}
                                >
                                    <div className="flex min-w-0 items-center gap-2 break-words">
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                        {header.column.getIsSorted() && (
                                            <span className="text-primary-500">
                                                {header.column.getIsSorted() === 'asc' ? ' ↑' : ' ↓'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-dark-700/50">
                    {table.getRowModel().rows.map((row) => {
                        const isExpanded = isRowExpanded?.(row.original);
                        
                        return (
                            <React.Fragment key={row.id}>
                                <tr
                                    className={cn(
                                        "bg-white dark:bg-dark-900 transition-colors",
                                        isExpanded ? "bg-primary-50/40 dark:bg-primary-900/5" : "hover:bg-primary-50/50 dark:hover:bg-primary-900/10",
                                        rowClassName?.(row.original)
                                    )}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="max-w-[22rem] px-4 sm:px-6 py-4 align-middle">
                                            <div className="min-w-0 break-words [overflow-wrap:anywhere]">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                                {isExpanded && renderExpandedRow && (
                                    <tr>
                                        <td colSpan={row.getVisibleCells().length} className="px-0 py-0 border-none">
                                            {renderExpandedRow(row.original)}
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </TableContainer>
    );
}
