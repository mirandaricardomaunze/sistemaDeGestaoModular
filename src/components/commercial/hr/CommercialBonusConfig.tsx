import { useState, useEffect } from 'react';
import { 
    HiOutlinePlus, 
    HiOutlineTrash, 
    HiOutlineCheckCircle, 
    HiOutlineExclamationCircle,
    HiOutlineTicket,
    HiOutlineArrowTrendingUp,
    HiOutlineUserGroup,
    HiOutlineCheck
} from 'react-icons/hi2';
import { Card, Button, Input, Select, Badge } from '../../ui';
import { employeesAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import { logger } from '../../../utils/logger';
import type { CommissionRule, CommissionType, Employee } from '../../../types';

export function CommercialBonusConfig() {
    const [rules, setRules] = useState<CommissionRule[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [newRule, setNewRule] = useState<Partial<CommissionRule>>({
        type: 'fixed',
        rate: 5,
        isActive: true,
        tiers: [{ min: 0, rate: 2 }, { min: 100000, rate: 5 }]
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [rulesData, employeesData] = await Promise.all([
                employeesAPI.getCommissionRules(),
                employeesAPI.getAll({ department: 'vendas' })
            ]);
            setRules(rulesData || []);
            setEmployees(Array.isArray(employeesData) ? employeesData : (employeesData.data || []));
        } catch (error) {
            logger.error('Error fetching commission data:', error);
            // Fallback for demo if API fails
            setRules([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddTier = () => {
        setNewRule(prev => ({
            ...prev,
            tiers: [...(prev.tiers || []), { min: 0, rate: 0 }]
        }));
    };

    const handleRemoveTier = (index: number) => {
        setNewRule(prev => ({
            ...prev,
            tiers: (prev.tiers || []).filter((_, i) => i !== index)
        }));
    };

    const handleTierChange = (index: number, field: 'min' | 'rate', value: number) => {
        setNewRule(prev => {
            const newTiers = [...(prev.tiers || [])];
            newTiers[index] = { ...newTiers[index], [field]: value };
            return { ...prev, tiers: newTiers };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await employeesAPI.saveCommissionRule(newRule);
            toast.success('Regra de comissão salva com sucesso!');
            setShowForm(false);
            fetchData();
        } catch (error) {
            toast.error('Erro ao salvar regra');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem a certeza que deseja remover esta regra?')) return;
        try {
            await employeesAPI.deleteCommissionRule(id);
            toast.success('Regra removida');
            fetchData();
        } catch (error) {
            toast.error('Erro ao remover regra');
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineTicket className="text-primary-500" />
                        Configurador de Bónus Dinâmicos
                    </h2>
                    <p className="text-gray-500">Defina regras de comissão automatizadas para a equipa comercial</p>
                </div>
                {!showForm && (
                    <Button 
                        variant="primary" 
                        leftIcon={<HiOutlinePlus />}
                        onClick={() => setShowForm(true)}
                    >
                        Nova Regra
                    </Button>
                )}
            </div>

            {showForm && (
                <Card className="border-primary-100 dark:border-primary-900/30 overflow-visible animate-slide-up">
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Select
                                label="Aplicar a"
                                value={newRule.employeeId || ''}
                                onChange={(e) => setNewRule(prev => ({ ...prev, employeeId: e.target.value }))}
                                options={[
                                    { value: '', label: 'Toda a Equipa (Global)' },
                                    ...employees.map(e => ({ value: e.id, label: e.name }))
                                ]}
                            />
                            <Select
                                label="Tipo de Cálculo"
                                value={newRule.type}
                                onChange={(e) => setNewRule(prev => ({ ...prev, type: e.target.value as CommissionType }))}
                                options={[
                                    { value: 'fixed', label: 'Percentagem Fixa' },
                                    { value: 'tiered', label: 'Escalonado (Tiers)' },
                                    { value: 'profit_based', label: 'Baseado em Lucro' },
                                ]}
                            />
                            {newRule.type === 'fixed' && (
                                <Input
                                    label="Taxa Fixa (%)"
                                    type="number"
                                    value={newRule.rate}
                                    onChange={(e) => setNewRule(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                                    rightIcon={<span className="text-gray-400">%</span>}
                                />
                            )}
                        </div>

                        {newRule.type === 'tiered' && (
                            <div className="space-y-4 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg border border-gray-100 dark:border-dark-600">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <HiOutlineArrowTrendingUp className="text-primary-500" />
                                        Escalões de Vendas (Tiers)
                                    </h4>
                                    <Button variant="ghost" size="sm" onClick={handleAddTier}>
                                        <HiOutlinePlus className="mr-1" /> Add Tier
                                    </Button>
                                </div>
                                <div className="space-y-3">
                                    {(newRule.tiers as any[] || []).map((tier, idx) => (
                                        <div key={idx} className="flex gap-4 items-end animate-fade-in">
                                            <div className="flex-1">
                                                <Input
                                                    label={idx === 0 ? "Vendas a partir de" : ""}
                                                    type="number"
                                                    value={tier.min}
                                                    onChange={(e) => handleTierChange(idx, 'min', parseFloat(e.target.value))}
                                                    leftIcon={<span className="text-gray-400 text-xs text-nowrap">MT</span>}
                                                />
                                            </div>
                                            <div className="w-32">
                                                <Input
                                                    label={idx === 0 ? "Taxa (%)" : ""}
                                                    type="number"
                                                    value={tier.rate}
                                                    onChange={(e) => handleTierChange(idx, 'rate', parseFloat(e.target.value))}
                                                    rightIcon={<span className="text-gray-400">%</span>}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => handleRemoveTier(idx)}
                                                className="p-2.5 mb-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <HiOutlineTrash />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                            <Button variant="primary" leftIcon={<HiOutlineCheck />} onClick={handleSave} isLoading={isSaving}>
                                Salvar Regra
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 gap-4">
                {isLoading ? (
                   <div className="p-12 text-center bg-gray-50 dark:bg-dark-800 rounded-lg border border-dashed border-gray-200 dark:border-dark-700">
                       <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                       <p className="text-gray-500">A carregar configurações...</p>
                   </div>
                ) : rules.length === 0 ? (
                    <div className="text-center p-12 bg-white dark:bg-dark-700 rounded-lg border border-dashed border-gray-300 dark:border-dark-600">
                        <HiOutlineExclamationCircle className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nenhuma regra ativa</h3>
                        <p className="text-gray-500 mb-6">Comece por criar uma regra de comissão global ou individual.</p>
                        <Button variant="outline" onClick={() => setShowForm(true)}>Criar Primeira Regra</Button>
                    </div>
                ) : (
                    rules.map(rule => (
                        <Card key={rule.id} className="hover:shadow-md transition-shadow group">
                            <div className="p-4 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600">
                                        {rule.type === 'tiered' ? <HiOutlineArrowTrendingUp /> : <HiOutlineTicket />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 dark:text-white">
                                            {rule.employee?.name || 'Regra Global da Equipa'}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant={rule.type === 'tiered' ? 'warning' : 'info'}>
                                                {rule.type === 'tiered' ? 'Escalonado' : 'Fixo'}
                                            </Badge>
                                            <span className="text-sm text-gray-500">
                                                {rule.type === 'fixed' ? `${rule.rate}% de comissão` : `${(rule.tiers as any[]).length} escalões definidos`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

            <Card className="bg-gradient-to-br from-primary-600 to-primary-800 text-white border-none overflow-hidden relative">
                <div className="p-6 relative z-10">
                    <div className="flex items-start justify-between">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <HiOutlineCheckCircle className="text-primary-200" />
                                Monitor de Sincronização
                            </h3>
                            <p className="text-primary-100 text-sm max-w-md">
                                Os bónus calculados com base nestas regras são injetados automaticamente no processamento salarial mensal (Payroll) de cada colaborador.
                            </p>
                        </div>
                        <HiOutlineUserGroup className="w-24 h-24 text-white/10 absolute -right-4 -bottom-4" />
                    </div>
                </div>
            </Card>
        </div>
    );
}
