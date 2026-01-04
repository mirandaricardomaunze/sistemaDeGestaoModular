import { useState, useMemo } from 'react';
import { Button, Card, Input, Modal, Select, Pagination, usePagination } from '../ui';
import { HiOutlinePlus, HiOutlineDocumentDownload, HiOutlineSearch, HiOutlineTrash } from 'react-icons/hi';
import { generateId, formatDate } from '../../utils/helpers';
import type { StockTransfer } from '../../types';
import toast from 'react-hot-toast';
import TransferGuidePrint from './TransferGuidePrint.tsx';
import { useProducts, useWarehouses, useStockTransfers } from '../../hooks/useData';

export default function StockTransferManager() {
    // Use data hooks instead of store
    const { products: productsData } = useProducts();
    const { warehouses: warehousesData, addWarehouse, updateWarehouse } = useWarehouses();
    const { transfers: transfersData, createTransfer } = useStockTransfers();

    // Ensure arrays are never undefined
    const products = Array.isArray(productsData) ? productsData : [];
    const warehouses = Array.isArray(warehousesData) ? warehousesData : [];
    const transfers = Array.isArray(transfersData) ? transfersData : [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

    // Form State
    const [sourceId, setSourceId] = useState('');
    const [targetId, setTargetId] = useState('');
    const [reason, setReason] = useState('');
    const [responsible, setResponsible] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [productSearch, setProductSearch] = useState('');
    const [transferItems, setTransferItems] = useState<{ productId: string; productName: string; quantity: number }[]>([]);

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
            warehouseStock: p.stocks?.[sourceId] ?? (sourceId === '1' ? p.currentStock : 0)
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
            // Search by number or responsible
            const matchesSearch = t.number.toLowerCase().includes(historySearch.toLowerCase()) ||
                t.responsible.toLowerCase().includes(historySearch.toLowerCase());
            if (!matchesSearch) return false;

            // Filter by warehouse (either source or target)
            if (historyWarehouse !== 'all' && t.sourceWarehouseId !== historyWarehouse && t.targetWarehouseId !== historyWarehouse) return false;

            // Filter by date
            if (startDate && new Date(t.date) < new Date(startDate)) return false;
            if (endDate && new Date(t.date) > new Date(endDate)) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (new Date(t.date) > end) return false;
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
        const currentStock = product.stocks?.[sourceId] ?? (sourceId === '1' ? product.currentStock : 0);
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
            setTransferItems([...transferItems, { productId: product.id, productName: product.name, quantity }]);
        }

        setSelectedProduct('');
        setQuantity(1);
        setProductSearch('');
    };

    const handleRemoveItem = (idx: number) => {
        setTransferItems(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = () => {
        if (!sourceId || !targetId || !responsible || transferItems.length === 0) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }

        if (sourceId === targetId) {
            toast.error('Origem e destino devem ser diferentes');
            return;
        }

        const newTransfer: StockTransfer = {
            id: generateId(),
            number: `GT-${new Date().getFullYear()}-${String(transfers.length + 1).padStart(3, '0')}`,
            sourceWarehouseId: sourceId,
            targetWarehouseId: targetId,
            items: transferItems,
            status: 'completed',
            responsible,
            reason,
            date: new Date().toISOString(),
            createdAt: new Date().toISOString(),
        };

        createTransfer(newTransfer);
        toast.success('Transferência realizada com sucesso!');
        setIsModalOpen(false);
        resetForm();
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
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Transferências de Estoque</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Movimentação de produtos entre armazéns</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} leftIcon={<HiOutlinePlus className="w-5 h-5" />}>
                    Nova Transferência
                </Button>
            </div>

            {/* History Filters */}
            <Card padding="md">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <Input
                        label="Pesquisar"
                        placeholder="Número ou responsável..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        leftIcon={<HiOutlineSearch className="w-5 h-5" />}
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
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-dark-900 divide-y divide-gray-200 dark:divide-dark-700">
                            {filteredHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        Nenhuma transferência encontrada com os filtros atuais
                                    </td>
                                </tr>
                            ) : (
                                paginatedHistory.map((transfer) => (
                                    <tr key={transfer.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            {transfer.number}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatDate(transfer.date)}
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
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => {
                                                    setSelectedTransfer(transfer);
                                                    setShowPrintModal(true);
                                                }}
                                                className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400"
                                                title="Imprimir Guia"
                                            >
                                                <HiOutlineDocumentDownload className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
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
                                leftIcon={<HiOutlineSearch className="w-4 h-4" />}
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
                                        className="flex items-center gap-3 p-3 bg-white dark:bg-dark-700 border border-gray-100 dark:border-dark-600 rounded-xl shadow-sm hover:shadow-md transition-all"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0 text-primary-600 dark:text-primary-400">
                                            <span className="text-lg">📦</span>
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
                                        <button
                                            onClick={() => handleRemoveItem(idx)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                            title="Remover Item"
                                        >
                                            <HiOutlineTrash className="w-5 h-5" />
                                        </button>
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
