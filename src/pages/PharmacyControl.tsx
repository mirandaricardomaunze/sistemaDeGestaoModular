import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge, LoadingSpinner, Input, Modal, Select, Pagination } from '../components/ui';
import { productsAPI } from '../services/api';
import { useProducts } from '../hooks/useData';
import {
    HiOutlineBeaker,
    HiOutlineShieldCheck,
    HiOutlineExclamation,
    HiOutlineClipboardList,
    HiOutlineRefresh,
    HiOutlineTrendingDown,
    HiOutlineViewGrid,
    HiOutlineDownload,
    HiOutlinePrinter
} from 'react-icons/hi';
import { generatePharmacyExpirationReport } from '../utils/documentGenerator';
import { useStore } from '../stores/useStore';
import * as XLSX from 'xlsx';

export default function PharmacyControl() {
    const { companySettings } = useStore();
    const navigate = useNavigate();
    const [expiringSoonData, setExpiringSoonData] = useState<{ data: any[], pagination?: any }>({ data: [] });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const { products, isLoading: isLoadingProducts, updateProduct } = useProducts();

    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [batchData, setBatchData] = useState({
        productId: '',
        batchNumber: '',
        expiryDate: '',
        quantity: ''
    });

    const fetchExpiring = async () => {
        try {
            const data = await productsAPI.getExpiring(90, { page, limit: pageSize }); // Look ahead 90 days
            setExpiringSoonData(data);
        } catch (err: any) {
            console.error('Erro ao carregar produtos a expirar');
        }
    };

    useEffect(() => {
        fetchExpiring();
    }, [page, pageSize]);

    const exportToExcel = () => {
        const data = expiringSoonData.data.map(p => ({
            'Produto': p.name,
            'Código': p.code,
            'Lote': p.batchNumber,
            'Validade': new Date(p.expiryDate).toLocaleDateString(),
            'Stock Atual': p.currentStock,
            'Valor (MT)': (p.price || 0) * p.currentStock
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos_Expirar');
        XLSX.writeFile(workbook, `Farmacia_Alertas_Validade_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleBatchEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const product = products.find(p => p.id === batchData.productId);
            if (!product) return;

            await updateProduct(product.id, {
                batchNumber: batchData.batchNumber,
                expiryDate: batchData.expiryDate,
                currentStock: product.currentStock + parseInt(batchData.quantity)
            });

            setIsBatchModalOpen(false);
            setBatchData({ productId: '', batchNumber: '', expiryDate: '', quantity: '' });
            fetchExpiring();
        } catch (err) {
            // Toast handled in hook
        }
    };

    if (isLoadingProducts && products.length === 0) return <LoadingSpinner size="xl" className="h-96" />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Controle Farmacêutico</h1>
                    <p className="text-gray-500 dark:text-gray-400">Rastreabilidade, Lotes e Validades em Tempo Real</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" leftIcon={<HiOutlineRefresh className="w-5 h-5" />} onClick={fetchExpiring}>Actualizar</Button>
                    <div className="flex bg-white dark:bg-dark-800 rounded-lg p-1 gap-1 border border-gray-200 dark:border-dark-700">
                        <Button variant="ghost" size="sm" leftIcon={<HiOutlineDownload className="w-4 h-4" />} onClick={exportToExcel}>Excel</Button>
                        <Button variant="ghost" size="sm" leftIcon={<HiOutlinePrinter className="w-4 h-4" />} onClick={() => generatePharmacyExpirationReport(expiringSoonData.data, companySettings)}>PDF</Button>
                    </div>
                    <Button leftIcon={<HiOutlineViewGrid className="w-5 h-5" />} variant="outline" onClick={() => navigate('/inventory')}>Ver Inventário</Button>
                    <Button leftIcon={<HiOutlineBeaker className="w-5 h-5" />} onClick={() => setIsBatchModalOpen(true)}>Entrada de Lote</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Critical Alerts */}
                <Card variant="glass" className="lg:col-span-2 p-6 border-l-4 border-red-500 shadow-md">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <HiOutlineExclamation className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">Validades Próximas (90 dias)</h3>
                        </div>
                        <Badge variant="danger">{expiringSoonData.pagination?.total || 0} Alertas</Badge>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-gray-400 uppercase border-b dark:border-dark-700">
                                    <th className="py-3 px-2 font-semibold">Produto</th>
                                    <th className="py-3 px-2 font-semibold">Lote</th>
                                    <th className="py-3 px-2 font-semibold">Expiração</th>
                                    <th className="py-3 px-2 font-semibold text-right">Stock</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-dark-700">
                                {expiringSoonData.data.length > 0 ? expiringSoonData.data.map(item => (
                                    <tr key={item.id} className="text-sm hover:bg-gray-50 dark:hover:bg-dark-700/50">
                                        <td className="py-4 px-2">
                                            <div className="font-bold text-gray-900 dark:text-white">{item.name}</div>
                                            <div className="text-xs text-gray-500">{item.code}</div>
                                        </td>
                                        <td className="py-4 px-2 font-mono text-xs">{item.batchNumber || '---'}</td>
                                        <td className="py-4 px-2">
                                            <Badge variant={new Date(item.expiryDate) < new Date() ? 'danger' : 'warning'}>
                                                {new Date(item.expiryDate).toLocaleDateString()}
                                            </Badge>
                                        </td>
                                        <td className="py-4 px-2 text-right font-medium">
                                            <span className={item.currentStock <= item.minStock ? 'text-red-600' : 'text-gray-900 dark:text-white'}>
                                                {item.currentStock} {item.unit}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-gray-500 italic">Nenhum produto em risco de vencimento imediato.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {expiringSoonData.pagination && expiringSoonData.pagination.totalPages > 1 && (
                        <div className="mt-4 pt-4 border-t dark:border-dark-700">
                            <Pagination
                                currentPage={page}
                                totalItems={expiringSoonData.pagination.total}
                                itemsPerPage={pageSize}
                                onPageChange={setPage}
                                onItemsPerPageChange={(size) => {
                                    setPageSize(size);
                                    setPage(1);
                                }}
                                itemsPerPageOptions={[5, 10, 20]}
                            />
                        </div>
                    )}
                </Card>

                <div className="space-y-6">
                    {/* Quick Stats */}
                    <Card variant="glass" className="p-6 bg-primary-600 text-white relative overflow-hidden transition-all hover:scale-[1.02]">
                        <HiOutlineTrendingDown className="w-16 h-16 absolute -bottom-4 -right-4 opacity-10" />
                        <h4 className="text-primary-100 text-sm font-medium">Perdas Potenciais (Página)</h4>
                        <p className="text-3xl font-black mt-1">
                            {expiringSoonData.data.reduce((acc, i) => acc + (i.price * i.currentStock), 0).toLocaleString()} MT
                        </p>
                        <p className="text-xs text-primary-200 mt-2">Valor em stock a vencer brevemente</p>
                    </Card>

                    {/* Checklists */}
                    <Card className="p-6">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <HiOutlineClipboardList className="w-5 h-5 text-primary-600" /> Controles Diários
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-lg cursor-pointer">
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                <span className="text-sm">Verificar Geladeira (2°C - 8°C)</span>
                            </div>
                            <div className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-lg cursor-pointer">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-sm">Controle de Psicotrópicos SNGPC</span>
                            </div>
                            <div className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-dark-700 rounded-lg cursor-pointer">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-sm">Balancete de Substâncias</span>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <HiOutlineShieldCheck className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-emerald-900 dark:text-emerald-400">Rastreabilidade</h4>
                                <p className="text-xs text-emerald-600 dark:text-emerald-500">Sistema em conformidade com as normas da MISAU.</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Batch Entry Modal */}
            <Modal
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
                title="Entrada de Lote / Reposição de Stock"
            >
                <form onSubmit={handleBatchEntry} className="space-y-4">
                    <Select
                        label="Selecionar Produto"
                        options={products.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                        value={batchData.productId}
                        onChange={(e) => setBatchData({ ...batchData, productId: e.target.value })}
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Número do Lote"
                            placeholder="Ex: L-2045-A"
                            value={batchData.batchNumber}
                            onChange={(e) => setBatchData({ ...batchData, batchNumber: e.target.value })}
                            required
                        />
                        <Input
                            label="Quantidade Recebida"
                            type="number"
                            value={batchData.quantity}
                            onChange={(e) => setBatchData({ ...batchData, quantity: e.target.value })}
                            required
                        />
                    </div>
                    <Input
                        label="Data de Validade"
                        type="date"
                        value={batchData.expiryDate}
                        onChange={(e) => setBatchData({ ...batchData, expiryDate: e.target.value })}
                        required
                    />
                    <div className="pt-4 flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setIsBatchModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="flex-1" disabled={!batchData.productId}>Salvar Entrada</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

