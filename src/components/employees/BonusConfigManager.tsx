import { useState, useEffect } from 'react';
import {
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlineCheckCircle,
    HiOutlineExclamationCircle,
    HiOutlineTicket,
    HiOutlineArrowTrendingUp,
    HiOutlineUserGroup,
    HiOutlineCheck,
} from 'react-icons/hi2';
import { Card, Button, Input, Select, Badge } from '../ui';
import { employeesAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import type { CommissionRule, CommissionType, Employee } from '../../types';

export default function BonusConfigManager() {
    const [rules, setRules] = useState<CommissionRule[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [newRule, setNewRule] = useState<Partial<CommissionRule>>({
        type: 'fixed',
        rate: 5,
        isActive: true,
        tiers: [{ min: 0, rate: 2 }, { min: 100000, rate: 5 }],
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [rulesData, employeesData] = await Promise.all([
                employeesAPI.getCommissionRules(),
                employeesAPI.getAll(),
            ]);

            setRules(rulesData || []);
            setEmployees(Array.isArray(employeesData) ? employeesData : (employeesData.data || []));
        } catch (error) {
            logger.error('Error fetching bonus configuration:', error);
            setRules([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddTier = () => {
        setNewRule((prev) => ({
            ...prev,
            tiers: [...(prev.tiers || []), { min: 0, rate: 0 }],
        }));
    };

    const handleRemoveTier = (index: number) => {
        setNewRule((prev) => ({
            ...prev,
            tiers: (prev.tiers || []).filter((_, i) => i !== index),
        }));
    };

    const handleTierChange = (index: number, field: 'min' | 'rate', value: number) => {
        setNewRule((prev) => {
            const tiers = [...(prev.tiers || [])];
            tiers[index] = { ...tiers[index], [field]: value };
            return { ...prev, tiers };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await employeesAPI.saveCommissionRule(newRule);
            toast.success('Regra de bonus salva com sucesso!');
            setShowForm(false);
            setNewRule({
                type: 'fixed',
                rate: 5,
                isActive: true,
                tiers: [{ min: 0, rate: 2 }, { min: 100000, rate: 5 }],
            });
            fetchData();
        } catch {
            toast.error('Erro ao salvar regra');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover esta regra?')) return;

        try {
            await employeesAPI.deleteCommissionRule(id);
            toast.success('Regra removida');
            fetchData();
        } catch {
            toast.error('Erro ao remover regra');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tighter">
                        <HiOutlineTicket className="text-primary-500" />
                        Regras de Bonus
                    </h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1">
                        Configuracao global de bonus e comissoes para colaboradores
                    </p>
                </div>
                {!showForm && (
                    <Button variant="primary" leftIcon={<HiOutlinePlus />} onClick={() => setShowForm(true)}>
                        Nova Regra
                    </Button>
                )}
            </div>

            {showForm && (
                <Card variant="glass" className="overflow-visible animate-slide-up border-primary-500/20">
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Select
                                label="Aplicar a"
                                value={newRule.employeeId || ''}
                                onChange={(event) => setNewRule((prev) => ({ ...prev, employeeId: event.target.value || undefined }))}
                                options={[
                                    { value: '', label: 'Toda a equipa' },
                                    ...employees.map((employee) => ({ value: employee.id, label: employee.name })),
                                ]}
                            />
                            <Select
                                label="Tipo de calculo"
                                value={newRule.type}
                                onChange={(event) => setNewRule((prev) => ({ ...prev, type: event.target.value as CommissionType }))}
                                options={[
                                    { value: 'fixed', label: 'Percentagem fixa' },
                                    { value: 'tiered', label: 'Por escaloes' },
                                    { value: 'profit_based', label: 'Baseado em lucro' },
                                ]}
                            />
                            {(newRule.type === 'fixed' || newRule.type === 'profit_based') && (
                                <Input
                                    label="Taxa (%)"
                                    type="number"
                                    value={newRule.rate}
                                    onChange={(event) => setNewRule((prev) => ({ ...prev, rate: parseFloat(event.target.value) }))}
                                    rightIcon={<span className="text-gray-400">%</span>}
                                />
                            )}
                        </div>

                        {newRule.type === 'tiered' && (
                            <div className="space-y-4 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg border border-gray-100 dark:border-dark-600">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <HiOutlineArrowTrendingUp className="text-primary-500" />
                                        Escaloes
                                    </h4>
                                    <Button variant="ghost" size="sm" onClick={handleAddTier}>
                                        <HiOutlinePlus className="mr-1" /> Adicionar
                                    </Button>
                                </div>
                                <div className="space-y-3">
                                    {(newRule.tiers || []).map((tier, index) => (
                                        <div key={index} className="flex gap-4 items-end animate-fade-in">
                                            <div className="flex-1">
                                                <Input
                                                    label={index === 0 ? 'Valor minimo' : ''}
                                                    type="number"
                                                    value={tier.min}
                                                    onChange={(event) => handleTierChange(index, 'min', parseFloat(event.target.value))}
                                                    leftIcon={<span className="text-gray-400 text-xs text-nowrap">MT</span>}
                                                />
                                            </div>
                                            <div className="w-32">
                                                <Input
                                                    label={index === 0 ? 'Taxa (%)' : ''}
                                                    type="number"
                                                    value={tier.rate}
                                                    onChange={(event) => handleTierChange(index, 'rate', parseFloat(event.target.value))}
                                                    rightIcon={<span className="text-gray-400">%</span>}
                                                />
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveTier(index)}
                                                className="p-2.5 mb-1 text-red-500 hover:bg-red-50 active:scale-95"
                                            >
                                                <HiOutlineTrash />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                            <Button variant="ghost" onClick={() => setShowForm(false)}>
                                Cancelar
                            </Button>
                            <Button variant="primary" leftIcon={<HiOutlineCheck />} onClick={handleSave} isLoading={isSaving}>
                                Salvar Regra
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 gap-4">
                {isLoading ? (
                    <div className="p-12 text-center bg-white/50 dark:bg-dark-800/50 backdrop-blur-xl rounded-2xl border border-dashed border-gray-200 dark:border-dark-700">
                        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 italic">A carregar configuracoes...</p>
                    </div>
                ) : rules.length === 0 ? (
                    <div className="text-center p-12 bg-white dark:bg-dark-700 rounded-lg border border-dashed border-gray-300 dark:border-dark-600">
                        <HiOutlineExclamationCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nenhuma regra ativa</h3>
                        <p className="text-gray-500 mb-6">Comece por criar uma regra global ou individual.</p>
                        <Button variant="outline" onClick={() => setShowForm(true)}>
                            Criar Primeira Regra
                        </Button>
                    </div>
                ) : (
                    rules.map((rule) => (
                        <Card key={rule.id} variant="glass" className="hover:shadow-md transition-shadow group">
                            <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600">
                                        {rule.type === 'tiered' ? <HiOutlineArrowTrendingUp /> : <HiOutlineTicket />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">
                                            {rule.employee?.name || employees.find((employee) => employee.id === rule.employeeId)?.name || 'Regra global da equipa'}
                                        </h4>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <Badge variant={rule.type === 'tiered' ? 'warning' : rule.type === 'profit_based' ? 'success' : 'info'}>
                                                {rule.type === 'tiered' ? 'Escalonado' : rule.type === 'profit_based' ? 'Lucro' : 'Fixo'}
                                            </Badge>
                                            <span className="text-sm text-gray-500">
                                                {rule.type === 'fixed' || rule.type === 'profit_based'
                                                    ? `${rule.rate || 0}%`
                                                    : `${(rule.tiers || []).length} escaloes definidos`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="sm" onClick={() => { setNewRule(rule); setShowForm(true); }}>
                                        Editar
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(rule.id)}>
                                        Remover
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            <Card variant="glass" className="bg-gradient-to-br from-primary-600 to-primary-800 text-white border-none overflow-hidden relative shadow-2xl shadow-primary-500/20">
                <div className="p-6 relative z-10">
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <HiOutlineCheckCircle className="text-primary-200" />
                                Sincronizacao com payroll
                            </h3>
                            <p className="text-primary-100 text-sm max-w-md">
                                As regras globais e individuais alimentam o processamento salarial mensal no modulo de RH.
                            </p>
                        </div>
                        <HiOutlineUserGroup className="w-24 h-24 text-white/10 absolute -right-4 -bottom-4" />
                    </div>
                </div>
            </Card>
        </div>
    );
}
