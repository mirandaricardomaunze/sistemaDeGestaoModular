import { useState, useEffect } from 'react';
import { Card, Button, Badge, LoadingSpinner, Modal, Select, Input } from '../components/ui';
import { useWarehouses, useProducts } from '../hooks/useData';
import { warehousesAPI } from '../services/api';
import {
    HiOutlineTruck,
    HiOutlineLocationMarker,
    HiOutlineStatusOnline,
    HiOutlineRefresh,
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlinePrinter,
    HiOutlineDownload
} from 'react-icons/hi';
import toast from 'react-hot-toast';
import { generateGuiaRemessa } from '../utils/documentGenerator';
import { useStore } from '../stores/useStore';
import * as XLSX from 'xlsx';

export default function LogisticsDashboard() {
    const { companySettings } = useStore();
    const { warehouses, isLoading: isLoadingWarehouses } = useWarehouses();
    const { products } = useProducts();
    const [transfers, setTransfers] = useState<any[]>([]);
    const [isLoadingTransfers, setIsLoadingTransfers] = useState(true);

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferData, setTransferData] = useState({
        sourceWarehouseId: '',
        targetWarehouseId: '',
        responsible: '',
        reason: '',
        items: [{ productId: '', quantity: 1 }]
    });

    const fetchTransfers = async () => {
        setIsLoadingTransfers(true);
        try {
            const data = await warehousesAPI.getTransfers();
            setTransfers(data);
        } catch (error) {
            console.error('Error fetching transfers:', error);
        } finally {
            setIsLoadingTransfers(false);
        }
    };

    useEffect(() => {
        fetchTransfers();
    }, []);

    const handleCreateTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (transferData.sourceWarehouseId === transferData.targetWarehouseId) {
            return toast.error('Origem e destino não podem ser iguais');
        }
        try {
            await warehousesAPI.createTransfer(transferData);
            toast.success('Transferência concluída com sucesso!');
            setIsTransferModalOpen(false);
            setTransferData({
                sourceWarehouseId: '',
                targetWarehouseId: '',
                responsible: '',
                reason: '',
                items: [{ productId: '', quantity: 1 }]
            });
            fetchTransfers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao criar transferência');
        }
    };

    const addItem = () => {
        setTransferData({
            ...transferData,
            items: [...transferData.items, { productId: '', quantity: 1 }]
        });
    };

    const removeItem = (index: number) => {
        setTransferData({
            ...transferData,
            items: transferData.items.filter((_, i) => i !== index)
        });
    };

    const exportToExcel = () => {
        const data = transfers.map(tr => ({
            'Guia': tr.number,
            'Origem': tr.sourceWarehouse?.name,
            'Destino': tr.targetWarehouse?.name,
            'Estado': tr.status,
            'Responsável': tr.responsible,
            'Data': new Date(tr.date || tr.createdAt).toLocaleDateString(),
            'Total Itens': tr.items?.length
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Transferencias');
        XLSX.writeFile(workbook, `Logistica_Transferencias_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const totalStock = warehouses.reduce((acc, w) => acc + (w as any).totalItems || 0, 0);

    if (isLoadingWarehouses) return <LoadingSpinner size="xl" className="h-96" />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Logística e Cadeia de Suprimentos</h1>
                    <p className="text-gray-500 dark:text-gray-400">Controle de Armazéns e Transferências em Tempo Real</p>
                </div>
                <div className="flex gap-2">
                    <div className="text-right px-4 py-1 bg-primary-50 dark:bg-primary-900/10 rounded-lg hidden md:block">
                        <p className="text-xs text-primary-600 font-medium">Stock Global</p>
                        <p className="text-lg font-bold text-primary-700">{totalStock.toLocaleString()}</p>
                    </div>
                    <Button variant="outline" leftIcon={<HiOutlineRefresh className="w-5 h-5" />} onClick={fetchTransfers}>Actualizar</Button>
                    <Button variant="outline" leftIcon={<HiOutlineDownload className="w-5 h-5" />} onClick={exportToExcel}>Exportar Excel</Button>
                    <Button leftIcon={<HiOutlineTruck className="w-5 h-5" />} onClick={() => setIsTransferModalOpen(true)}>Nova Guia de Remessa</Button>
                </div>
            </div>

            {/* Warehouse Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {warehouses.slice(0, 3).map((w, idx) => (
                    <Card key={w.id} variant="glass" className="p-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${idx % 2 === 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-purple-100 dark:bg-purple-900/30'}`}>
                                <HiOutlineLocationMarker className={`w-6 h-6 ${idx % 2 === 0 ? 'text-blue-600' : 'text-purple-600'}`} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{w.name}</h3>
                                <p className={`text-sm flex items-center gap-1 ${w.isActive ? 'text-green-500' : 'text-red-500'}`}>
                                    <HiOutlineStatusOnline className="w-3 h-3" /> {w.isActive ? 'Operacional' : 'Inativo'}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Localização</span>
                                <span className="font-medium">{w.location || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Cód. Identificador</span>
                                <Badge variant="gray" size="sm" className="font-mono">{w.code}</Badge>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Recent Transfers Table */}
            <Card variant="glass" padding="none">
                <div className="p-4 border-b dark:border-dark-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <HiOutlineTruck className="w-5 h-5 text-primary-600" />
                        <h3 className="font-bold text-lg">Histórico de Transferências</h3>
                    </div>
                    <Button variant="ghost" size="sm">Ver Relatório Completo</Button>
                </div>
                <div className="overflow-x-auto">
                    {isLoadingTransfers ? (
                        <div className="p-8"><LoadingSpinner /></div>
                    ) : transfers.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-dark-800 text-gray-500 dark:text-gray-400 uppercase text-xs">
                                    <th className="p-4 font-semibold">Guia</th>
                                    <th className="p-4 font-semibold">Origem</th>
                                    <th className="p-4 font-semibold">Destino</th>
                                    <th className="p-4 font-semibold">Estado</th>
                                    <th className="p-4 font-semibold">Responsável</th>
                                    <th className="p-4 font-semibold">Data</th>
                                    <th className="p-4 font-semibold text-center">Itens</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-dark-700">
                                {transfers.map(tr => (
                                    <tr key={tr.id} className="hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                        <td className="p-4 font-bold text-primary-600 font-mono text-sm">{tr.number}</td>
                                        <td className="p-4 text-sm">{tr.sourceWarehouse?.name}</td>
                                        <td className="p-4 text-sm">{tr.targetWarehouse?.name}</td>
                                        <td className="p-4">
                                            <Badge variant={tr.status === 'completed' ? 'success' : tr.status === 'pending' ? 'warning' : 'danger'}>
                                                {tr.status.toUpperCase()}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-sm">{tr.responsible || 'Sistema'}</td>
                                        <td className="p-4 text-sm text-gray-500">{new Date(tr.date || tr.createdAt).toLocaleDateString()}</td>
                                        <td className="p-4 text-center flex items-center justify-center gap-2">
                                            <span className="bg-gray-100 dark:bg-dark-700 px-2 py-1 rounded text-xs font-bold mr-2">{tr.items?.length || 0}</span>
                                            <Button variant="ghost" size="sm" className="p-1" onClick={() => generateGuiaRemessa(tr, companySettings)}>
                                                <HiOutlinePrinter className="w-5 h-5 text-gray-400 hover:text-primary-500" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-8 text-center text-gray-500 italic">Nenhuma transferência realizada recentemente.</div>
                    )}
                </div>
            </Card>

            {/* Modal de Nova Guias de Remessa */}
            <Modal
                isOpen={isTransferModalOpen}
                onClose={() => setIsTransferModalOpen(false)}
                title="Nova Guia de Remessa / Transferência"
                size="lg"
            >
                <form onSubmit={handleCreateTransfer} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Armazém de Origem"
                            options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                            value={transferData.sourceWarehouseId}
                            onChange={(e) => setTransferData({ ...transferData, sourceWarehouseId: e.target.value })}
                            required
                        />
                        <Select
                            label="Armazém de Destino"
                            options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                            value={transferData.targetWarehouseId}
                            onChange={(e) => setTransferData({ ...transferData, targetWarehouseId: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Itens para Transferir</label>
                        {transferData.items.map((item, index) => (
                            <div key={index} className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Select
                                        options={products.map(p => ({ value: p.id, label: `${p.name} (Stock: ${p.currentStock})` }))}
                                        value={item.productId}
                                        onChange={(e) => {
                                            const newItems = [...transferData.items];
                                            newItems[index].productId = e.target.value;
                                            setTransferData({ ...transferData, items: newItems });
                                        }}
                                        required
                                    />
                                </div>
                                <div className="w-24">
                                    <Input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => {
                                            const newItems = [...transferData.items];
                                            newItems[index].quantity = parseInt(e.target.value);
                                            setTransferData({ ...transferData, items: newItems });
                                        }}
                                        required
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    className="p-2 border-red-500 text-red-500 hover:bg-red-50"
                                    onClick={() => removeItem(index)}
                                    disabled={transferData.items.length === 1}
                                >
                                    <HiOutlineTrash className="w-5 h-5" />
                                </Button>
                            </div>
                        ))}
                        <Button variant="ghost" size="sm" leftIcon={<HiOutlinePlus />} onClick={addItem}>Adicionar Produto</Button>
                    </div>

                    <Input
                        label="Responsável"
                        placeholder="Nome do operador"
                        value={transferData.responsible}
                        onChange={(e) => setTransferData({ ...transferData, responsible: e.target.value })}
                        required
                    />

                    <div className="pt-4 flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setIsTransferModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="flex-1">Emitir Guia e Transferir</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

