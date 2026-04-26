import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Input, Badge, EmptyState, Modal, Select, PageHeader } from '../../components/ui';
import { HiOutlineSearch, HiOutlineRefresh, HiOutlineCube, HiOutlinePlus, HiOutlineMinus, HiOutlinePrinter, HiOutlineDownload, HiOutlineArchive, HiOutlineTag, HiOutlineTrash } from 'react-icons/hi';
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

    // Batch modal
    const [batchModal, setBatchModal] = useState<{ isOpen: boolean; product: any | null }>({ isOpen: false, product: null });
    const [batches, setBatches] = useState<any[]>([]);
    const [loadingBatches, setLoadingBatches] = useState(false);
    const [newBatch, setNewBatch] = useState({ batchNumber: '', quantity: '', expiryDate: '', costPrice: '', notes: '' });
    const [savingBatch, setSavingBatch] = useState(false);

    // Price tier modal
    const [tierModal, setTierModal] = useState<{ isOpen: boolean; product: any | null }>({ isOpen: false, product: null });
    const [tiers, setTiers] = useState<any[]>([]);
    const [loadingTiers, setLoadingTiers] = useState(false);
    const [newTier, setNewTier] = useState({ minQty: '', price: '', label: '' });
    const [savingTier, setSavingTier] = useState(false);

    const openBatchModal = async (product: any) => {
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
        } catch (err: any) { toast.error(err.response?.data?.error || 'Erro ao criar lote'); }
        finally { setSavingBatch(false); }
    };

    const openTierModal = async (product: any) => {
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
        } catch (err: any) { toast.error(err.response?.data?.error || 'Erro ao criar nível'); }
        finally { setSavingTier(false); }
    };

    const handleDeleteTier = async (id: string) => {
        try {
            await bottleStoreAPI.deletePriceTier(id);
            setTiers(prev => prev.filter(t => t.id !== id));
            toast.success('Nível removido');
        } catch { toast.error('Erro ao remover nível'); }
    };

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
            <PageHeader 
                title="Gestão de Stock Garrafeira"
                subtitle="Controlo de inventário de bebidas"
                icon={<HiOutlineCube className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        <Button variant="outline" onClick={() => setShowPrintReport(true)} leftIcon={<HiOutlinePrinter className="w-5 h-5 text-primary-600 dark:text-primary-400" />}>Imprimir Inventário</Button>
                        <Button variant="outline" onClick={() => refetch()} leftIcon={<HiOutlineRefresh className="w-4 h-4 text-primary-600 dark:text-primary-400" />}>
                            Atualizar
                        </Button>
                        <div className="flex bg-white dark:bg-dark-800 rounded-lg p-1 gap-1 border border-gray-200 dark:border-dark-700">
                            <Button variant="ghost" size="sm" onClick={handleExportExcel}>
                                <HiOutlineDownload className="w-4 h-4 mr-1 text-green-600 dark:text-green-400" />
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
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                title="Gerir Lotes/Validades"
                                                className="text-blue-600 hover:bg-blue-50"
                                                onClick={() => openBatchModal(p)}
                                            >
                                                <HiOutlineArchive className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                title="Preços por Volume"
                                                className="text-purple-600 hover:bg-purple-50"
                                                onClick={() => openTierModal(p)}
                                            >
                                                <HiOutlineTag className="w-4 h-4" />
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
                            <HiOutlineArchive className="w-4 h-4" /> Registar Novo Lote
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
                                {batches.map((b: any) => (
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
                                {tiers.sort((a: any, b: any) => a.minQty - b.minQty).map((t: any) => (
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
