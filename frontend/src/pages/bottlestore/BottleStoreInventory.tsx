import { useMemo, useState, useEffect } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { Button, Input, Badge, Modal, Select, PageHeader } from '../../components/ui';
import { SmartTable } from '../../components/ui/SmartTable';
import { HiOutlineArrowPath, HiOutlineCube, HiOutlinePlus, HiOutlineMinus, HiOutlinePrinter, HiOutlineArrowDownTray, HiOutlineArchiveBox, HiOutlineTag, HiOutlineTrash } from 'react-icons/hi2';
import { useProducts } from '../../hooks/useData';
import { useDebounce } from '../../hooks/useDebounce';
import { formatCurrency } from '../../utils/helpers';
import { bottleStoreAPI } from '../../services/api/bottle-store.api';
import InventoryPrintReport from '../../components/inventory/InventoryPrintReport';
import toast from 'react-hot-toast';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { useStore } from '../../stores/useStore';
import { sanitizeString } from '../../utils/security';

type StockFilter = 'all' | 'low' | 'out';

type InvProduct = {
    id: string;
    name: string;
    code?: string;
    barcode?: string;
    price: number;
    costPrice?: number;
    currentStock: number;
    minStock?: number;
    packSize?: number;
    category?: string;
};

type BatchRecord = {
    id: string;
    batchNumber: string;
    quantity: number;
    expiryDate?: string;
    daysToExpiry?: number | null;
    computedStatus?: 'expired' | 'expiring_soon' | 'active';
};

type PriceTierRecord = {
    id: string;
    minQty: number;
    price: number;
    label?: string;
};

export default function BottleStoreInventory() {
    const { companySettings } = useStore();
    const [searchParams, setSearchParams] = useSearchParams();

    // Sync state with URL params
    const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
    const [pageSize, setPageSize] = useState(Number(searchParams.get('limit')) || 20);
    const [search, setSearch] = useState(searchParams.get('q') || '');
    const [stockFilter, setStockFilter] = useState<StockFilter>((searchParams.get('filter') as StockFilter) || 'all');

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
        product: InvProduct | null;
        type: 'add' | 'remove';
    }>({
        isOpen: false,
        product: null,
        type: 'add'
    });
    const [adjustmentData, setAdjustmentData] = useState({ quantity: '', reason: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Batch modal
    const [batchModal, setBatchModal] = useState<{ isOpen: boolean; product: InvProduct | null }>({ isOpen: false, product: null });
    const [batches, setBatches] = useState<BatchRecord[]>([]);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [newBatch, setNewBatch] = useState({ batchNumber: '', quantity: '', expiryDate: '', costPrice: '', notes: '' });
    const [savingBatch, setSavingBatch] = useState(false);

    // Price tier modal
    const [tierModal, setTierModal] = useState<{ isOpen: boolean; product: InvProduct | null }>({ isOpen: false, product: null });
    const [tiers, setTiers] = useState<PriceTierRecord[]>([]);
    const [loadingTiers, setLoadingTiers] = useState(false);
    const [newTier, setNewTier] = useState({ minQty: '', price: '', label: '' });
    const [savingTier, setSavingTier] = useState(false);

    const openBatchModal = async (product: InvProduct) => {
        setBatchModal({ isOpen: true, product });
        setLoadingBatches(true);
        try {
            const res = await bottleStoreAPI.getBatches({ productId: product.id, limit: 50 });
            setBatches(res.data || []);
        } catch { toast.error('Erro ao carregar lotes'); }
        finally { setLoadingBatches(false); }
    };

    const handleCreateBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!batchModal.product || !newBatch.batchNumber || !newBatch.quantity) return;
        setSavingBatch(true);
        try {
            await bottleStoreAPI.createBatch({
                productId: batchModal.product.id,
                batchNumber: newBatch.batchNumber,
                quantity: Number(newBatch.quantity),
                expiryDate: newBatch.expiryDate || undefined,
                costPrice: newBatch.costPrice ? Number(newBatch.costPrice) : undefined,
                notes: newBatch.notes || undefined,
            });
            toast.success('Lote registado com sucesso!');
            setNewBatch({ batchNumber: '', quantity: '', expiryDate: '', costPrice: '', notes: '' });
            const res = await bottleStoreAPI.getBatches({ productId: batchModal.product.id, limit: 50 });
            setBatches(res.data || []);
            refetch();
        } catch {
            toast.error('Erro ao guardar lote');
        } finally { setSavingBatch(false); }
    };

    const openTierModal = async (product: InvProduct) => {
        setTierModal({ isOpen: true, product });
        setLoadingTiers(true);
        try {
            const res = await bottleStoreAPI.getPriceTiers(product.id);
            setTiers(res || []);
        } catch { toast.error('Erro ao carregar preços'); }
        finally { setLoadingTiers(false); }
    };

    const handleCreateTier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tierModal.product || !newTier.minQty || !newTier.price) return;
        setSavingTier(true);
        try {
            await bottleStoreAPI.createPriceTier({
                productId: tierModal.product.id,
                minQty: Number(newTier.minQty),
                price: Number(newTier.price),
                label: newTier.label || undefined,
            });
            toast.success('Nível de preço criado!');
            setNewTier({ minQty: '', price: '', label: '' });
            const res = await bottleStoreAPI.getPriceTiers(tierModal.product.id);
            setTiers(res || []);
        } catch {
            toast.error('Erro ao criar nível de preço');
        } finally { setSavingTier(false); }
    };

    const handleDeleteTier = async (id: string) => {
        try {
            await bottleStoreAPI.deletePriceTier(id);
            setTiers(prev => prev.filter(t => t.id !== id));
            toast.success('Nível removido');
        } catch { toast.error('Erro ao remover nível'); }
    };

    const debouncedSearch = useDebounce(search, 350);

    const {
        products,
        pagination,
        isLoading,
        refetch
    } = useProducts({
        originModule: 'bottle_store',
        search: debouncedSearch,
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
        } catch (error) {
            // Rollback optimistic update on error
            product.currentStock = originalStock;
            toast.error((error as { response?: { data?: { message?: string; error?: string } } }).response?.data?.message || 'Erro ao atualizar stock');
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

    const inventoryProducts = products as InvProduct[];

    const inventoryColumns = useMemo<ColumnDef<InvProduct, unknown>[]>(() => [
        {
            header: 'Produto',
            cell: ({ row }) => (
                <div>
                    <div className="font-bold text-gray-900 dark:text-white">{row.original.name}</div>
                    <div className="text-xs font-mono text-gray-500">{row.original.code}</div>
                </div>
            ),
        },
        {
            header: 'Stock',
            cell: ({ row }) => (
                <Badge variant={row.original.currentStock <= 0 ? 'danger' : row.original.currentStock <= (row.original.minStock || 10) ? 'warning' : 'success'}>
                    {row.original.currentStock} un
                </Badge>
            ),
        },
        {
            header: 'Preco',
            cell: ({ row }) => (
                <div className="text-right font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(row.original.price)}
                </div>
            ),
        },
        {
            header: 'Accoes',
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <Button
                        size="xs"
                        variant="ghost"
                        title="Entrada de stock"
                        className="h-9 w-9 px-0 text-green-600 hover:bg-green-50"
                        onClick={() => setAdjustmentModal({ isOpen: true, product: row.original, type: 'add' })}
                    >
                        <HiOutlinePlus className="w-4 h-4" />
                    </Button>
                    <Button
                        size="xs"
                        variant="ghost"
                        title="Saida de stock"
                        className="h-9 w-9 px-0 text-red-600 hover:bg-red-50"
                        onClick={() => setAdjustmentModal({ isOpen: true, product: row.original, type: 'remove' })}
                    >
                        <HiOutlineMinus className="w-4 h-4" />
                    </Button>
                    <Button
                        size="xs"
                        variant="ghost"
                        title="Gerir Lotes/Validades"
                        className="h-9 w-9 px-0 text-blue-600 hover:bg-blue-50"
                        onClick={() => openBatchModal(row.original)}
                    >
                        <HiOutlineArchiveBox className="w-4 h-4" />
                    </Button>
                    <Button
                        size="xs"
                        variant="ghost"
                        title="Precos por Volume"
                        className="h-9 w-9 px-0 text-purple-600 hover:bg-purple-50"
                        onClick={() => openTierModal(row.original)}
                    >
                        <HiOutlineTag className="w-4 h-4" />
                    </Button>
                </div>
            ),
        },
    ], []);

    return (
        <div className="flex flex-col gap-6 p-4 pb-8">
            <PageHeader 
                title="Gestão de Stock Garrafeira"
                subtitle="Controlo de inventário de bebidas"
                icon={<HiOutlineCube className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        <Button variant="outline" onClick={() => setShowPrintReport(true)} leftIcon={<HiOutlinePrinter className="w-5 h-5 text-primary-600 dark:text-primary-400" />}>Imprimir Inventário</Button>
                        <Button variant="outline" onClick={() => refetch()} leftIcon={<HiOutlineArrowPath className="w-4 h-4 text-primary-600 dark:text-primary-400" />}>
                            Atualizar
                        </Button>
                        <div className="flex bg-white dark:bg-dark-800 rounded-lg p-1 gap-1 border border-gray-200 dark:border-dark-700">
                            <Button variant="ghost" size="sm" onClick={handleExportExcel}>
                                <HiOutlineArrowDownTray className="w-4 h-4 mr-1 text-green-600 dark:text-green-400" />
                                Excel
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleExportPDF}>
                                <HiOutlinePrinter className="w-4 h-4 mr-1 text-red-600 dark:text-red-400" />
                                PDF
                            </Button>
                        </div>
                    </div>
                }
            />

            <SmartTable
                data={inventoryProducts}
                columns={inventoryColumns}
                isLoading={isLoading}
                search={{
                    value: search,
                    onChange: (value) => {
                        setSearch(value);
                        setPage(1);
                    },
                    placeholder: 'Buscar por codigo, nome...',
                }}
                renderFilters={(
                    <div className="w-full md:w-64">
                        <Select
                            value={stockFilter}
                            onChange={(e) => {
                                setStockFilter(e.target.value as StockFilter);
                                setPage(1);
                            }}
                            options={[
                                { value: 'all', label: 'Todo Stock' },
                                { value: 'low', label: 'Stock Baixo' },
                                { value: 'out', label: 'Esgotado' }
                            ]}
                            size="sm"
                            className="bg-white dark:bg-dark-800"
                        />
                    </div>
                )}
                pagination={{
                    currentPage: page,
                    totalItems: pagination?.total || 0,
                    itemsPerPage: pageSize,
                    onPageChange: setPage,
                    onItemsPerPageChange: (size) => { setPageSize(size); setPage(1); },
                    itemsPerPageOptions: [10, 20, 50],
                }}
                emptyTitle="Nenhum produto encontrado no módulo botlestore"
                emptyDescription="Tente ajustar seus filtros ou cadastre novos produtos."
                minHeight="480px"
            />

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

            {/* -- Batch / Expiry Modal -- */}
            <Modal
                isOpen={batchModal.isOpen}
                onClose={() => setBatchModal({ isOpen: false, product: null })}
                title={`Lotes & Validades -- ${batchModal.product?.name}`}
                size="lg"
            >
                <div className="space-y-6">
                    {/* New batch form */}
                    <form onSubmit={handleCreateBatch} className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                            <HiOutlineArchiveBox className="w-4 h-4" /> Registar Novo Lote
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Nº Lote *"
                                value={newBatch.batchNumber}
                                onChange={e => setNewBatch({ ...newBatch, batchNumber: e.target.value })}
                                placeholder="LOT-2025-001"
                                required
                            />
                            <Input
                                label="Quantidade *"
                                type="number"
                                min="1"
                                value={newBatch.quantity}
                                onChange={e => setNewBatch({ ...newBatch, quantity: e.target.value })}
                                placeholder="0"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="Data de Validade"
                                type="date"
                                value={newBatch.expiryDate}
                                onChange={e => setNewBatch({ ...newBatch, expiryDate: e.target.value })}
                            />
                            <Input
                                label="Preço de Custo"
                                type="number"
                                min="0"
                                step="0.01"
                                value={newBatch.costPrice}
                                onChange={e => setNewBatch({ ...newBatch, costPrice: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <Input
                            label="Notas"
                            value={newBatch.notes}
                            onChange={e => setNewBatch({ ...newBatch, notes: e.target.value })}
                            placeholder="Observações opcionais..."
                        />
                        <Button type="submit" isLoading={savingBatch} variant="primary" size="sm">
                            <HiOutlinePlus className="w-4 h-4 mr-1" /> Registar Lote
                        </Button>
                    </form>

                    {/* Existing batches */}
                    <div>
                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Lotes Existentes</h4>
                        {loadingBatches ? (
                            <p className="text-gray-500 text-sm py-4 text-center">A carregar...</p>
                        ) : batches.length === 0 ? (
                            <p className="text-gray-400 text-sm py-4 text-center">Nenhum lote registado</p>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {batches.map((b) => (
                                    <div key={b.id} className="flex items-center justify-between bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg px-4 py-3">
                                        <div>
                                            <span className="font-mono font-bold text-sm">{b.batchNumber}</span>
                                            <span className="ml-3 text-sm text-gray-600 dark:text-gray-400">{b.quantity} un</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {b.expiryDate ? (
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                                    b.computedStatus === 'expired' ? 'bg-red-100 text-red-700' :
                                                    b.computedStatus === 'expiring_soon' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-green-100 text-green-700'
                                                }`}>
                                                    {new Date(b.expiryDate).toLocaleDateString('pt-MZ')}
                                                    {b.daysToExpiry != null && b.daysToExpiry >= 0 && ` (${b.daysToExpiry}d)`}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">Sem validade</span>
                                            )}
                                            <Badge variant={b.computedStatus === 'expired' ? 'danger' : b.computedStatus === 'expiring_soon' ? 'warning' : 'success'} size="sm">
                                                {b.computedStatus === 'expired' ? 'Expirado' : b.computedStatus === 'expiring_soon' ? 'A expirar' : 'Válido'}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* -- Price Tier Modal -- */}
            <Modal
                isOpen={tierModal.isOpen}
                onClose={() => setTierModal({ isOpen: false, product: null })}
                title={`Preços por Volume -- ${tierModal.product?.name}`}
                size="md"
            >
                <div className="space-y-6">
                    {/* New tier form */}
                    <form onSubmit={handleCreateTier} className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                            <HiOutlineTag className="w-4 h-4" /> Novo Nível de Preço
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                            <Input
                                label="Qtd Mínima *"
                                type="number"
                                min="1"
                                value={newTier.minQty}
                                onChange={e => setNewTier({ ...newTier, minQty: e.target.value })}
                                placeholder="Ex: 6"
                                required
                            />
                            <Input
                                label="Preço *"
                                type="number"
                                min="0"
                                step="0.01"
                                value={newTier.price}
                                onChange={e => setNewTier({ ...newTier, price: e.target.value })}
                                placeholder="0.00"
                                required
                            />
                            <Input
                                label="Etiqueta"
                                value={newTier.label}
                                onChange={e => setNewTier({ ...newTier, label: e.target.value })}
                                placeholder="Ex: Caixa"
                            />
                        </div>
                        <Button type="submit" isLoading={savingTier} variant="primary" size="sm">
                            <HiOutlinePlus className="w-4 h-4 mr-1" /> Adicionar Nível
                        </Button>
                    </form>

                    {/* Existing tiers */}
                    <div>
                        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Níveis Configurados</h4>
                        {loadingTiers ? (
                            <p className="text-gray-500 text-sm py-4 text-center">A carregar...</p>
                        ) : tiers.length === 0 ? (
                            <p className="text-gray-400 text-sm py-4 text-center">Nenhum nível configurado -- preço único</p>
                        ) : (
                            <div className="space-y-2">
                                {tiers.sort((a, b) => a.minQty - b.minQty).map((t) => (
                                    <div key={t.id} className="flex items-center justify-between bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg px-4 py-3">
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-medium">A partir de <strong>{t.minQty}</strong> un</span>
                                            <span className="text-purple-700 dark:text-purple-400 font-bold">{formatCurrency(t.price)}</span>
                                            {t.label && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{t.label}</span>}
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-500 hover:bg-red-50"
                                            onClick={() => handleDeleteTier(t.id)}
                                        >
                                            <HiOutlineTrash className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
