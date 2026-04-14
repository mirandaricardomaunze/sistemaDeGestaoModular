import { useState, useMemo } from 'react';
import { Card, Button, Badge, Input, Select, Modal, LoadingSpinner, PageHeader } from '../../components/ui';
import { 
    HiOutlinePlus, 
    HiOutlineArrowPath, 
    HiOutlineMagnifyingGlass, 
    HiOutlineFire, 
    HiOutlineTrash,
    HiOutlineCalculator,
    HiOutlineChartBar
} from 'react-icons/hi2';
import { useFuelSupplies, useCreateFuelSupply, useDeleteFuelSupply, useVehicles } from '../../hooks/useLogistics';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FuelPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [vehicleFilter, setVehicleFilter] = useState('');
    const page = 1;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const { data, isLoading, refetch } = useFuelSupplies({
        vehicleId: vehicleFilter || undefined,
        page,
        limit: 20
    });

    const { data: vehiclesData } = useVehicles({ limit: 100 });
    const createMutation = useCreateFuelSupply();
    const deleteMutation = useDeleteFuelSupply();

    const [formData, setFormData] = useState({
        vehicleId: '',
        date: new Date().toISOString().split('T')[0],
        liters: '',
        amount: '',
        mileage: '',
        provider: '',
        notes: ''
    });

    const stats = useMemo(() => {
        if (!data?.data) return { totalAmount: 0, totalLiters: 0, avgPrice: 0 };
        const totalAmount = data.data.reduce((acc, curr) => acc + curr.amount, 0);
        const totalLiters = data.data.reduce((acc, curr) => acc + curr.liters, 0);
        return {
            totalAmount,
            totalLiters,
            avgPrice: totalLiters > 0 ? totalAmount / totalLiters : 0
        };
    }, [data?.data]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await createMutation.mutateAsync({
            ...formData,
            liters: Number(formData.liters),
            amount: Number(formData.amount),
            mileage: Number(formData.mileage)
        });
        setIsModalOpen(false);
        setFormData({
            vehicleId: '',
            date: new Date().toISOString().split('T')[0],
            liters: '',
            amount: '',
            mileage: '',
            provider: '',
            notes: ''
        });
    };

    const handleDelete = async (id: string) => {
        await deleteMutation.mutateAsync(id);
        setDeleteConfirm(null);
    };

    if (isLoading) return <LoadingSpinner size="xl" className="h-96" />;

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader
                title={t('logistics_module.fuel.title')}
                subtitle={t('logistics_module.fuel.subtitle')}
                icon={<HiOutlineFire />}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" leftIcon={<HiOutlineArrowPath />} onClick={() => refetch()}>
                            {t('common.refresh')}
                        </Button>
                        <Button variant="primary" leftIcon={<HiOutlinePlus />} onClick={() => setIsModalOpen(true)}>
                            {t('logistics_module.fuel.add')}
                        </Button>
                    </div>
                }
            />

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-5 border-l-4 border-cyan-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-600">
                            <HiOutlineCalculator className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('logistics_module.fuel.monthlyCost')}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(stats.totalAmount)}
                            </p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5 border-l-4 border-blue-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                            <HiOutlineFire className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('logistics_module.fuel.liters')}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalLiters.toFixed(1)} L</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5 border-l-4 border-indigo-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                            <HiOutlineChartBar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('logistics_module.fuel.pricePerLiter')}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.avgPrice.toFixed(2)} MT/L
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <Card className="p-4 bg-white/50 dark:bg-dark-800/50 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder={t('common.search')}
                            className="pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select
                        className="w-full md:w-64"
                        value={vehicleFilter}
                        onChange={(e) => setVehicleFilter(e.target.value)}
                        options={[
                            { label: t('common.all'), value: '' },
                            ...(vehiclesData?.data || []).map(v => ({ 
                                label: `${v.brand} ${v.model} (${v.plate})`, 
                                value: v.id 
                            }))
                        ]}
                    />
                </div>
            </Card>

            {/* Table */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-dark-900/50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">{t('common.date')}</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">{t('logistics_module.fuel.provider')}</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">{t('logistics_module.fuel.liters')}</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">{t('logistics_module.fuel.amount')}</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">{t('logistics_module.fuel.mileage')}</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {data?.data.map((supply) => (
                                <tr key={supply.id} className="hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {format(new Date(supply.date), 'dd MMM yyyy', { locale: ptBR })}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">{supply.vehicle?.plate}</p>
                                        <p className="text-xs text-gray-400">{supply.provider || '-'}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="info">{supply.liters.toFixed(1)} L</Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                                            {supply.amount.toFixed(2)} MT
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{supply.mileage.toLocaleString()} km</td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => setDeleteConfirm(supply.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <HiOutlineTrash className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Modal de Abastecimento */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={t('logistics_module.fuel.add')}
                size="md"
            >
                <form onSubmit={handleCreate} className="space-y-4">
                    <Select
                        label={`${t('logistics_module.deliveries.vehicle')} *`}
                        required
                        value={formData.vehicleId}
                        onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                        options={(vehiclesData?.data || []).map(v => ({ 
                            label: `${v.brand} ${v.model} (${v.plate})`, 
                            value: v.id 
                        }))}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={t('common.date')}
                            type="date"
                            required
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                        <Input
                            label={t('logistics_module.fuel.mileage')}
                            type="number"
                            required
                            value={formData.mileage}
                            onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label={t('logistics_module.fuel.liters')}
                            type="number"
                            step="0.01"
                            required
                            value={formData.liters}
                            onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                        />
                        <Input
                            label={t('logistics_module.fuel.amount')}
                            type="number"
                            step="0.01"
                            required
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        />
                    </div>
                    <Input
                        label={t('logistics_module.fuel.provider')}
                        value={formData.provider}
                        onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    />
                    <div className="flex gap-2 justify-end pt-4">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
                        <Button variant="primary" type="submit" isLoading={createMutation.isLoading}>{t('common.save')}</Button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Confirmação de Deleção */}
            <Modal
                isOpen={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title={t('common.confirmDelete')}
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">{t('messages.confirmDelete')}</p>
                    <div className="flex gap-2 justify-end pt-2">
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button>
                        <Button variant="danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} isLoading={deleteMutation.isLoading}>
                            {t('common.delete')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
