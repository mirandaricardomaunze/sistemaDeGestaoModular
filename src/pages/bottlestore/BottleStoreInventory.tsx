import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Input, Badge, EmptyState, Modal, Select } from '../../components/ui';
import { HiOutlineSearch, HiOutlineRefresh, HiOutlineCube, HiOutlinePlus, HiOutlineMinus, HiOutlinePrinter, HiOutlineDownload } from 'react-icons/hi';
import { useProducts } from '../../hooks/useData';
import Pagination from '../../components/ui/Pagination';
import { formatCurrency } from '../../utils/helpers';
import { bottleStoreAPI } from '../../services/api/bottle-store.api';
import InventoryPrintReport from '../../components/inventory/InventoryPrintReport';
import toast from 'react-hot-toast';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { useStore } from '../../stores/useStore';
import { sanitizeString } from '../../utils/security';

export default function BottleStoreInventory() {
    const { companySettings } = useStore();
    const [searchParams, setSearchParams] = useSearchParams();

    // Sync state with URL params
    const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
    const [pageSize, setPageSize] = useState(Number(searchParams.get('limit')) || 20);
    const [search, setSearch] = useState(searchParams.get('q') || '');
    const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>((searchParams.get('filter') as any) || 'all');

    const [showPrintReport, setShowPrintReport] = useState(false);

    // Update URL when filters change
    useEffect(() => {
        const params: Record<string, string> = {};
        if (page > 1) params.page = page.toString();
        if (pageSize !== 20) params.limit = pageSize.toString();
        if (search) params.q = search;
        if (stockFilter !== 'all') params.filter = stockFilter;
        setSearchParams(params, { replace: true });
    }, [page, pageSize, search, stockFilter, setSearchParams]);

    const [adjustmentModal, setAdjustmentModal] = useState<{
        isOpen: boolean;
        product: any | null;
        type: 'add' | 'remove';
    }>({
        isOpen: false,
        product: null,
        type: 'add'
    });
    const [adjustmentData, setAdjustmentData] = useState({ quantity: '', reason: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        products,
        pagination,
        isLoading,
        refetch
    } = useProducts({
        origin_module: 'bottle_store',
        search,
        status: stockFilter === 'all' ? undefined : stockFilter === 'low' ? 'low_stock' : 'out_of_stock',
        page,
        limit: pageSize
    });

    const handleAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        const product = adjustmentModal.product;
        if (!product || !adjustmentData.quantity) return;

        setIsSubmitting(true);
        const quantity = Number(adjustmentData.quantity);
        const finalQuantity = adjustmentModal.type === 'add' ? quantity : -quantity;

        // Optimistic update
        const originalStock = product.currentStock;
        product.currentStock += finalQuantity;

        try {
            await bottleStoreAPI.recordMovement({
                productId: product.id,
                quantity: finalQuantity,
                type: adjustmentModal.type === 'add' ? 'purchase' : 'loss',
                reason: sanitizeString(adjustmentData.reason) || `Ajuste dinâmico (${adjustmentModal.type === 'add' ? 'Entrada' : 'Saída'})`
            });

            toast.success('Stock atualizado com sucesso');
            setAdjustmentModal({ isOpen: false, product: null, type: 'add' });
            setAdjustmentData({ quantity: '', reason: '' });
            refetch();
        } catch (error: any) {
            // Rollback optimistic update on error
            product.currentStock = originalStock;
            toast.error(error.response?.data?.message || 'Erro ao atualizar stock');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExportExcel = () => {
        exportToExcel({
            filename: 'inventario_garrafeira',
            title: 'Inventário de Garrafeira',
            companyName: companySettings.companyName,
            columns: [
                { key: 'code', header: 'Código', width: 12 },
                { key: 'name', header: 'Produto', width: 30 },
                { key: 'category.name', header: 'Categoria', width: 15 },
                { key: 'currentStock', header: 'Stock', format: 'number', width: 10, align: 'right' },
                { key: 'sellingPrice', header: 'Preço Venda', format: 'currency', width: 15 },
            ],
            data: products
        });
    };

    const handleExportPDF = () => {
        exportToPDF({
            filename: 'inventario_garrafeira',
            title: 'Inventário de Garrafeira',
            companyName: companySettings.companyName,
            columns: [
                { key: 'code', header: 'Código', width: 12 },
                { key: 'name', header: 'Produto', width: 30 },
                { key: 'category.name', header: 'Categoria', width: 15 },
                { key: 'currentStock', header: 'Stock', format: 'number', width: 10, align: 'right' },
                { key: 'sellingPrice', header: 'Preço Venda', format: 'currency', width: 15 },
            ],
            data: products
        });
    };

    return (
        <div className="flex flex-col gap-6 p-4 pb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold dark:text-white">Gestão de Stock</h2>
                    <p className="text-gray-500">Controlo de inventário de bebidas</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowPrintReport(true)} leftIcon={<HiOutlinePrinter className="w-5 h-5" />}>Imprimir Inventário</Button>
                    <Button variant="outline" onClick={refetch}>
                        <HiOutlineRefresh className="w-4 h-4 mr-2" />
                        Atualizar
                    </Button>
                    <div className="flex bg-white dark:bg-dark-800 rounded-lg p-1 gap-1 border border-gray-200 dark:border-dark-700">
                        <Button variant="ghost" size="sm" onClick={handleExportExcel}>
                            <HiOutlineDownload className="w-4 h-4 mr-1 text-green-600" />
                            Excel
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleExportPDF}>
                            <HiOutlinePrinter className="w-4 h-4 mr-1 text-red-600" />
                            PDF
                        </Button>
                    </div>
                </div>
            </div>

            <Card padding="md">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Buscar por código, nome..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                        />
                    </div>
                    <div className="w-full md:w-64">
                        <Select
                            value={stockFilter}
                            onChange={(e) => setStockFilter(e.target.value as any)}
                            options={[
                                { value: 'all', label: 'Todo Stock' },
                                { value: 'low', label: 'Stock Baixo' },
                                { value: 'out', label: 'Esgotado' }
                            ]}
                        />
                    </div>
                </div>
            </Card>

            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-dark-900/50 uppercase text-xs font-bold text-gray-600 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-4">Produto</th>
                                <th className="px-6 py-4">Stock</th>
                                <th className="px-6 py-4 text-right">Preço</th>
                                <th className="px-6 py-4 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                            {products.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900 dark:text-white">{p.name}</div>
                                        <div className="text-xs font-mono text-gray-500">{p.code}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant={p.currentStock <= 0 ? 'danger' : p.currentStock <= (p.minStock || 10) ? 'warning' : 'success'}>
                                            {p.currentStock} un
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">{formatCurrency(p.price)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-green-600 hover:bg-green-50"
                                                onClick={() => setAdjustmentModal({ isOpen: true, product: p, type: 'add' })}
                                            >
                                                <HiOutlinePlus className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-600 hover:bg-red-50"
                                                onClick={() => setAdjustmentModal({ isOpen: true, product: p, type: 'remove' })}
                                            >
                                                <HiOutlineMinus className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!isLoading && products.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <EmptyState
                                            icon={<HiOutlineCube className="w-12 h-12" />}
                                            title="Nenhum produto encontrado no modulo botlestore"
                                            description="Tente ajustar seus filtros ou cadastre novos produtos."
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-6 border-t border-gray-100 dark:border-dark-700">
                    <Pagination
                        currentPage={page}
                        totalItems={pagination?.total || 0}
                        itemsPerPage={pageSize}
                        onPageChange={setPage}
                        onItemsPerPageChange={(size) => { setPageSize(size); setPage(1); }}
                        itemsPerPageOptions={[10, 20, 50]}
                    />
                </div>
            </Card>

            <Modal
                isOpen={adjustmentModal.isOpen}
                onClose={() => setAdjustmentModal({ ...adjustmentModal, isOpen: false })}
                title={`${adjustmentModal.type === 'add' ? 'Entrada' : 'Saída'} de Stock: ${adjustmentModal.product?.name}`}
                size="sm"
            >
                <form onSubmit={handleAdjustment} className="space-y-4">
                    <Input
                        label="Quantidade"
                        type="number"
                        min="1"
                        autoFocus
                        value={adjustmentData.quantity}
                        onChange={(e) => setAdjustmentData({ ...adjustmentData, quantity: e.target.value })}
                        placeholder="0"
                        required
                    />
                    <Input
                        label="Motivo (Opcional)"
                        value={adjustmentData.reason}
                        onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                        placeholder="Ex: Ajuste de inventário"
                    />
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="ghost"
                            fullWidth
                            type="button"
                            onClick={() => setAdjustmentModal({ ...adjustmentModal, isOpen: false })}
                        >
                            Cancelar
                        </Button>
                        <Button
                            fullWidth
                            type="submit"
                            isLoading={isSubmitting}
                            variant={adjustmentModal.type === 'add' ? 'primary' : 'danger'}
                        >
                            Confirmar
                        </Button>
                    </div>
                </form>
            </Modal>

            <InventoryPrintReport
                isOpen={showPrintReport}
                onClose={() => setShowPrintReport(false)}
                category="beverages"
            />
        </div>
    );
}
