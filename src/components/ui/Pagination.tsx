import { useMemo, useState } from 'react';
import {
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineChevronDoubleLeft,
    HiOutlineChevronDoubleRight,
} from 'react-icons/hi';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange?: (items: number) => void;
    showItemsPerPage?: boolean;
    itemsPerPageOptions?: number[];
    showInfo?: boolean;
    className?: string;
}

export default function Pagination({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    showItemsPerPage = true,
    itemsPerPageOptions = [5, 10, 25, 50, 100],
    showInfo = true,
    className = '',
}: PaginationProps) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const { startItem, endItem } = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage + 1;
        const end = Math.min(currentPage * itemsPerPage, totalItems);
        return { startItem: start, endItem: end };
    }, [currentPage, itemsPerPage, totalItems]);

    // Generate page numbers to display
    const pageNumbers = useMemo(() => {
        const pages: (number | 'ellipsis')[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);

            if (currentPage > 3) {
                pages.push('ellipsis');
            }

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('ellipsis');
            }

            if (totalPages > 1) {
                pages.push(totalPages);
            }
        }

        return pages;
    }, [currentPage, totalPages]);

    return (
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-dark-700 ${className}`}>
            {showInfo && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    Mostrando <span className="font-medium text-gray-900 dark:text-white">{totalItems > 0 ? startItem : 0}</span> a{' '}
                    <span className="font-medium text-gray-900 dark:text-white">{totalItems > 0 ? endItem : 0}</span> de{' '}
                    <span className="font-medium text-gray-900 dark:text-white">{totalItems}</span> resultados
                </div>
            )}

            <div className="flex items-center gap-4">
                {showItemsPerPage && onItemsPerPageChange && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Por página:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                onItemsPerPageChange(Number(e.target.value));
                                onPageChange(1);
                            }}
                            className="px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            {itemsPerPageOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <nav className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1 || totalItems === 0}
                        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Primeira página"
                    >
                        <HiOutlineChevronDoubleLeft className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1 || totalItems === 0}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-200 dark:border-dark-700"
                        title="Página anterior"
                    >
                        <HiOutlineChevronLeft className="w-4 h-4" />
                        <span className="hidden md:inline">Anterior</span>
                    </button>

                    <div className="flex items-center gap-1">
                        {totalItems > 0 ? (
                            pageNumbers.map((page, index) => (
                                page === 'ellipsis' ? (
                                    <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                                        ...
                                    </span>
                                ) : (
                                    <button
                                        key={page}
                                        onClick={() => onPageChange(page)}
                                        className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                                            ? 'bg-primary-600 text-white shadow-sm'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                )
                            ))
                        ) : (
                            <button
                                disabled
                                className="min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium bg-primary-600 text-white shadow-sm opacity-50 cursor-not-allowed"
                            >
                                1
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || totalItems === 0}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-200 dark:border-dark-700"
                        title="Próxima página"
                    >
                        <span className="hidden md:inline">Próximo</span>
                        <HiOutlineChevronRight className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages || totalItems === 0}
                        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Última página"
                    >
                        <HiOutlineChevronDoubleRight className="w-4 h-4" />
                    </button>
                </nav>
            </div>
        </div>
    );
}

// Hook for pagination logic
export function usePagination<T>(items: T[] | undefined | null, initialItemsPerPage = 10) {
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

    // Ensure items is always an array
    const safeItems = Array.isArray(items) ? items : [];

    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return safeItems.slice(startIndex, startIndex + itemsPerPage);
    }, [safeItems, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(safeItems.length / itemsPerPage);

    // Reset to page 1 when items change significantly
    const resetToFirstPage = () => setCurrentPage(1);

    return {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems,
        totalItems: safeItems.length,
        totalPages,
        resetToFirstPage,
    };
}
