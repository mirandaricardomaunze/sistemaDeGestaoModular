import { useState, useMemo } from 'react';
import { Button, Card, Input, Modal, Select, Pagination, usePagination, ConfirmationModal } from '../ui';
import { HiOutlineDocumentArrowDown, HiOutlineMagnifyingGlass, HiOutlineTrash, HiOutlineCheck } from 'react-icons/hi2';
import { formatDate } from '../../utils/helpers';
import type { StockTransfer } from '../../types';
import toast from 'react-hot-toast';
import TransferGuidePrint from './TransferGuidePrint.tsx';
import { useProducts, useWarehouses, useStockTransfers } from '../../hooks/useData';

export default function StockTransferManager() {
    // Use data hooks instead of store
    const { products: productsData, refetch: refetchProducts } = useProducts();
    const { warehouses: warehousesData } = useWarehouses();
    const { 
        transfers: transfersData, 
        createTransfer, 
        submitTransfer,
        approveTransfer,
        rejectTransfer,
        dispatchTransfer,
        receiveTransfer,
        cancelTransfer,
        refetch: refetchTransfers 
    } = useStockTransfers();

    // Ensure arrays are never undefined
    const products = useMemo(() => Array.isArray(productsData) ? productsData : [], [productsData]);
    const warehouses = useMemo(() => Array.isArray(warehousesData) ? warehousesData : [], [warehousesData]);
    const transfers = useMemo(() => Array.isArray(transfersData) ? transfersData : [], [transfersData]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
    const [transferToConfirm, setTransferToConfirm] = useState<{ 
        type: 'submit' | 'approve' | 'reject' | 'dispatch' | 'complete' | 'cancel', 
        transfer: StockTransfer 
    } | null>(null);

    // Form State
    const [sourceId, setSourceId] = useState('');
    const [targetId, setTargetId] = useState('');
    const [reason, setReason] = useState('');
    const [responsible, setResponsible] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [productSearch, setProductSearch] = useState('');
    const [transferItems, setTransferItems] = useState<{
        productId: string;
        productName: string;
        productCode?: string;
        productBarcode?: string;
        productDescription?: string;
        unit?: string;
        quantity: number
    }[]>([]);

    // History Filters
    const [historySearch, setHistorySearch] = useState('');
    const [historyWarehouse, setHistoryWarehouse] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const activeWarehouses = useMemo(() => warehouses.filter(w => w.isActive), [warehouses]);
    const warehouseOptions = activeWarehouses.map(w => ({ value: w.id, label: w.name }));

    // List of products with their stock in the selected source warehouse
    const availableProducts = useMemo(() => {
        if (!sourceId) return [];
        return products.map(p => ({
            ...p,
            warehouseStock: (p.warehouseStocks?.find((ws) => ws.warehouseId === sourceId)?.quantity) ?? 0
        }));
    }, [products, sourceId]);

    const filteredAvailableProducts = useMemo(() => {
        if (!productSearch) return availableProducts;
        return availableProducts.filter(p =>
            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.code.toLowerCase().includes(productSearch.toLowerCase())
        );
    }, [availableProducts, productSearch]);

    const selectedProdData = useMemo(() =>
        availableProducts.find(p => p.id === selectedProduct),
        [availableProducts, selectedProduct]);

    const filteredHistory = useMemo(() => {
        return transfers.filter(t => {
            // Search by number, responsible or products
            const searchLower = historySearch.toLowerCase();
            const matchesSearch =
                (t.number?.toLowerCase() || '').includes(searchLower) ||
                (t.responsible?.toLowerCase() || '').includes(searchLower) ||
                t.items?.some(item => (item.productName?.toLowerCase() || '').includes(searchLower));

            if (!matchesSearch) return false;

            // Filter by warehouse (either source or target)
            if (historyWarehouse !== 'all' && t.sourceWarehouseId !== historyWarehouse && t.targetWarehouseId !== historyWarehouse) return false;

            // Filter by date
            if (t.date) {
                const transferDate = new Date(t.date);
                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (transferDate < start) return false;
                }

                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (transferDate > end) return false;
                }
            }

            return true;
        });
    }, [transfers, historySearch, historyWarehouse, startDate, endDate]);

    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedHistory,
        totalItems,
    } = usePagination(filteredHistory, 10);

    const handleAddItem = () => {
        if (!selectedProduct || quantity <= 0) return;

        const product = products.find(p => p.id === selectedProduct);
        if (!product) return;

        // Verify stock availability
        const currentStock = (product.warehouseStocks?.find((ws) => ws.warehouseId === sourceId)?.quantity) ?? 0;
        // Check if already added to list
        const existingItem = transferItems.find(i => i.productId === selectedProduct);
        const currentQtyInTransfer = existingItem ? existingItem.quantity : 0;

        if (currentStock < (currentQtyInTransfer + quantity)) {
            toast.error(`Estoque insuficiente! Disponível: ${currentStock}`);
            return;
        }

        if (existingItem) {
            setTransferItems(prev => prev.map(i => i.productId === selectedProduct ? { ...i, quantity: i.quantity + quantity } : i));
        } else {
            setTransferItems([...transferItems, {
                productId: product.id,
                productName: product.name,
                productCode: product.code,
                productBarcode: product.barcode,
                productDescription: product.description,
                unit: product.unit,
                quantity
            }]);
        }

        setSelectedProduct('');
        setQuantity(1);
        setProductSearch('');
    };

    const handleRemoveItem = (idx: number) => {
        setTransferItems(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        if (!sourceId || !targetId || !responsible || transferItems.length === 0) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }

        if (sourceId === targetId) {
            toast.error('Origem e destino devem ser diferentes');
            return;
        }

        try {
            await createTransfer({
                sourceWarehouseId: sourceId,
                targetWarehouseId: targetId,
                items: transferItems.map(i => ({ productId: i.productId, quantity: i.quantity })),
                responsible,
                reason,
            });
            await Promise.all([refetchProducts(), refetchTransfers()]);
            setIsModalOpen(false);
            resetForm();
        } catch (err) {
            const apiErr = err as Error & { response?: { status?: number; data?: { message?: string; error?: unknown; errors?: unknown[] } } };
            const msg = apiErr?.response?.data?.message || 'Erro ao criar transferência. Verifique os dados e tente novamente.';
            toast.error(msg);
        }
    };

    const handleWorkflowAction = async (type: 'submit' | 'approve' | 'reject' | 'dispatch' | 'complete' | 'cancel', transfer: StockTransfer) => {
        setTransferToConfirm({ type, transfer });
    };

    const confirmWorkflowAction = async () => {
        if (!transferToConfirm) return;
        const { type, transfer } = transferToConfirm;
        try {
            switch (type) {
                case 'submit': await submitTransfer(transfer.id); break;
                case 'approve': await approveTransfer(transfer.id); break;
                case 'reject': await rejectTransfer(transfer.id, 'Rejeitado pelo administrador'); break;
                case 'dispatch': await dispatchTransfer(transfer.id); break;
                case 'complete': await receiveTransfer(transfer.id); break;
                case 'cancel': await cancelTransfer(transfer.id); break;
            }
            await Promise.all([refetchProducts(), refetchTransfers()]);
            setTransferToConfirm(null);
        } catch { /* error toast handled by hook */ }
    };

    const resetForm = () => {
        setSourceId('');
        setTargetId('');
        setReason('');
        setResponsible('');
        setTransferItems([]);
        setSelectedProduct('');
        setQuantity(1);
        setProductSearch('');
    };

    const getWarehouseName = (id: string) => warehouses.find(w => w.id === id)?.name || 'N/A';

    return (
        <div className="space-y-6">
            <Button variant="ghost" id="new-transfer-btn" className="hidden" onClick={() => setIsModalOpen(true)} />

            {/* History Filters */}
            <Card padding="md">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <Input
                        label="Pesquisar"
                        placeholder="Número ou responsável..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5" />}
                    />
                    <Select
                        label="Filtrar por Armazém"
                        options={[{ value: 'all', label: 'Todos os armazéns' }, ...warehouseOptions]}
                        value={historyWarehouse}
                        onChange={(e) => setHistoryWarehouse(e.target.value)}
                    />
                    <Input
                        type="date"
                        label="Data Início"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                    <Input
                        type="date"
                        label="Data Fim"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
            </Card>

            {/* Transfers History */}
            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                        <thead className="bg-gray-50 dark:bg-dark-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Número</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Origem</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destino</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Itens</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-dark-900 divide-y divide-gray-200 dark:divide-dark-700">
                            {filteredHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        Nenhuma transferência encontrada com os filtros atuais
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {paginatedHistory.map((transfer) => (
                                        <tr key={transfer.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                {transfer.number}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {formatDate(transfer.date || transfer.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {getWarehouseName(transfer.sourceWarehouseId)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {getWarehouseName(transfer.targetWarehouseId)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400">
                                                {transfer.items.length}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {transfer.status === 'draft' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                        Rascunho
                                                    </span>
                                                )}
                                                {transfer.status === 'pending' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                        Pendente
                                                    </span>
                                                )}
                                                {transfer.status === 'approved' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                                                        Aprovada
                                                    </span>
                                                )}
                                                {transfer.status === 'in_transit' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                        Em Trânsito
                                                    </span>
                                                )}
                                                {(transfer.status === 'received' || transfer.status === 'completed') && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                        Concluída
                                                    </span>
                                                )}
                                                {transfer.status === 'rejected' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                                                        Rejeitada
                                                    </span>
                                                )}
                                                {transfer.status === 'cancelled' && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                                        Cancelada
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end gap-2 flex-wrap">
                                                    {/* Requested Text Actions */}
                                                    {transfer.status === 'pending' && (
                                                        <Button
                                                            size="xs"
                                                            variant="warning"
                                                            onClick={() => handleWorkflowAction('approve', transfer)}
                                                            leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                                                        >
                                                            Aprovação
                                                        </Button>
                                                    )}

                                                    <Button
                                                        size="xs"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedTransfer(transfer);
                                                            setShowPrintModal(true);
                                                        }}
                                                        leftIcon={<HiOutlineMagnifyingGlass className="w-4 h-4" />}
                                                    >
                                                        Ver
                                                    </Button>

                                                    <Button
                                                        size="xs"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setSelectedTransfer(transfer);
                                                            setShowPrintModal(true);
                                                        }}
                                                        leftIcon={<HiOutlineDocumentArrowDown className="w-4 h-4" />}
                                                    >
                                                        Imprimir
                                                    </Button>

                                                    {/* Contextual Secondary Actions (Icon only) */}
                                                    <div className="flex items-center gap-1 border-l pl-2 border-gray-100 dark:border-dark-700">
                                                        {transfer.status === 'draft' && (
                                                            <Button variant="ghost"
                                                                onClick={() => handleWorkflowAction('submit', transfer)}
                                                                className="p-1 text-primary-600 hover:bg-primary-50 rounded"
                                                                title="Submeter"
                                                            >
                                                                <HiOutlineCheck className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                        {transfer.status === 'approved' && (
                                                            <Button variant="ghost"
                                                                onClick={() => handleWorkflowAction('dispatch', transfer)}
                                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                                title="Despachar"
                                                            >
                                                                <HiOutlineDocumentArrowDown className="w-4 h-4 rotate-180" />
                                                            </Button>
                                                        )}
                                                        {transfer.status === 'in_transit' && (
                                                            <Button variant="ghost"
                                                                onClick={() => handleWorkflowAction('complete', transfer)}
                                                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                                title="Receber"
                                                            >
                                                                <HiOutlineCheck className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                        {['draft', 'pending', 'approved'].includes(transfer.status) && (
                                                            <Button variant="ghost"
                                                                onClick={() => handleWorkflowAction('cancel', transfer)}
                                                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                                title="Cancelar"
                                                            >
                                                                <HiOutlineTrash className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Placeholder rows to maintain 10-item height */}
                                    {paginatedHistory.length > 0 && paginatedHistory.length < itemsPerPage && Array.from({ length: itemsPerPage - paginatedHistory.length }).map((_, i) => (
                                        <tr key={`placeholder-${i}`} className="h-[73px]">
                                            <td colSpan={7}>&nbsp;</td>
                                        </tr>
                                    ))}
                                </>
                             )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6">
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </div>
            </Card>

            {/* Create Transfer Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    resetForm();
                }}
                title="Nova Transferência"
                size="lg"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Origem *"
                            placeholder="Selecione a origem..."
                            options={warehouseOptions}
                            value={sourceId}
                            onChange={(e) => {
                                setSourceId(e.target.value);
                                setTransferItems([]); // Clear items if source changes
                            }}
                        />
                        <Select
                            label="Destino *"
                            placeholder="Selecione o destino..."
                            options={warehouseOptions}
                            value={targetId}
                            onChange={(e) => setTargetId(e.target.value)}
                        />
                    </div>

                    <div className="bg-gray-50 dark:bg-dark-800 p-4 rounded-lg space-y-4">
                        <h4 className="font-medium text-sm text-gray-900 dark:text-white mb-2">Adicionar Produtos</h4>
                        <div className="space-y-3">
                            <Input
                                placeholder="Buscar produto por nome ou código..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                leftIcon={<HiOutlineMagnifyingGlass className="w-4 h-4" />}
                                disabled={!sourceId}
                            />
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Select
                                        value={selectedProduct}
                                        onChange={(e) => setSelectedProduct(e.target.value)}
                                        options={[
                                            { value: '', label: 'Selecione um produto...' },
                                            ...filteredAvailableProducts.map(p => ({
                                                value: p.id,
                                                label: `${p.name} (Disp: ${p.warehouseStock}) ${p.warehouseStock <= 0 ? '- SEM ESTOQUE' : ''}`
                                            }))
                                        ]}
                                        disabled={!sourceId}
                                    />
                                </div>
                                <div className="w-24">
                                    <Input
                                        type="number"
                                        min="1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(Number(e.target.value))}
                                        disabled={!selectedProduct}
                                    />
                                </div>
                                <Button
                                    onClick={handleAddItem}
                                    disabled={!selectedProdData || selectedProdData.warehouseStock <= 0 || quantity <= 0}
                                >
                                    Adicionar
                                </Button>
                            </div>
                        </div>

                        {/* Items List */}
                        {transferItems.length > 0 && (
                            <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Itens para Transferência</p>
                                {transferItems.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-3 p-3 bg-white dark:bg-dark-700 border border-gray-100 dark:border-dark-600 rounded-lg shadow-sm hover:shadow-md transition-all"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0 text-primary-600 dark:text-primary-400">
                                            <span className="text-lg">??</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                {item.productName}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                ID: {item.productId.slice(0, 8)}...
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-dark-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-dark-700">
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                {item.quantity}
                                            </span>
                                            <span className="text-[10px] font-medium text-gray-400 uppercase">Qtd</span>
                                        </div>
                                        <Button variant="ghost"
                                            onClick={() => handleRemoveItem(idx)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                            title="Remover Item"
                                        >
                                            <HiOutlineTrash className="w-5 h-5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Responsável *"
                            value={responsible}
                            onChange={(e) => setResponsible(e.target.value)}
                            placeholder="Nome do responsável"
                        />
                        <Input
                            label="Motivo"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Ex: Reposição de estoque"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!sourceId || !targetId || !responsible || transferItems.length === 0 || sourceId === targetId}
                        >
                            Confirmar Transferência
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Confirmation Modals */}
            <ConfirmationModal
                isOpen={!!transferToConfirm}
                onClose={() => setTransferToConfirm(null)}
                onConfirm={confirmWorkflowAction}
                title={
                    transferToConfirm?.type === 'submit' ? 'Submeter Transferência' :
                    transferToConfirm?.type === 'approve' ? 'Aprovar Transferência' :
                    transferToConfirm?.type === 'reject' ? 'Rejeitar Transferência' :
                    transferToConfirm?.type === 'dispatch' ? 'Despachar Mercadoria' :
                    transferToConfirm?.type === 'complete' ? 'Confirmar Recepção' :
                    'Cancelar Transferência'
                }
                message={
                    transferToConfirm?.type === 'submit' ? `Deseja submeter a transferência ${transferToConfirm?.transfer.number} para aprovação?` :
                    transferToConfirm?.type === 'approve' ? `Deseja aprovar a transferência ${transferToConfirm?.transfer.number}? O estoque será reservado no armazém de origem.` :
                    transferToConfirm?.type === 'reject' ? `Deseja rejeitar a transferência ${transferToConfirm?.transfer.number}?` :
                    transferToConfirm?.type === 'dispatch' ? `Deseja confirmar o despacho da mercadoria da transferência ${transferToConfirm?.transfer.number}? O estoque será deduzido da origem.` :
                    transferToConfirm?.type === 'complete' ? `Deseja confirmar a recepção da transferência ${transferToConfirm?.transfer.number}? Os produtos serão adicionados ao armazém de destino.` :
                    `Deseja cancelar a transferência ${transferToConfirm?.transfer.number}?`
                }
                confirmText="Confirmar"
                cancelText="Voltar"
                variant={
                    transferToConfirm?.type === 'cancel' || transferToConfirm?.type === 'reject' ? 'danger' :
                    transferToConfirm?.type === 'approve' || transferToConfirm?.type === 'complete' ? 'success' :
                    'primary'
                }
            />

            {/* Print Modal */}
            {selectedTransfer && (
                <TransferGuidePrint
                    isOpen={showPrintModal}
                    onClose={() => {
                        setShowPrintModal(false);
                        setSelectedTransfer(null);
                    }}
                    transfer={selectedTransfer}
                />
            )}
        </div>
    );
}
