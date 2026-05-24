import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Card, Button, Badge, Input, Select, Modal, PageHeader, SmartTable } from '../../components/ui';
import {
    HiOutlinePlus,
    HiOutlineArrowPath,
    HiOutlineFire,
    HiOutlineTrash,
    HiOutlineCalculator,
    HiOutlineChartBar,
} from 'react-icons/hi2';
import { useFuelSupplies, useCreateFuelSupply, useDeleteFuelSupply, useVehicles } from '../../hooks/useLogistics';
import type { FuelSupply } from '../../services/api/logistics.api';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FuelPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [vehicleFilter, setVehicleFilter] = useState('');
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const { data, isLoading, refetch } = useFuelSupplies({
        vehicleId: vehicleFilter || undefined,
        page,
        limit: 20,
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
        notes: '',
    });

    const supplies = useMemo(() => data?.data ?? [], [data?.data]);

    const filteredSupplies = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return supplies;

        return supplies.filter((supply) => {
            const plate = supply.vehicle?.plate?.toLowerCase() ?? '';
            const provider = supply.provider?.toLowerCase() ?? '';
            return plate.includes(query) || provider.includes(query);
        });
    }, [search, supplies]);

    const stats = useMemo(() => {
        const totalAmount = supplies.reduce((acc, curr) => acc + curr.amount, 0);
        const totalLiters = supplies.reduce((acc, curr) => acc + curr.liters, 0);
        return {
            totalAmount,
            totalLiters,
            avgPrice: totalLiters > 0 ? totalAmount / totalLiters : 0,
        };
    }, [supplies]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await createMutation.mutateAsync({
            ...formData,
            liters: Number(formData.liters),
            amount: Number(formData.amount),
            mileage: Number(formData.mileage),
        });
        setIsModalOpen(false);
        setFormData({
            vehicleId: '',
            date: new Date().toISOString().split('T')[0],
            liters: '',
            amount: '',
            mileage: '',
            provider: '',
            notes: '',
        });
    };

    const handleDelete = async (id: string) => {
        await deleteMutation.mutateAsync(id);
        setDeleteConfirm(null);
    };

    const columns = useMemo<ColumnDef<FuelSupply, unknown>[]>(() => [
        {
            header: t('common.date'),
            cell: ({ row }) => (
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {format(new Date(row.original.date), 'dd MMM yyyy', { locale: ptBR })}
                </span>
            ),
        },
        {
            header: t('logistics_module.fuel.provider'),
            cell: ({ row }) => (
                <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">{row.original.vehicle?.plate}</p>
                    <p className="text-xs text-gray-400">{row.original.provider || '-'}</p>
                </div>
            ),
        },
        {
            header: t('logistics_module.fuel.liters'),
            cell: ({ row }) => <Badge variant="info">{row.original.liters.toFixed(1)} L</Badge>,
        },
        {
            header: t('logistics_module.fuel.amount'),
            cell: ({ row }) => (
                <span className="text-sm font-mono font-bold text-gray-900 dark:text-white">
                    {row.original.amount.toFixed(2)} MT
                </span>
            ),
        },
        {
            header: t('logistics_module.fuel.mileage'),
            cell: ({ row }) => `${row.original.mileage.toLocaleString()} km`,
        },
        {
            header: '',
            cell: ({ row }) => (
                <div className="text-right">
                    <Button variant="ghost"
                        onClick={() => setDeleteConfirm(row.original.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title={t('common.delete')}
                    >
                        <HiOutlineTrash className="w-5 h-5" />
                    </Button>
                </div>
            ),
        },
    ], [t]);

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-5 bg-cyan-100/40 dark:bg-cyan-900/20 border border-cyan-200/50 dark:border-cyan-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-cyan-200/60 dark:bg-cyan-900/40 flex items-center justify-center text-cyan-700 dark:text-cyan-300 shadow-inner group-hover:scale-110 transition-transform">
                            <HiOutlineCalculator className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-600/70 dark:text-cyan-400/60">{t('logistics_module.fuel.monthlyCost')}</p>
                            <p className="text-2xl font-black text-cyan-900 dark:text-white leading-none mt-1">
                                {new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(stats.totalAmount)}
                            </p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5 bg-blue-100/40 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-blue-200/60 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300 shadow-inner group-hover:scale-110 transition-transform">
                            <HiOutlineFire className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/70 dark:text-blue-400/60">{t('logistics_module.fuel.liters')}</p>
                            <p className="text-2xl font-black text-blue-900 dark:text-white leading-none mt-1">{stats.totalLiters.toFixed(1)} L</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5 bg-indigo-100/40 dark:bg-indigo-900/20 border border-indigo-200/50 dark:border-indigo-800/30 shadow-card-strong transition-all hover:scale-[1.02] overflow-hidden group">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-indigo-200/60 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shadow-inner group-hover:scale-110 transition-transform">
                            <HiOutlineChartBar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600/70 dark:text-indigo-400/60">{t('logistics_module.fuel.pricePerLiter')}</p>
                            <p className="text-2xl font-black text-indigo-900 dark:text-white leading-none mt-1">
                                {stats.avgPrice.toFixed(2)} MT/L
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            <SmartTable
                data={filteredSupplies}
                columns={columns}
                isLoading={isLoading}
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: t('common.search'),
                }}
                renderFilters={(
                    <Select
                        className="w-full md:w-64 bg-white dark:bg-dark-800"
                        value={vehicleFilter}
                        onChange={(e) => {
                            setVehicleFilter(e.target.value);
                            setPage(1);
                        }}
                        options={[
                            { label: t('common.all'), value: '' },
                            ...(vehiclesData?.data || []).map(v => ({
                                label: `${v.brand} ${v.model} (${v.plate})`,
                                value: v.id,
                            })),
                        ]}
                        size="sm"
                    />
                )}
                emptyTitle={t('common.noData')}
                emptyDescription={t('logistics_module.fuel.subtitle')}
                pagination={data?.pagination ? {
                    currentPage: page,
                    totalItems: data.pagination.total,
                    itemsPerPage: 20,
                    onPageChange: setPage,
                } : undefined}
            />

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
                            value: v.id,
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
