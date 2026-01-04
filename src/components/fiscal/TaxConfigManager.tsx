import { useState } from 'react';
import {
    HiOutlineCog,
    HiOutlinePlus,
    HiOutlinePencil,
    HiOutlineTrash,
    HiOutlineCheck,
    HiOutlineX,
    HiOutlineInformationCircle,
} from 'react-icons/hi';
import { useFiscalStore } from '../../stores/useFiscalStore';
import { Button, Card, Input, Modal, Select, Badge, Pagination, usePagination } from '../ui';
import { formatCurrency, generateId } from '../../utils/helpers';
import type { TaxConfig, IRPSBracket, TaxType, TaxApplicableTo } from '../../types/fiscal';
import toast from 'react-hot-toast';

export default function TaxConfigManager() {
    const {
        taxConfigs,
        irpsBrackets,
        addTaxConfig,
        updateTaxConfig,
        deleteTaxConfig,
        updateIRPSBracket,
    } = useFiscalStore();

    const [activeTab, setActiveTab] = useState<'taxes' | 'irt'>('taxes');
    const [showModal, setShowModal] = useState(false);
    const [editingConfig, setEditingConfig] = useState<TaxConfig | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        type: 'iva' as TaxType,
        name: '',
        description: '',
        rate: 0,
        isActive: true,
        applicableTo: ['invoices'] as TaxApplicableTo[],
    });

    // Pagination
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedConfigs,
        totalItems,
    } = usePagination(taxConfigs, 10);

    const handleOpenModal = (config?: TaxConfig) => {
        if (config) {
            setEditingConfig(config);
            setFormData({
                type: config.type,
                name: config.name,
                description: config.description,
                rate: config.rate,
                isActive: config.isActive,
                applicableTo: config.applicableTo,
            });
        } else {
            setEditingConfig(null);
            setFormData({
                type: 'iva',
                name: '',
                description: '',
                rate: 0,
                isActive: true,
                applicableTo: ['invoices'],
            });
        }
        setShowModal(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error('Nome do imposto é obrigatório');
            return;
        }

        const now = new Date().toISOString();

        if (editingConfig) {
            updateTaxConfig(editingConfig.id, {
                ...formData,
                updatedAt: now,
            });
            toast.success('Configuração atualizada com sucesso!');
        } else {
            const newConfig: TaxConfig = {
                id: generateId(),
                ...formData,
                effectiveFrom: now.split('T')[0],
                createdAt: now,
                updatedAt: now,
            };
            addTaxConfig(newConfig);
            toast.success('Configuração criada com sucesso!');
        }

        setShowModal(false);
    };

    const handleDelete = (id: string) => {
        deleteTaxConfig(id);
        toast.success('Configuração removida!');
        setShowDeleteConfirm(null);
    };

    const handleUpdateBracket = (id: string, field: keyof IRPSBracket, value: number | boolean) => {
        updateIRPSBracket(id, { [field]: value });
        toast.success('Escalão atualizado!');
    };

    const typeOptions = [
        { value: 'iva', label: 'IVA - Imposto sobre Valor Acrescentado' },
        { value: 'inss_employee', label: 'INSS - Contribuição Trabalhador' },
        { value: 'inss_employer', label: 'INSS - Contribuição Empregador' },
        { value: 'irt', label: 'IRPS - Imposto Rendimento Pessoas Singulares' },
        { value: 'withholding', label: 'Retenção na Fonte' },
    ];

    const applicableOptions = [
        { value: 'invoices', label: 'Faturas' },
        { value: 'salaries', label: 'Salários' },
        { value: 'suppliers', label: 'Fornecedores' },
        { value: 'all', label: 'Todos' },
    ];



    const getTypeBadge = (type: TaxType) => {
        const variants: Record<TaxType, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
            iva: 'primary',
            inss_employee: 'success',
            inss_employer: 'success',
            irt: 'warning',
            withholding: 'info',
        };
        return variants[type] || 'gray';
    };

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-dark-700">
                <button
                    onClick={() => setActiveTab('taxes')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'taxes'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    <HiOutlineCog className="w-4 h-4 inline mr-2" />
                    Configuração de Impostos
                </button>
                <button
                    onClick={() => setActiveTab('irt')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'irt'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                >
                    <HiOutlineInformationCircle className="w-4 h-4 inline mr-2" />
                    Tabela IRPS Progressivo
                </button>
            </div>

            {activeTab === 'taxes' ? (
                <>
                    {/* Header */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Impostos e Retenções
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Configure as taxas de IVA, INSS, IRPS e outras retenções
                            </p>
                        </div>
                        <Button onClick={() => handleOpenModal()} leftIcon={<HiOutlinePlus className="w-5 h-5" />}>
                            Novo Imposto
                        </Button>
                    </div>

                    {/* Tax Configs Table */}
                    <Card padding="none">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                                <thead className="bg-gray-50 dark:bg-dark-800">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Tipo
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Nome
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Taxa
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Aplicável a
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Estado
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Ações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-dark-900 divide-y divide-gray-200 dark:divide-dark-700">
                                    {paginatedConfigs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                Nenhuma configuração encontrada
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedConfigs.map((config) => (
                                            <tr key={config.id} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <Badge variant={getTypeBadge(config.type)}>
                                                        {config.type.toUpperCase().replace('_', ' ')}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-white">
                                                            {config.name}
                                                        </p>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            {config.description}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                                                        {config.rate}%
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                        {config.applicableTo.map((a) => (
                                                            <Badge key={a} variant="gray" size="sm">
                                                                {applicableOptions.find(o => o.value === a)?.label || a}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <Badge variant={config.isActive ? 'success' : 'danger'}>
                                                        {config.isActive ? 'Ativo' : 'Inativo'}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleOpenModal(config)}
                                                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                                            title="Editar"
                                                        >
                                                            <HiOutlinePencil className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setShowDeleteConfirm(config.id)}
                                                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <HiOutlineTrash className="w-5 h-5" />
                                                        </button>
                                                    </div>
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
                </>
            ) : (
                <>
                    {/* IRPS Brackets */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Tabela IRPS - Moçambique 2024
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Escalões progressivos do Imposto sobre Rendimento do Trabalho
                            </p>
                        </div>
                    </div>

                    <Card padding="none">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                                <thead className="bg-gray-50 dark:bg-dark-800">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Escalão
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Rendimento Mínimo
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Rendimento Máximo
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Taxa (%)
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Dedução Fixa
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Estado
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-dark-900 divide-y divide-gray-200 dark:divide-dark-700">
                                    {irpsBrackets.map((bracket: IRPSBracket, index: number) => (
                                        <tr key={bracket.id} className="hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-bold">
                                                    {index + 1}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-900 dark:text-white">
                                                {formatCurrency(bracket.minIncome)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-900 dark:text-white">
                                                {bracket.maxIncome ? formatCurrency(bracket.maxIncome) : 'Sem limite'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                                                    {bracket.rate}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-900 dark:text-white">
                                                {formatCurrency(bracket.fixedDeduction)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleUpdateBracket(bracket.id, 'isActive', !bracket.isActive)}
                                                    className={`p-2 rounded-lg transition-colors ${bracket.isActive
                                                        ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-gray-100 text-gray-400 dark:bg-dark-700'
                                                        }`}
                                                >
                                                    {bracket.isActive ? (
                                                        <HiOutlineCheck className="w-5 h-5" />
                                                    ) : (
                                                        <HiOutlineX className="w-5 h-5" />
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Formula Explanation */}
                    <Card padding="md" className="bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800">
                        <div className="flex items-start gap-3">
                            <HiOutlineInformationCircle className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                                    Fórmula de Cálculo do IRPS
                                </h4>
                                <p className="text-blue-700 dark:text-blue-400 text-sm mb-2">
                                    <strong>IRPS = (Salário Bruto × Taxa%) - Dedução Fixa</strong>
                                </p>
                                <p className="text-blue-600 dark:text-blue-500 text-sm">
                                    Exemplo: Para um salário de 50.000 MZN, aplica-se o escalão 3 (20%):<br />
                                    IRPS = (50.000 × 20%) - 3.267 = 10.000 - 3.267 = <strong>6.733 MZN</strong>
                                </p>
                            </div>
                        </div>
                    </Card>
                </>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingConfig ? 'Editar Imposto' : 'Novo Imposto'}
                size="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Select
                        label="Tipo de Imposto"
                        options={typeOptions}
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as TaxType })}
                    />

                    <Input
                        label="Nome"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="Ex: IVA - Imposto sobre Valor Acrescentado"
                    />

                    <Input
                        label="Descrição"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Descrição breve do imposto"
                    />

                    <Input
                        label="Taxa (%)"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.rate}
                        onChange={(e) => setFormData({ ...formData, rate: Number(e.target.value) })}
                        required
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Aplicável a
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {applicableOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        const current = formData.applicableTo;
                                        const newValue = current.includes(option.value as TaxApplicableTo)
                                            ? current.filter((v) => v !== option.value)
                                            : [...current, option.value as TaxApplicableTo];
                                        setFormData({ ...formData, applicableTo: newValue });
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${formData.applicableTo.includes(option.value as TaxApplicableTo)
                                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                                        : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                            Ativo
                        </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-dark-700">
                        <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit">
                            {editingConfig ? 'Guardar Alterações' : 'Criar Imposto'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(null)}
                title="Confirmar Eliminação"
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        Tem certeza que deseja eliminar esta configuração de imposto?
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">
                        Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={() => setShowDeleteConfirm(null)}>
                            Cancelar
                        </Button>
                        <Button variant="danger" onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}>
                            Eliminar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
