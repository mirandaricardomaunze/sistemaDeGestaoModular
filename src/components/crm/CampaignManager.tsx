/**
 * Campaign Manager Component
 * Gestão de campanhas promocionais e segmentação de clientes
 */

import { useState, useMemo } from 'react';
import {
    HiOutlinePlus,
    HiOutlineSearch,
    HiOutlineTag,
    HiOutlineCalendar,
    HiOutlineUsers,
    HiOutlinePlay,
    HiOutlinePause,
    HiOutlineEye,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineTicket,
    HiOutlineStop,
} from 'react-icons/hi';
import { useCampaigns } from '../../hooks/useData';
import { Button, Card, Modal, Input, Select, Badge, Textarea, Pagination, usePagination } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import {
    CAMPAIGN_STATUS_LABELS,
    DISCOUNT_TYPE_LABELS,
    CUSTOMER_CATEGORY_LABELS,
    type Campaign,
    type CampaignStatus,
    type DiscountType,
    type CustomerCategory,
} from '../../types/crm';
import toast from 'react-hot-toast';

export default function CampaignManager() {
    const {
        campaigns: campaignsData,
        addCampaign: createCampaign,
        updateCampaign,
        deleteCampaign: removeCampaign,
    } = useCampaigns();

    // Transform campaign data to match expected structure
    const campaigns = (campaignsData || []).map((c: any) => ({
        ...c,
        status: c.status || 'active',
        currentUses: c.currentUses || 0,
        metrics: c.metrics || { totalSales: 0, ordersGenerated: 0, customersReached: 0, totalDiscount: 0 },
        targetAudience: c.targetAudience || { allCustomers: true },
    })) as Campaign[];

    // State
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showFormModal, setShowFormModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        code: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        discountType: 'percentage' as DiscountType,
        discountValue: 10,
        minPurchaseAmount: 0,
        maxDiscountAmount: 0,
        maxTotalUses: 0,
        maxUsesPerCustomer: 1,
        applyToAllProducts: true,
        // Segmentation
        allCustomers: true,
        customerCategories: [] as string[],
        minTotalPurchases: 0,
        cities: [] as string[],
        customerTags: [] as string[],
    });

    // Filter campaigns
    const filteredCampaigns = useMemo(() => {
        return campaigns.filter((campaign) => {
            const matchesSearch = campaign.name.toLowerCase().includes(search.toLowerCase()) ||
                campaign.code?.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [campaigns, search, statusFilter]);

    // Pagination
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedCampaigns,
        totalItems,
    } = usePagination(filteredCampaigns, 10);

    // Handlers
    const handleOpenForm = (campaign?: Campaign) => {
        if (campaign) {
            setIsEditing(true);
            setFormData({
                name: campaign.name,
                description: campaign.description || '',
                code: campaign.code || '',
                startDate: campaign.startDate.split('T')[0],
                endDate: campaign.endDate.split('T')[0],
                discountType: campaign.discountType,
                discountValue: campaign.discountValue,
                minPurchaseAmount: campaign.minPurchaseAmount || 0,
                maxDiscountAmount: campaign.maxDiscountAmount || 0,
                maxTotalUses: campaign.maxTotalUses || 0,
                maxUsesPerCustomer: campaign.maxUsesPerCustomer || 1,
                applyToAllProducts: campaign.applyToAllProducts,
                allCustomers: campaign.targetAudience.allCustomers,
                customerCategories: campaign.targetAudience.customerCategories || [],
                minTotalPurchases: campaign.targetAudience.minTotalPurchases || 0,
                cities: campaign.targetAudience.cities || [],
                customerTags: campaign.targetAudience.customerTags || [],
            });
            setSelectedCampaign(campaign);
        } else {
            setIsEditing(false);
            resetForm();
        }
        setShowFormModal(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            code: '',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            discountType: 'percentage',
            discountValue: 10,
            minPurchaseAmount: 0,
            maxDiscountAmount: 0,
            maxTotalUses: 0,
            maxUsesPerCustomer: 1,
            applyToAllProducts: true,
            allCustomers: true,
            customerCategories: [],
            minTotalPurchases: 0,
            cities: [],
            customerTags: [],
        });
    };

    const handleSubmit = () => {
        if (!formData.name) {
            toast.error('Preencha o nome da campanha');
            return;
        }

        const campaignData = {
            name: formData.name,
            description: formData.description,
            code: formData.code || undefined,
            status: 'draft' as CampaignStatus,
            startDate: new Date(formData.startDate).toISOString(),
            endDate: new Date(formData.endDate).toISOString(),
            discountType: formData.discountType,
            discountValue: formData.discountValue,
            minPurchaseAmount: formData.minPurchaseAmount || undefined,
            maxDiscountAmount: formData.maxDiscountAmount || undefined,
            maxTotalUses: formData.maxTotalUses || undefined,
            maxUsesPerCustomer: formData.maxUsesPerCustomer || undefined,
            applyToAllProducts: formData.applyToAllProducts,
            targetAudience: {
                allCustomers: formData.allCustomers,
                customerCategories: formData.customerCategories.length > 0 ? formData.customerCategories : undefined,
                minTotalPurchases: formData.minTotalPurchases || undefined,
                cities: formData.cities.length > 0 ? formData.cities : undefined,
                customerTags: formData.customerTags.length > 0 ? formData.customerTags : undefined,
            },
            createdBy: 'Sistema',
        };

        if (isEditing && selectedCampaign) {
            updateCampaign(selectedCampaign.id, campaignData as any);
            toast.success('Campanha atualizada!');
        } else {
            createCampaign(campaignData as any);
            toast.success('Campanha criada!');
        }

        setShowFormModal(false);
        resetForm();
    };

    const handleDelete = (campaign: Campaign) => {
        setSelectedCampaign(campaign);
        setShowDeleteModal(true);
    };

    const performDelete = () => {
        if (!selectedCampaign) return;
        removeCampaign(selectedCampaign.id);
        toast.success('Campanha eliminada!');
        setShowDeleteModal(false);
        setSelectedCampaign(null);
    };

    // API-based status change handlers
    const activateCampaign = (id: string) => {
        updateCampaign(id, { status: 'active' } as any);
    };

    const pauseCampaign = (id: string) => {
        updateCampaign(id, { status: 'paused' } as any);
    };

    const endCampaign = (id: string) => {
        updateCampaign(id, { status: 'ended' } as any);
    };

    const handleViewDetails = (campaign: Campaign) => {
        setSelectedCampaign(campaign);
        setShowDetailsModal(true);
    };

    // Get status badge variant
    const getStatusBadge = (status: CampaignStatus) => {
        const variants: Record<CampaignStatus, 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'primary'> = {
            active: 'success',
            scheduled: 'info',
            draft: 'gray',
            paused: 'warning',
            ended: 'gray',
            cancelled: 'danger',
        };
        return <Badge variant={variants[status]}>{CAMPAIGN_STATUS_LABELS[status]}</Badge>;
    };

    // Toggle category selection
    const toggleCategory = (category: string) => {
        setFormData(prev => ({
            ...prev,
            customerCategories: prev.customerCategories.includes(category)
                ? prev.customerCategories.filter(c => c !== category)
                : [...prev.customerCategories, category],
        }));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineTag className="w-6 h-6" />
                        Campanhas Promocionais
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {campaigns.filter(c => c.status === 'active').length} campanhas ativas
                    </p>
                </div>
                <Button
                    onClick={() => handleOpenForm()}
                    leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                >
                    Nova Campanha
                </Button>
            </div>

            {/* Filters */}
            <Card padding="md">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <Input
                            placeholder="Pesquisar campanhas..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                        />
                    </div>
                    <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        options={[
                            { value: 'all', label: 'Todos os Estados' },
                            ...Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, label]) => ({ value, label })),
                        ]}
                        className="w-full sm:w-48"
                    />
                </div>
            </Card>

            {/* Campaign Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card padding="md" className="text-center">
                    <p className="text-2xl font-bold text-primary-600">{campaigns.length}</p>
                    <p className="text-sm text-gray-500">Total Campanhas</p>
                </Card>
                <Card padding="md" className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                        {campaigns.filter(c => c.status === 'active').length}
                    </p>
                    <p className="text-sm text-gray-500">Ativas</p>
                </Card>
                <Card padding="md" className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(campaigns.reduce((sum, c) => sum + c.metrics.totalSales, 0))}
                    </p>
                    <p className="text-sm text-gray-500">Vendas Geradas</p>
                </Card>
                <Card padding="md" className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                        {campaigns.reduce((sum, c) => sum + c.currentUses, 0)}
                    </p>
                    <p className="text-sm text-gray-500">Usos Totais</p>
                </Card>
            </div>

            {/* Campaigns Table */}
            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                        <thead className="bg-gray-50 dark:bg-dark-800">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Campanha
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Desconto
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Período
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Estado
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Usos
                                </th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                            {paginatedCampaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        Nenhuma campanha encontrada
                                    </td>
                                </tr>
                            ) : (
                                paginatedCampaigns.map((campaign) => (
                                    <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {campaign.name}
                                                </p>
                                                {campaign.code && (
                                                    <p className="text-sm text-gray-500 font-mono">
                                                        {campaign.code}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <HiOutlineTicket className="w-4 h-4 text-primary-500" />
                                                <span className="font-medium text-primary-600">
                                                    {campaign.discountType === 'percentage'
                                                        ? `${campaign.discountValue}% `
                                                        : formatCurrency(campaign.discountValue)
                                                    }
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                {DISCOUNT_TYPE_LABELS[campaign.discountType]}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <HiOutlineCalendar className="w-4 h-4" />
                                                <span>
                                                    {new Date(campaign.startDate).toLocaleDateString('pt-MZ')} -{' '}
                                                    {new Date(campaign.endDate).toLocaleDateString('pt-MZ')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {getStatusBadge(campaign.status)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="font-medium">
                                                {campaign.currentUses}
                                                {campaign.maxTotalUses && (
                                                    <span className="text-gray-400">/{campaign.maxTotalUses}</span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => handleViewDetails(campaign)}
                                                    className="p-2 text-gray-400 hover:text-blue-500"
                                                    title="Ver Detalhes"
                                                >
                                                    <HiOutlineEye className="w-4 h-4" />
                                                </button>
                                                {campaign.status === 'draft' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleOpenForm(campaign)}
                                                            className="p-2 text-gray-400 hover:text-primary-500"
                                                            title="Editar"
                                                        >
                                                            <HiOutlinePencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                activateCampaign(campaign.id);
                                                                toast.success('Campanha ativada!');
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-green-500"
                                                            title="Ativar"
                                                        >
                                                            <HiOutlinePlay className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {campaign.status === 'active' && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                pauseCampaign(campaign.id);
                                                                toast.success('Campanha pausada!');
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-yellow-500"
                                                            title="Pausar"
                                                        >
                                                            <HiOutlinePause className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                endCampaign(campaign.id);
                                                                toast.success('Campanha encerrada!');
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-red-500"
                                                            title="Encerrar"
                                                        >
                                                            <HiOutlineStop className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                {campaign.status === 'paused' && (
                                                    <button
                                                        onClick={() => {
                                                            activateCampaign(campaign.id);
                                                            toast.success('Campanha reativada!');
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-green-500"
                                                        title="Reativar"
                                                    >
                                                        <HiOutlinePlay className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(campaign.id)}
                                                    className="p-2 text-gray-400 hover:text-red-500"
                                                    title="Eliminar"
                                                >
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 border-t border-gray-200 dark:border-dark-700">
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </div>
            </Card>

            {/* Form Modal */}
            <Modal
                isOpen={showFormModal}
                onClose={() => setShowFormModal(false)}
                title={isEditing ? 'Editar Campanha' : 'Nova Campanha'}
                size="lg"
            >
                <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white">Informações Básicas</h4>
                        <Input
                            label="Nome da Campanha *"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ex: Promoção de Natal"
                        />
                        <Textarea
                            label="Descrição"
                            value={formData.description}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                        />
                        <Input
                            label="Código Promocional"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            placeholder="Ex: NATAL2024"
                        />
                    </div>

                    {/* Dates */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white">Período</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Data Início"
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            />
                            <Input
                                label="Data Fim"
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Discount */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white">Desconto</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Tipo de Desconto"
                                value={formData.discountType}
                                onChange={(e) => setFormData({ ...formData, discountType: e.target.value as DiscountType })}
                                options={Object.entries(DISCOUNT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                            />
                            <Input
                                label={formData.discountType === 'percentage' ? 'Percentagem (%)' : 'Valor (MZN)'}
                                type="number"
                                value={formData.discountValue}
                                onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Compra Mínima (MZN)"
                                type="number"
                                value={formData.minPurchaseAmount}
                                onChange={(e) => setFormData({ ...formData, minPurchaseAmount: Number(e.target.value) })}
                            />
                            <Input
                                label="Desconto Máximo (MZN)"
                                type="number"
                                value={formData.maxDiscountAmount}
                                onChange={(e) => setFormData({ ...formData, maxDiscountAmount: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    {/* Usage Limits */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white">Limites de Uso</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Usos Totais (0 = ilimitado)"
                                type="number"
                                value={formData.maxTotalUses}
                                onChange={(e) => setFormData({ ...formData, maxTotalUses: Number(e.target.value) })}
                            />
                            <Input
                                label="Usos por Cliente"
                                type="number"
                                value={formData.maxUsesPerCustomer}
                                onChange={(e) => setFormData({ ...formData, maxUsesPerCustomer: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    {/* Segmentation */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white">Público-Alvo</h4>

                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.allCustomers}
                                onChange={(e) => setFormData({ ...formData, allCustomers: e.target.checked })}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span>Todos os clientes</span>
                        </label>

                        {!formData.allCustomers && (
                            <div className="space-y-4 pl-4 border-l-2 border-primary-200">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Categorias de Cliente
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(CUSTOMER_CATEGORY_LABELS).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => toggleCategory(value)}
                                                className={`px - 3 py - 1.5 rounded - lg text - sm font - medium transition - colors ${formData.customerCategories.includes(value)
                                                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                                        : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400'
                                                    } `}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <Input
                                    label="Compras Mínimas (MZN)"
                                    type="number"
                                    value={formData.minTotalPurchases}
                                    onChange={(e) => setFormData({ ...formData, minTotalPurchases: Number(e.target.value) })}
                                    helperText="Apenas clientes com histórico de compras acima deste valor"
                                />
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-dark-700">
                        <Button variant="ghost" onClick={() => setShowFormModal(false)}>Cancelar</Button>
                        <Button onClick={handleSubmit}>
                            {isEditing ? 'Guardar Alterações' : 'Criar Campanha'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Details Modal */}
            <Modal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                title={selectedCampaign?.name || 'Detalhes'}
                size="lg"
            >
                {selectedCampaign && (
                    <div className="space-y-6">
                        {/* Status and Actions */}
                        <div className="flex items-center justify-between">
                            {getStatusBadge(selectedCampaign.status)}
                            <div className="flex gap-2">
                                {selectedCampaign.status === 'draft' && (
                                    <Button
                                        size="sm"
                                        onClick={() => {
                                            activateCampaign(selectedCampaign.id);
                                            setShowDetailsModal(false);
                                            toast.success('Campanha ativada!');
                                        }}
                                    >
                                        Ativar Campanha
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">Código</p>
                                <p className="font-mono font-medium">{selectedCampaign.code || '-'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Desconto</p>
                                <p className="font-medium text-primary-600">
                                    {selectedCampaign.discountType === 'percentage'
                                        ? `${selectedCampaign.discountValue}% `
                                        : formatCurrency(selectedCampaign.discountValue)
                                    }
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Período</p>
                                <p className="text-sm">
                                    {new Date(selectedCampaign.startDate).toLocaleDateString('pt-MZ')} -{' '}
                                    {new Date(selectedCampaign.endDate).toLocaleDateString('pt-MZ')}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Usos</p>
                                <p className="font-medium">
                                    {selectedCampaign.currentUses}
                                    {selectedCampaign.maxTotalUses && ` / ${selectedCampaign.maxTotalUses} `}
                                </p>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Resultados</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                                    <p className="text-lg font-bold text-blue-600">
                                        {selectedCampaign.metrics.customersReached}
                                    </p>
                                    <p className="text-xs text-blue-700">Clientes Alcançados</p>
                                </div>
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                                    <p className="text-lg font-bold text-green-600">
                                        {formatCurrency(selectedCampaign.metrics.totalSales)}
                                    </p>
                                    <p className="text-xs text-green-700">Vendas Geradas</p>
                                </div>
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
                                    <p className="text-lg font-bold text-orange-600">
                                        {formatCurrency(selectedCampaign.metrics.totalDiscount)}
                                    </p>
                                    <p className="text-xs text-orange-700">Descontos Dados</p>
                                </div>
                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
                                    <p className="text-lg font-bold text-purple-600">
                                        {selectedCampaign.metrics.ordersGenerated}
                                    </p>
                                    <p className="text-xs text-purple-700">Pedidos</p>
                                </div>
                            </div>
                        </div>

                        {/* Segmentation Info */}
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Público-Alvo</h4>
                            <div className="p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                {selectedCampaign.targetAudience.allCustomers ? (
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        <HiOutlineUsers className="w-4 h-4 inline mr-1" />
                                        Todos os clientes
                                    </p>
                                ) : (
                                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                        {selectedCampaign.targetAudience.customerCategories && (
                                            <p>
                                                Categorias: {selectedCampaign.targetAudience.customerCategories
                                                    .map(c => CUSTOMER_CATEGORY_LABELS[c as CustomerCategory])
                                                    .join(', ')}
                                            </p>
                                        )}
                                        {selectedCampaign.targetAudience.minTotalPurchases && (
                                            <p>Compras mínimas: {formatCurrency(selectedCampaign.targetAudience.minTotalPurchases)}</p>
                                        )}
                                        {selectedCampaign.targetAudience.cities && (
                                            <p>Cidades: {selectedCampaign.targetAudience.cities.join(', ')}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
