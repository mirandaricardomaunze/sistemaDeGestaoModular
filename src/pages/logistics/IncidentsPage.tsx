import { useState, useMemo } from 'react';
import { Card, Button, Badge, Input, Select, Modal, LoadingSpinner, PageHeader } from '../../components/ui';
import { 
    HiOutlinePlus, 
    HiOutlineArrowPath, 
    HiOutlineMagnifyingGlass, 
    HiOutlineExclamationTriangle, 
    HiOutlineTrash,
    HiOutlineCurrencyDollar,
    HiOutlineClock
} from 'react-icons/hi2';
import { useVehicleIncidents, useCreateIncident, useDeleteIncident, useVehicles, useDrivers } from '../../hooks/useLogistics';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function IncidentsPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [page] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const { data, isLoading, refetch } = useVehicleIncidents({
        type: typeFilter || undefined,
        page,
        limit: 20
    });

    const { data: vehiclesData } = useVehicles({ limit: 100 });
    const { data: driversData } = useDrivers({ limit: 200 });
    const createMutation = useCreateIncident();
    const deleteMutation = useDeleteIncident();

    const [formData, setFormData] = useState({
        vehicleId: '',
        driverId: '',
        date: new Date().toISOString().split('T')[0],
        type: 'accident',
        severity: 'medium',
        description: '',
        cost: '',
        location: '',
        status: 'open'
    });

    const stats = useMemo(() => {
        if (!data?.data) return { totalCost: 0, openIncidents: 0, criticalCount: 0 };
        const totalCost = data.data.reduce((acc, curr) => acc + (curr.cost || 0), 0);
        const openIncidents = data.data.filter(i => i.status === 'open').length;
        const criticalCount = data.data.filter(i => i.severity === 'critical').length;
        return { totalCost, openIncidents, criticalCount };
    }, [data?.data]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        await createMutation.mutateAsync({
            ...formData,
            cost: formData.cost ? Number(formData.cost) : undefined
        } as any);
        setIsModalOpen(false);
        setFormData({
            vehicleId: '',
            driverId: '',
            date: new Date().toISOString().split('T')[0],
            type: 'accident',
            severity: 'medium',
            description: '',
            cost: '',
            location: '',
            status: 'open'
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
                title={t('logistics_module.incidents.title')}
                subtitle={t('logistics_module.incidents.subtitle')}
                icon={<HiOutlineExclamationTriangle />}
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" leftIcon={<HiOutlineArrowPath />} onClick={() => refetch()}>
                            {t('common.refresh')}
                        </Button>
                        <Button variant="primary" leftIcon={<HiOutlinePlus />} onClick={() => setIsModalOpen(true)}>
                            {t('logistics_module.incidents.add')}
                        </Button>
                    </div>
                }
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-5 border-l-4 border-red-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                            <HiOutlineExclamationTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('logistics_module.incidents.status.open')}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.openIncidents}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5 border-l-4 border-orange-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                            <HiOutlineClock className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('logistics_module.incidents.severity.critical')}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.criticalCount}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5 border-l-4 border-gray-500">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-900/30 flex items-center justify-center text-gray-600">
                            <HiOutlineCurrencyDollar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('logistics_module.incidents.cost')}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(stats.totalCost)}
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
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        options={[
                            { label: t('common.all'), value: '' },
                            { label: t('logistics_module.incidents.types.accident'), value: 'accident' },
                            { label: t('logistics_module.incidents.types.fine'), value: 'fine' },
                            { label: t('logistics_module.incidents.types.breakdown'), value: 'breakdown' },
                            { label: t('logistics_module.incidents.types.theft'), value: 'theft' },
                            { label: t('logistics_module.incidents.types.other'), value: 'other' }
                        ]}
                    />
                </div>
            </Card>

            {/* Incidents Table */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-dark-900/50">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">{t('common.date')}</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">{t('common.description')}</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">{t('common.status')}</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">{t('logistics_module.incidents.cost')}</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {data?.data.map((incident) => (
                                <tr key={incident.id} className="hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {format(new Date(incident.date), 'dd MMM yyyy', { locale: ptBR })}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant={incident.type === 'accident' ? 'danger' : 'warning'}>
                                                {t(`logistics_module.incidents.types.${incident.type}`)}
                                            </Badge>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                incident.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                                incident.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {t(`logistics_module.incidents.severity.${incident.severity}`)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">{incident.description}</p>
                                        <p className="text-xs text-gray-400 font-medium">
                                            {incident.vehicle?.plate} • {incident.driver?.name || 'Sem motorista'}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant={incident.status === 'resolved' ? 'success' : 'danger'}>
                                            {t(`logistics_module.incidents.status.${incident.status}`)}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                                            {incident.cost ? `${incident.cost.toFixed(2)} MT` : '-'}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => setDeleteConfirm(incident.id)}
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

            {/* Report Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={t('logistics_module.incidents.add')}
                size="lg"
            >
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <Select
                            label={`${t('logistics_module.deliveries.driver')} *`}
                            required
                            value={formData.driverId}
                            onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                            options={(driversData?.data || []).map(d => ({ 
                                label: d.name, 
                                value: d.id 
                            }))}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            label={t('common.date')}
                            type="date"
                            required
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        />
                        <Select
                            label={`${t('common.type')} *`}
                            required
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            options={[
                                { label: t('logistics_module.incidents.types.accident'), value: 'accident' },
                                { label: t('logistics_module.incidents.types.fine'), value: 'fine' },
                                { label: t('logistics_module.incidents.types.breakdown'), value: 'breakdown' },
                                { label: t('logistics_module.incidents.types.theft'), value: 'theft' },
                                { label: t('logistics_module.incidents.types.other'), value: 'other' }
                            ]}
                        />
                        <Select
                            label={`${t('logistics_module.maintenance.description')} *`}
                            required
                            value={formData.severity}
                            onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                            options={[
                                { label: t('logistics_module.incidents.severity.low'), value: 'low' },
                                { label: t('logistics_module.incidents.severity.medium'), value: 'medium' },
                                { label: t('logistics_module.incidents.severity.high'), value: 'high' },
                                { label: t('logistics_module.incidents.severity.critical'), value: 'critical' }
                            ]}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label={t('logistics_module.incidents.location')}
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                        <Input
                            label={t('logistics_module.incidents.cost')}
                            type="number"
                            step="0.01"
                            value={formData.cost}
                            onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                        />
                    </div>
                    <Input
                        label={t('common.description')}
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
