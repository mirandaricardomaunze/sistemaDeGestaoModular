import { type ReactNode } from 'react';
import { flexRender, type Table as TanStackTable } from '@tanstack/react-table';
import { LoadingSpinner, Button } from './index';
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
}: TableContainerProps) {
    return (
        <div className={cn("overflow-x-auto relative transition-all duration-300", className)} style={{ minHeight }}>
            {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-dark-800/50 z-10 backdrop-blur-[1px]">
                    <LoadingSpinner size="lg" />
                </div>
            ) : isError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white dark:bg-dark-900 border-2 border-red-50/50 dark:border-red-900/10">
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
                        icon={emptyIcon || <HiOutlineMagnifyingGlass className="w-12 h-12 text-gray-300" />}
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
}

export function DataTable<TData>({
    table,
    isLoading,
    isEmpty,
    ...props
}: DataTableProps<TData>) {
    const isDataEmpty = isEmpty || table.getRowModel().rows.length === 0;

    return (
        <TableContainer isLoading={isLoading} isEmpty={isDataEmpty} {...props}>
            <table className="min-w-full divide-y divide-slate-200/60 dark:divide-dark-700/50">
                <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-slate-50/50 dark:bg-dark-800 cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-dark-700 transition-colors"
                                    style={{ minHeight: '48px' }}
                                    onClick={header.column.getToggleSortingHandler()}
                                >
                                    <div className="flex items-center gap-2">
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
                <tbody className="divide-y divide-slate-200/60 dark:divide-dark-700/50">
                    {table.getRowModel().rows.map((row) => (
                        <tr
                            key={row.id}
                            className="bg-white dark:bg-dark-900 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors"
                        >
                            {row.getVisibleCells().map((cell) => (
                                <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </TableContainer>
    );
}
