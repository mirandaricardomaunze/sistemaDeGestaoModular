import { useRef } from 'react';
import { flexRender, type Table as TanStackTable } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TableContainer } from './DataTable';
import { cn } from '../../utils/helpers';

interface VirtualTableProps<TData> {
    table: TanStackTable<TData>;
    rowHeight?: number;
    height?: number | string;
    overscan?: number;
    isLoading?: boolean;
    isError?: boolean;
    errorMessage?: string;
    onRetry?: () => void;
    emptyTitle?: string;
    emptyDescription?: string;
    onEndReached?: () => void;
    endReachedThreshold?: number;
    className?: string;
}

/**
 * Drop-in replacement for DataTable that virtualizes rows. Use this whenever
 * a table can render more than ~100 rows on screen — DOM cost is bounded by
 * the visible window, not the dataset size.
 */
export function VirtualTable<TData>({
    table,
    rowHeight = 56,
    height = 640,
    overscan = 10,
    isLoading,
    isError,
    errorMessage,
    onRetry,
    emptyTitle,
    emptyDescription,
    onEndReached,
    endReachedThreshold = 6,
    className,
}: VirtualTableProps<TData>) {
    const parentRef = useRef<HTMLDivElement>(null);
    const rows = table.getRowModel().rows;
    const isEmpty = rows.length === 0;

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight,
        overscan,
    });

    const virtualRows = virtualizer.getVirtualItems();
    const last = virtualRows[virtualRows.length - 1];
    if (onEndReached && last && last.index >= rows.length - endReachedThreshold) {
        queueMicrotask(onEndReached);
    }

    const totalSize = virtualizer.getTotalSize();
    const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
    const paddingBottom = virtualRows.length > 0
        ? totalSize - virtualRows[virtualRows.length - 1].end
        : 0;

    return (
        <TableContainer
            isLoading={isLoading}
            isEmpty={isEmpty}
            isError={isError}
            errorMessage={errorMessage}
            onRetry={onRetry}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            minHeight={height}
        >
            <div
                ref={parentRef}
                className={cn('overflow-auto', className)}
                style={{ height }}
            >
                <table className="min-w-full divide-y divide-slate-200/60 dark:divide-dark-700/50">
                    <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-dark-800/95 backdrop-blur">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:bg-slate-100/50 dark:hover:bg-dark-700 transition-colors"
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
                    <tbody>
                        {paddingTop > 0 && (
                            <tr><td style={{ height: paddingTop }} /></tr>
                        )}
                        {virtualRows.map((vRow) => {
                            const row = rows[vRow.index];
                            return (
                                <tr
                                    key={row.id}
                                    data-index={vRow.index}
                                    ref={virtualizer.measureElement}
                                    className="bg-white dark:bg-dark-900 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors border-b border-slate-200/60 dark:border-dark-700/50"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                        {paddingBottom > 0 && (
                            <tr><td style={{ height: paddingBottom }} /></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </TableContainer>
    );
}
