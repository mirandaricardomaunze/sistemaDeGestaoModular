import { useState, useMemo, useEffect } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    createColumnHelper,
    type SortingState,
    type ColumnFiltersState,
} from '@tanstack/react-table';
import { HiOutlineSearch, HiOutlinePencil, HiOutlineTrash, HiOutlineEye, HiOutlineOfficeBuilding, HiOutlineRefresh, HiOutlinePlusCircle, HiOutlineClock } from 'react-icons/hi';
import { Button, Badge, Modal, Card, Input, Select, Pagination, DataTable } from '../ui';
import StockAdjustmentModal from './StockAdjustmentModal';
import { ProductStockHistory } from './ProductStockHistory';
import { ExportProductsButton } from '../common/ExportButton';
import { formatCurrency, cn } from '../../utils/helpers';
import { categoryLabels, statusLabels } from '../../utils/constants';
import type { Product, ProductCategory, StockStatus } from '../../types';

import { useProducts, useWarehouses } from '../../hooks/useData';

const columnHelper = createColumnHelper<Product>();

interface InventoryTableProps {
    onEdit?: (product: Product) => void;
    onView?: (product: Product) => void;
    onAddProduct?: () => void;
    initialSearch?: string;
}

export default function InventoryTable({ onEdit, onView, onAddProduct, initialSearch }: InventoryTableProps) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all');
    const [selectedStatus, setSelectedStatus] = useState<StockStatus | 'all'>('all');
    const [selectedWarehouse, setSelectedWarehouse] = useState<string | 'all'>('all');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Sync global filter with initial search
    useEffect(() => {
        if (initialSearch !== undefined) {
            setGlobalFilter(initialSearch);
        }
    }, [initialSearch]);

    // Use API hooks with pagination and filters
    const { products, pagination, isLoading, refetch, deleteProduct } = useProducts({
        search: globalFilter,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        warehouseId: selectedWarehouse === 'all' ? undefined : selectedWarehouse,
        page,
        limit: pageSize,
        sortBy: sorting[0]?.id || 'name',
        sortOrder: sorting[0]?.desc ? 'desc' : 'asc'
    });
    const { warehouses } = useWarehouses();

    // Status badge colors
    const getStatusBadge = (status: StockStatus) => {
        const variants: Record<StockStatus, 'success' | 'warning' | 'danger'> = {
            in_stock: 'success',
            low_stock: 'warning',
            out_of_stock: 'danger',
        };
        return <Badge variant={variants[status]}>{statusLabels[status]}</Badge>;
    };

    // Define columns
    const columns = useMemo(
        () => [
            columnHelper.accessor('code', {
                header: 'Código',
                cell: (info) => (
                    <span className="font-mono text-sm font-medium text-primary-600 dark:text-primary-400">
                        {info.getValue()}
                    </span>
                ),
            }),
            columnHelper.accessor('name', {
                header: 'Nome',
                cell: (info) => (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                            <span className="text-lg">📦</span>
                        </div>
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">{info.getValue()}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {categoryLabels[info.row.original.category]}
                            </p>
                        </div>
                    </div>
                ),
            }),
            columnHelper.accessor('category', {
                header: 'Categoria',
                cell: (info) => (
                    <Badge variant="gray">{categoryLabels[info.getValue()]}</Badge>
                ),
            }),
            columnHelper.accessor('currentStock', {
                header: 'Estoque Atual',
                cell: (info) => {
                    const product = info.row.original;
                    const isLow = product.currentStock <= product.minStock;
                    return (
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    'font-semibold',
                                    isLow ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                                )}
                            >
                                {info.getValue()}
                            </span>
                            <span className="text-gray-400 text-sm">{product.unit}</span>
                            {isLow && (
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Estoque baixo" />
                            )}
                        </div>
                    );
                },
            }),
            columnHelper.accessor('minStock', {
                header: 'Estoque Mín.',
                cell: (info) => (
                    <span className="text-gray-600 dark:text-gray-400">{info.getValue()}</span>
                ),
            }),
            columnHelper.accessor('price', {
                header: 'Preço',
                cell: (info) => (
                    <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(info.getValue())}
                    </span>
                ),
            }),
            columnHelper.accessor('status', {
                header: 'Status',
                cell: (info) => getStatusBadge(info.getValue()),
            }),
            columnHelper.display({
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => {
                                setSelectedProduct(row.original);
                                setAdjustmentModalOpen(true);
                            }}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-green-600 transition-colors"
                            title="Ajustar Stock"
                        >
                            <HiOutlinePlusCircle className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                setSelectedProduct(row.original);
                                setHistoryModalOpen(true);
                            }}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-primary-600 transition-colors"
                            title="Ver Histórico de Stock"
                        >
                            <HiOutlineClock className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleView(row.original)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-primary-600 transition-colors"
                            title="Ver detalhes"
                        >
                            <HiOutlineEye className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onEdit?.(row.original)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-blue-600 transition-colors"
                            title="Editar"
                        >
                            <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleDeleteClick(row.original)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-500 hover:text-red-600 transition-colors"
                            title="Excluir"
                        >
                            <HiOutlineTrash className="w-4 h-4" />
                        </button>
                    </div>
                ),
            }),
        ],
        [onEdit]
    );

    // React Table instance
    const table = useReactTable({
        data: products,
        columns,
        state: {
            sorting,
            columnFilters,
            globalFilter,
        },
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
    });

    const handleView = (product: Product) => {
        setSelectedProduct(product);
        setDetailModalOpen(true);
        onView?.(product);
    };

    const handleDeleteClick = (product: Product) => {
        setProductToDelete(product);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (productToDelete) {
            setIsDeleting(true);
            try {
                await deleteProduct(productToDelete.id);
                setDeleteModalOpen(false);
                setProductToDelete(null);
            } catch (error) {
                console.error('Error deleting product:', error);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const categoryOptions = [
        { value: 'all', label: 'Todas as categorias' },
        ...Object.entries(categoryLabels).map(([value, label]) => ({ value, label })),
    ];

    const statusOptions = [
        { value: 'all', label: 'Todos os status' },
        ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
    ];

    const warehouseOptions = [
        { value: 'all', label: 'Todos os armazéns' },
        ...warehouses.map(w => ({ value: w.id, label: w.name })),
    ];

    // Loading logic handled by DataTable

    return (
        <div className="space-y-4">
            {/* Filters */}
            <Card padding="md">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1">
                        <Input
                            placeholder="Buscar por código, nome..."
                            value={globalFilter ?? ''}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="w-full lg:w-48">
                        <Select
                            options={categoryOptions}
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as ProductCategory | 'all')}
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="w-full lg:w-48">
                        <Select
                            options={statusOptions}
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value as StockStatus | 'all')}
                        />
                    </div>

                    {/* Warehouse Filter */}
                    <div className="w-full lg:w-48">
                        <Select
                            options={warehouseOptions}
                            value={selectedWarehouse}
                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                        />
                    </div>

                    {/* Export Button */}
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="md"
                            onClick={() => refetch()}
                            isLoading={isLoading}
                            title="Atualizar dados"
                        >
                            <HiOutlineRefresh className="w-5 h-5 text-gray-500" />
                        </Button>
                        <ExportProductsButton data={products} />
                    </div>
                </div>
            </Card>

            {/* Table */}
            <Card padding="none">
                <DataTable
                    table={table}
                    isLoading={isLoading}
                    isEmpty={products.length === 0}
                    emptyTitle="Nenhum produto encontrado"
                    emptyDescription="Tente ajustar seus filtros ou termos de busca."
                    onEmptyAction={onAddProduct}
                    emptyActionLabel="Novo Produto"
                    minHeight="450px"
                />

                {/* Pagination */}
                <div className="px-6">
                    <Pagination
                        currentPage={page}
                        totalItems={pagination?.total || 0}
                        itemsPerPage={pageSize}
                        onPageChange={setPage}
                        onItemsPerPageChange={(size) => {
                            setPageSize(size);
                            setPage(1);
                        }}
                        itemsPerPageOptions={[5, 10, 25, 50]}
                    />
                </div>
            </Card>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Confirmar Exclusão"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        Tem certeza que deseja excluir o produto{' '}
                        <strong className="text-gray-900 dark:text-white">{productToDelete?.name}</strong>?
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex gap-3 justify-end">
                        <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="danger" onClick={confirmDelete} isLoading={isDeleting}>
                            Excluir
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Product Detail Modal */}
            <Modal
                isOpen={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                title="Detalhes do Produto"
                size="lg"
            >
                {selectedProduct && (
                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                                <span className="text-4xl">📦</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    {selectedProduct.name}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Código: {selectedProduct.code}
                                </p>
                                <div className="mt-2">{getStatusBadge(selectedProduct.status)}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Categoria</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {categoryLabels[selectedProduct.category]}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Preço de Venda</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {formatCurrency(selectedProduct.price)}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Preço de Custo</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {formatCurrency(selectedProduct.costPrice)}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Estoque Atual</p>
                                <p className={cn(
                                    'text-sm font-medium mt-1',
                                    selectedProduct.currentStock <= selectedProduct.minStock
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-gray-900 dark:text-white'
                                )}>
                                    {selectedProduct.currentStock} {selectedProduct.unit}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Estoque Mínimo</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {selectedProduct.minStock} {selectedProduct.unit}
                                </p>
                            </div>
                            {selectedProduct.barcode && (
                                <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Código de Barras</p>
                                    <p className="text-sm font-mono font-medium text-gray-900 dark:text-white mt-1">
                                        {selectedProduct.barcode}
                                    </p>
                                </div>
                            )}
                            {selectedProduct.expiryDate && (
                                <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Validade</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                        {selectedProduct.expiryDate}
                                    </p>
                                </div>
                            )}
                            {selectedProduct.batchNumber && (
                                <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Lote</p>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                        {selectedProduct.batchNumber}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Warehouse Breakdown */}
                        <div className="border-t border-gray-100 dark:border-dark-600 pt-6">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                <HiOutlineOfficeBuilding className="w-5 h-5 text-primary-500" />
                                Distribuição por Armazém
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {warehouses.map(warehouse => {
                                    const stock = selectedProduct.stocks?.[warehouse.id] ?? (warehouse.id === '1' ? selectedProduct.currentStock : 0);
                                    return (
                                        <div key={warehouse.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-dark-700 rounded-lg border border-gray-100 dark:border-dark-600">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">{warehouse.name}</span>
                                                <span className="text-xs text-gray-500">{warehouse.location}</span>
                                            </div>
                                            <Badge variant={stock > 0 ? 'success' : 'gray'}>
                                                {stock} {selectedProduct.unit}
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {selectedProduct.description && (
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">Descrição</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {selectedProduct.description}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                            <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>
                                Fechar
                            </Button>
                            <Button onClick={() => {
                                setDetailModalOpen(false);
                                onEdit?.(selectedProduct);
                            }}>
                                Editar Produto
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Stock Adjustment Modal */}
            <StockAdjustmentModal
                isOpen={adjustmentModalOpen}
                onClose={() => setAdjustmentModalOpen(false)}
                product={selectedProduct}
                onSuccess={() => refetch()}
            />

            {/* Product Stock History Modal */}
            {selectedProduct && (
                <ProductStockHistory
                    isOpen={historyModalOpen}
                    onClose={() => setHistoryModalOpen(false)}
                    product={selectedProduct}
                />
            )}
        </div>
    );
}
