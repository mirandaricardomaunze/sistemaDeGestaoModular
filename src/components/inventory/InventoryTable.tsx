import { logger } from '../../utils/logger';
import { useState, useMemo, useEffect } from 'react';
import {
    createColumnHelper,
    type SortingState,
    type ColumnDef,
} from '@tanstack/react-table';
import { HiOutlinePencilSquare, HiOutlineTrash, HiOutlineEye, HiOutlinePlusCircle, HiOutlineClock, HiOutlineCube, HiOutlineBuildingOffice } from 'react-icons/hi2';
import { Button } from '../ui/Button';
import { Badge, type BadgeVariant } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { SmartTable } from '../ui/SmartTable';
import StockAdjustmentModal from './StockAdjustmentModal';
import ProductValiditiesSection from './ProductValiditiesSection';
import { ProductStockHistory } from './ProductStockHistory';
import { formatCurrency, cn } from '../../utils/helpers';
import { statusLabels, categoryLabels } from '../../utils/constants';
import type { Product, StockStatus } from '../../types';
import type { ExportColumn } from '../../utils/exportUtils';

import { useProducts, useWarehouses } from '../../hooks/useData';
import { useCategories } from '../../hooks/useSettings';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useDebounce } from '../../hooks/useDebounce';
import { playScanSound } from '../../utils/audio';
import toast from 'react-hot-toast';

const columnHelper = createColumnHelper<Product>();

interface InventoryTableProps {
    onEdit?: (product: Product) => void;
    onView?: (product: Product) => void;
    onAddProduct?: () => void;
    initialSearch?: string;
    originModule?: string;
    // Controlled Filter Props
    category?: string;
    onCategoryChange?: (category: string) => void;
    status?: string;
    onStatusChange?: (status: string) => void;
    warehouse?: string;
    onWarehouseChange?: (warehouse: string) => void;
    onSearchChange?: (search: string) => void;
}

export default function InventoryTable({ 
    onEdit, 
    onView, 
    onAddProduct, 
    initialSearch, 
    originModule = 'inventory',
    category: externalCategory,
    onCategoryChange,
    status: externalStatus,
    onStatusChange,
    warehouse: externalWarehouse,
    onWarehouseChange,
    onSearchChange
}: InventoryTableProps) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState(initialSearch || '');
    
    // Internal states for local fallback if not controlled
    const [localCategory, setLocalCategory] = useState<string>('all');
    const [localStatus, setLocalStatus] = useState<string>('all');
    const [localWarehouse, setLocalWarehouse] = useState<string>('all');

    const selectedCategory = externalCategory ?? localCategory;
    const selectedStatus = (externalStatus ?? localStatus) as StockStatus | 'all';
    const selectedWarehouse = externalWarehouse ?? localWarehouse;

    const handleCategoryChange = (val: string) => {
        onCategoryChange ? onCategoryChange(val) : setLocalCategory(val);
        setPage(1);
    };

    const handleStatusChange = (val: string) => {
        onStatusChange ? onStatusChange(val) : setLocalStatus(val);
        setPage(1);
    };

    const handleWarehouseChange = (val: string) => {
        onWarehouseChange ? onWarehouseChange(val) : setLocalWarehouse(val);
        setPage(1);
    };

    const handleSearchChange = (val: string) => {
        setGlobalFilter(val);
        onSearchChange?.(val);
        setPage(1);
    };
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Sync global filter with external search changes
    useEffect(() => {
        if (initialSearch !== undefined && initialSearch !== globalFilter) {
            setGlobalFilter(initialSearch);
        }
    }, [initialSearch]);

    // Debounced search avoids one network call per keystroke. Filters/page/sort
    // change immediately because they're not character-by-character.
    const debouncedSearch = useDebounce(globalFilter, 350);

    const { products, pagination, isLoading, refetch, deleteProduct } = useProducts({
        search: debouncedSearch,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        warehouseId: selectedWarehouse === 'all' ? undefined : selectedWarehouse,
        page,
        limit: pageSize,
        sortBy: sorting[0]?.id || 'name',
        sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
        originModule
    });

    const { warehouses } = useWarehouses();
    const { categories, isLoading: categoriesLoading } = useCategories();

    // Barcode Scanner Integration for Inventory Management
    useBarcodeScanner({
        onScan: (barcode) => {
            handleSearchChange(barcode);
            playScanSound();
            toast.success(`Código detectado: ${barcode}`, { duration: 2000 });
        },
        enabled: !deleteModalOpen && !detailModalOpen && !adjustmentModalOpen && !historyModalOpen
    });

    // Status badge colors
    const getStatusBadge = (status: StockStatus) => {
        const configs: Record<StockStatus, { variant: BadgeVariant; label: string; className: string }> = {
            in_stock: { 
                variant: 'success', 
                label: statusLabels[status], 
                className: 'bg-green-500/15 text-green-600 dark:text-green-300 border border-green-500/20 backdrop-blur-sm' 
            },
            low_stock: { 
                variant: 'warning', 
                label: statusLabels[status], 
                className: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/20 backdrop-blur-sm' 
            },
            out_of_stock: { 
                variant: 'danger', 
                label: statusLabels[status], 
                className: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20 backdrop-blur-sm' 
            },
        };
        const config = configs[status];
        return <Badge variant={config.variant} className={cn("font-black text-[9px] uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg", config.className)}>{config.label}</Badge>;
    };

    // Define columns
    const columns = useMemo<ColumnDef<Product, unknown>[]>(
        () => [
            columnHelper.accessor('barcode', {
                header: 'Código de Barras',
                cell: (info) => (
                    <span className="font-mono text-sm font-medium text-primary-600 dark:text-primary-400">
                        {info.getValue() || <span className="text-gray-300">N/A</span>}
                    </span>
                ),
            }),
            columnHelper.accessor('sku', {
                header: 'Referência',
                cell: (info) => {
                    const sku = info.getValue();
                    return (
                        <span className="font-mono text-sm font-medium text-gray-800 dark:text-gray-200">
                            {sku || <span className="text-gray-300">-</span>}
                        </span>
                    );
                },
            }),
            columnHelper.accessor('name', {
                header: 'Nome',
                cell: (info) => (
                    <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900 dark:text-white uppercase tracking-tight text-xs">
                            {info.getValue()}
                        </span>
                    </div>
                ),
            }),
            columnHelper.accessor('currentStock', {
                header: 'Caixas',
                cell: (info) => {
                    const product = info.row.original;
                    const displayStock = (selectedWarehouse !== 'all')
                        ? (product.warehouseStocks?.find(ws => ws.warehouseId === selectedWarehouse)?.quantity ?? 0)
                        : info.getValue();

                    const packSize = product.packSize && product.packSize > 1 ? product.packSize : 1;
                    const boxes = Math.floor(displayStock / packSize);
                    
                    return (
                        <div className="flex items-center gap-1">
                            <span className="font-black text-sm text-gray-900 dark:text-white">
                                {boxes}
                            </span>
                        </div>
                    );
                },
            }),
            columnHelper.display({
                id: 'total_calculated',
                header: 'Unidades',
                cell: ({ row }) => {
                    const product = row.original;
                    const displayStock = (selectedWarehouse !== 'all')
                        ? (product.warehouseStocks?.find(ws => ws.warehouseId === selectedWarehouse)?.quantity ?? 0)
                        : product.currentStock;
                    const isLow = displayStock <= product.minStock;

                    return (
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    'font-black text-sm',
                                    isLow ? 'text-red-500' : 'text-primary-600 dark:text-primary-400'
                                )}
                            >
                                {displayStock}
                            </span>
                            {isLow && (
                                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse" title="Estoque baixo" />
                            )}
                        </div>
                    );
                },
            }),
            columnHelper.accessor('price', {
                header: 'Preço de Venda',
                cell: (info) => {
                    const price = Number(info.getValue());
                    return (
                        <span className="font-black text-sm text-gray-900 dark:text-white tracking-tighter">
                            {formatCurrency(price)}
                        </span>
                    );
                },
            }),
            columnHelper.accessor('status', {
                header: 'Status',
                cell: (info) => getStatusBadge(info.getValue()),
            }),
            columnHelper.display({
                id: 'actions',
                header: 'Ações',
                cell: ({ row }) => (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setSelectedProduct(row.original);
                                setAdjustmentModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all border border-emerald-100/50 dark:border-emerald-500/20"
                            title="Ajustar Stock"
                        >
                            <HiOutlinePlusCircle className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                setSelectedProduct(row.original);
                                setHistoryModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all border border-indigo-100/50 dark:border-indigo-500/20"
                            title="Ver Histórico de Stock"
                        >
                            <HiOutlineClock className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleView(row.original)}
                            className="p-2 rounded-lg bg-primary-50/50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-all border border-primary-100/50 dark:border-primary-500/20"
                            title="Ver detalhes"
                        >
                            <HiOutlineEye className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => onEdit?.(row.original)}
                            className="p-2 rounded-lg bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all border border-blue-100/50 dark:border-blue-500/20"
                            title="Editar"
                        >
                            <HiOutlinePencilSquare className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleDeleteClick(row.original)}
                            className="p-2 rounded-lg bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border border-red-100/50 dark:border-red-500/20"
                            title="Excluir"
                        >
                            <HiOutlineTrash className="w-4 h-4" />
                        </button>
                    </div>
                ),
            }),
        ],
        [onEdit, selectedWarehouse]
    );


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
                logger.error('Error deleting product:', error);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const categoryOptions = [
        { value: 'all', label: 'Todas as categorias' },
        ...categories.map(c => ({ value: c.id, label: c.name })),
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

    const actions = (
        <Button 
            size="sm" 
            onClick={onAddProduct}
            leftIcon={<HiOutlinePlusCircle className="w-4 h-4" />}
            className="h-10 px-6 bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest border-none"
        >
            Novo Produto
        </Button>
    );

    return (
        <div className="space-y-4">
            {/* Smart Table with integrated Filters, Search and Export */}
            <SmartTable
                data={products}
                columns={columns}
                isLoading={isLoading}
                search={{
                    value: globalFilter,
                    onChange: handleSearchChange,
                    placeholder: "Buscar por código, nome..."
                }}
                pagination={{
                    currentPage: page,
                    totalItems: pagination?.total || 0,
                    itemsPerPage: pageSize,
                    onPageChange: setPage,
                    onItemsPerPageChange: (size) => {
                        setPageSize(size);
                        setPage(1);
                    }
                }}
                sorting={sorting}
                onSortingChange={setSorting}
                onRefresh={refetch}
                exportConfig={{
                    filename: 'inventario',
                    title: 'Relatório de Inventário',
                    columns: ([
                        { key: 'barcode', header: 'Código de Barras', width: 15 },
                        { key: 'sku', header: 'Referência', width: 15 },
                        { key: 'name', header: 'Nome', width: 30 },
                        { key: 'currentStock', header: 'Stock Atual', format: 'number', width: 10, align: 'right' },
                        { key: 'price', header: 'Preço Venda', format: 'currency', width: 15, align: 'right' },
                        { key: 'status', header: 'Estado', width: 12 },
                    ] satisfies ExportColumn[]).filter(col => !(originModule === 'commercial' && col.key === 'status'))
                }}
                renderFilters={
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Category Filter */}
                        <div className="w-full lg:w-48">
                            <Select
                                options={categoryOptions}
                                value={selectedCategory}
                                onChange={(e) => handleCategoryChange(e.target.value)}
                                disabled={categoriesLoading}
                                size="sm"
                                className="h-10 text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-dark-700 shadow-sm rounded-xl"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="w-full lg:w-48">
                            <Select
                                options={statusOptions}
                                value={selectedStatus}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                size="sm"
                                className="h-10 text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-dark-700 shadow-sm rounded-xl"
                            />
                        </div>

                        {/* Warehouse Filter */}
                        <div className="w-full lg:w-48">
                            <Select
                                options={warehouseOptions}
                                value={selectedWarehouse}
                                onChange={(e) => handleWarehouseChange(e.target.value)}
                                size="sm"
                                className="h-10 text-[10px] font-black uppercase tracking-widest border-slate-200 dark:border-dark-700 shadow-sm rounded-xl"
                            />
                        </div>
                    </div>
                }
                actions={actions}
                emptyTitle="Nenhum produto encontrado"
                emptyDescription="Tente ajustar seus filtros ou termos de busca."
                onEmptyAction={onAddProduct}
                emptyActionLabel="Novo Produto"
                minHeight="500px"
            />

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
                            <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                                <HiOutlineCube className="w-10 h-10 text-gray-400" />
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
                            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Categoria</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {categoryLabels[selectedProduct.category]}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Preço de Venda</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {formatCurrency(selectedProduct.price)}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Preço de Custo</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {formatCurrency(selectedProduct.costPrice)}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
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
                            <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Estoque Mínimo</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                                    {selectedProduct.minStock} {selectedProduct.unit}
                                </p>
                            </div>
                            {selectedProduct.barcode && (
                                <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Código de Barras</p>
                                    <p className="text-sm font-mono font-medium text-gray-900 dark:text-white mt-1">
                                        {selectedProduct.barcode}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Validades */}
                        <div className="border-t border-gray-100 dark:border-dark-600 pt-6">
                            <ProductValiditiesSection productId={selectedProduct.id} />
                        </div>

                        {/* Warehouse Breakdown */}
                        <div className="border-t border-gray-100 dark:border-dark-600 pt-6">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                                <HiOutlineBuildingOffice className="w-5 h-5 text-primary-500" />
                                Distribuição por Armazém
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {warehouses.map(warehouse => {
                                    const stock = selectedProduct.stocks?.[warehouse.id] ?? (warehouse.id === '1' ? selectedProduct.currentStock : 0);
                                    return (
                                        <div key={warehouse.id} className="flex justify-between items-center p-3 bg-slate-50/50 dark:bg-dark-700 rounded-lg border border-slate-200/60 dark:border-dark-600/50">
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
            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setProductToDelete(null);
                }}
                onConfirm={confirmDelete}
                title="Excluir Produto"
                message={`Tem certeza que deseja excluir o produto "${productToDelete?.name}"? Esta ação não pode ser desfeita.`}
                confirmText="Excluir"
                cancelText="Cancelar"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
}
