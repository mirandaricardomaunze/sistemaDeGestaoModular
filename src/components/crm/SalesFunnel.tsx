/**
 * Sales Funnel Component
 * Visualização do funil de vendas com drag and drop
 */

import { useState, useMemo } from 'react';
import {
    HiOutlinePlus,
    HiOutlineUser,
    HiOutlineEye,
    HiOutlineChartBar,
    HiOutlineClock,
    HiOutlineCheck,
    HiOutlineX,
} from 'react-icons/hi';
import { useCRMStore } from '../../stores/useCRMStore';
import { Button, Card, Modal, Input, Select, Badge, Textarea } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import {
    INTERACTION_TYPE_LABELS,
    SOURCE_LABELS,
    type FunnelOpportunity,
    type FunnelStage,
    type FunnelInteraction,
} from '../../types/crm';
import toast from 'react-hot-toast';

export default function SalesFunnel() {
    const {
        stages,
        opportunities,
        addOpportunity,
        moveOpportunityToStage,
        closeOpportunity,
        addInteraction,
        getFunnelMetrics,
    } = useCRMStore();

    // State
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showMetricsModal, setShowMetricsModal] = useState(false);
    const [showInteractionModal, setShowInteractionModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [selectedOpportunity, setSelectedOpportunity] = useState<FunnelOpportunity | null>(null);
    const [draggedOpportunity, setDraggedOpportunity] = useState<string | null>(null);

    // Form state
    const [newOpportunity, setNewOpportunity] = useState({
        customerId: '',
        customerName: '',
        title: '',
        value: 0,
        probability: 50,
        source: 'direct' as FunnelOpportunity['source'],
        notes: '',
    });

    const [newInteraction, setNewInteraction] = useState({
        type: 'call' as FunnelInteraction['type'],
        title: '',
        description: '',
        outcome: 'neutral' as FunnelInteraction['outcome'],
        nextAction: '',
        nextActionDate: '',
    });

    const [closeData, setCloseData] = useState({
        won: true,
        reason: '',
    });

    // Active stages (non-closed)
    const activeStages = useMemo(() =>
        stages.filter(s => !s.isClosedStage).sort((a, b) => a.order - b.order),
        [stages]
    );

    // Closed stages
    const closedStages = useMemo(() =>
        stages.filter(s => s.isClosedStage).sort((a, b) => a.order - b.order),
        [stages]
    );

    // Metrics
    const metrics = useMemo(() => getFunnelMetrics(), [opportunities, stages, getFunnelMetrics]);

    // Drag and Drop handlers
    const handleDragStart = (opportunityId: string) => {
        setDraggedOpportunity(opportunityId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (stageId: string) => {
        if (draggedOpportunity) {
            const opp = opportunities.find(o => o.id === draggedOpportunity);
            if (opp && opp.stageId !== stageId) {
                moveOpportunityToStage(draggedOpportunity, stageId);
                toast.success('Oportunidade movida!');
            }
            setDraggedOpportunity(null);
        }
    };

    // Handlers
    const handleAddOpportunity = () => {
        if (!newOpportunity.customerName || !newOpportunity.title) {
            toast.error('Preencha os campos obrigatórios');
            return;
        }

        const firstStage = activeStages[0];
        if (!firstStage) {
            toast.error('Nenhuma etapa disponível');
            return;
        }

        addOpportunity({
            ...newOpportunity,
            stageId: firstStage.id,
            stageType: firstStage.type,
            tags: [],
        });

        setNewOpportunity({
            customerId: '',
            customerName: '',
            title: '',
            value: 0,
            probability: 50,
            source: 'direct',
            notes: '',
        });
        setShowAddModal(false);
        toast.success('Oportunidade criada!');
    };

    const handleViewDetails = (opp: FunnelOpportunity) => {
        setSelectedOpportunity(opp);
        setShowDetailsModal(true);
    };

    const handleAddInteraction = () => {
        if (!selectedOpportunity || !newInteraction.title) {
            toast.error('Preencha o título da interação');
            return;
        }

        addInteraction(selectedOpportunity.id, {
            ...newInteraction,
            date: new Date().toISOString(),
            createdBy: 'Sistema',
        });

        setNewInteraction({
            type: 'call',
            title: '',
            description: '',
            outcome: 'neutral',
            nextAction: '',
            nextActionDate: '',
        });
        setShowInteractionModal(false);
        toast.success('Interação registada!');
    };

    const handleCloseOpportunity = () => {
        if (!selectedOpportunity) return;

        closeOpportunity(
            selectedOpportunity.id,
            closeData.won,
            closeData.reason
        );

        setShowCloseModal(false);
        setShowDetailsModal(false);
        toast.success(`Oportunidade ${closeData.won ? 'ganha' : 'perdida'}!`);
    };

    // Get stage color
    const getStageColor = (stage: FunnelStage) => {
        return stage.color || '#6B7280';
    };

    // Get opportunities for stage
    const getStageOpportunities = (stageId: string) => {
        return opportunities.filter(o => o.stageId === stageId);
    };

    // Calculate stage value
    const getStageValue = (stageId: string) => {
        return getStageOpportunities(stageId).reduce((sum, o) => sum + o.value, 0);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Funil de Vendas
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {opportunities.length} oportunidades • {formatCurrency(metrics.totalValue)} em pipeline
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setShowMetricsModal(true)}
                        leftIcon={<HiOutlineChartBar className="w-4 h-4" />}
                    >
                        Métricas
                    </Button>
                    <Button
                        onClick={() => setShowAddModal(true)}
                        leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                    >
                        Nova Oportunidade
                    </Button>
                </div>
            </div>

            {/* Funnel Board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
                {activeStages.map((stage) => {
                    const stageOpps = getStageOpportunities(stage.id);
                    const stageValue = getStageValue(stage.id);

                    return (
                        <div
                            key={stage.id}
                            className="flex-shrink-0 w-72"
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(stage.id)}
                        >
                            {/* Stage Header */}
                            <div
                                className="p-3 rounded-t-lg"
                                style={{ backgroundColor: getStageColor(stage) + '20' }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: getStageColor(stage) }}
                                        />
                                        <h3 className="font-semibold text-gray-900 dark:text-white">
                                            {stage.name}
                                        </h3>
                                        <Badge variant="gray" size="sm">{stageOpps.length}</Badge>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {formatCurrency(stageValue)}
                                </p>
                            </div>

                            {/* Stage Cards */}
                            <div className="bg-gray-100 dark:bg-dark-800 rounded-b-lg min-h-[400px] p-2 space-y-2">
                                {stageOpps.map((opp) => (
                                    <div
                                        key={opp.id}
                                        draggable
                                        onDragStart={() => handleDragStart(opp.id)}
                                        className={`bg-white dark:bg-dark-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${draggedOpportunity === opp.id ? 'opacity-50' : ''
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
                                                {opp.title}
                                            </h4>
                                            <button
                                                onClick={() => handleViewDetails(opp)}
                                                className="p-1 text-gray-400 hover:text-primary-500"
                                            >
                                                <HiOutlineEye className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs mb-2">
                                            <HiOutlineUser className="w-3 h-3" />
                                            <span className="truncate">{opp.customerName}</span>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-primary-600 dark:text-primary-400 font-semibold text-sm">
                                                {formatCurrency(opp.value)}
                                            </span>
                                            <Badge variant="gray" size="sm">
                                                {opp.probability}%
                                            </Badge>
                                        </div>

                                        {opp.interactions.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-dark-600 flex items-center gap-1 text-gray-400 text-xs">
                                                <HiOutlineClock className="w-3 h-3" />
                                                <span>{opp.interactions.length} interações</span>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {stageOpps.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                                        <HiOutlinePlus className="w-8 h-8 mb-2" />
                                        <p className="text-sm">Arraste aqui</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Closed Stages Summary */}
                <div className="flex-shrink-0 w-72 space-y-4">
                    {closedStages.map((stage) => {
                        const stageOpps = getStageOpportunities(stage.id);
                        return (
                            <div
                                key={stage.id}
                                className="p-4 rounded-lg"
                                style={{ backgroundColor: getStageColor(stage) + '15' }}
                                onDragOver={handleDragOver}
                                onDrop={() => handleDrop(stage.id)}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    {stage.isWonStage ? (
                                        <HiOutlineCheck className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <HiOutlineX className="w-5 h-5 text-red-500" />
                                    )}
                                    <h3 className="font-semibold text-gray-900 dark:text-white">
                                        {stage.name}
                                    </h3>
                                    <Badge
                                        variant={stage.isWonStage ? 'success' : 'danger'}
                                        size="sm"
                                    >
                                        {stageOpps.length}
                                    </Badge>
                                </div>
                                <p className="text-sm" style={{ color: getStageColor(stage) }}>
                                    {formatCurrency(getStageValue(stage.id))}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card padding="md" className="text-center">
                    <p className="text-2xl font-bold text-primary-600">{metrics.totalOpportunities}</p>
                    <p className="text-sm text-gray-500">Oportunidades</p>
                </Card>
                <Card padding="md" className="text-center">
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.weightedValue)}</p>
                    <p className="text-sm text-gray-500">Valor Ponderado</p>
                </Card>
                <Card padding="md" className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{metrics.winRate}%</p>
                    <p className="text-sm text-gray-500">Taxa de Conversão</p>
                </Card>
                <Card padding="md" className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{metrics.avgTimeToClose} dias</p>
                    <p className="text-sm text-gray-500">Tempo Médio</p>
                </Card>
            </div>

            {/* Add Opportunity Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="Nova Oportunidade"
                size="md"
            >
                <div className="space-y-4">
                    <Input
                        label="Nome do Cliente *"
                        value={newOpportunity.customerName}
                        onChange={(e) => setNewOpportunity({ ...newOpportunity, customerName: e.target.value })}
                        placeholder="Ex: Empresa XYZ"
                    />
                    <Input
                        label="Título da Oportunidade *"
                        value={newOpportunity.title}
                        onChange={(e) => setNewOpportunity({ ...newOpportunity, title: e.target.value })}
                        placeholder="Ex: Contrato de Fornecimento"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Valor Estimado"
                            type="number"
                            value={newOpportunity.value}
                            onChange={(e) => setNewOpportunity({ ...newOpportunity, value: Number(e.target.value) })}
                        />
                        <Input
                            label="Probabilidade (%)"
                            type="number"
                            min={0}
                            max={100}
                            value={newOpportunity.probability}
                            onChange={(e) => setNewOpportunity({ ...newOpportunity, probability: Number(e.target.value) })}
                        />
                    </div>
                    <Select
                        label="Origem"
                        value={newOpportunity.source || 'direct'}
                        onChange={(e) => setNewOpportunity({ ...newOpportunity, source: e.target.value as any })}
                        options={Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))}
                    />
                    <Textarea
                        label="Notas"
                        value={newOpportunity.notes}
                        onChange={(e) => setNewOpportunity({ ...newOpportunity, notes: e.target.value })}
                        rows={3}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancelar</Button>
                        <Button onClick={handleAddOpportunity}>Criar Oportunidade</Button>
                    </div>
                </div>
            </Modal>

            {/* Details Modal */}
            <Modal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                title={selectedOpportunity?.title || 'Detalhes'}
                size="lg"
            >
                {selectedOpportunity && (
                    <div className="space-y-6">
                        {/* Header Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-500">Cliente</p>
                                <p className="font-medium">{selectedOpportunity.customerName}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Valor</p>
                                <p className="font-medium text-primary-600">{formatCurrency(selectedOpportunity.value)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Etapa Atual</p>
                                <Badge variant="primary">
                                    {stages.find(s => s.id === selectedOpportunity.stageId)?.name}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Probabilidade</p>
                                <p className="font-medium">{selectedOpportunity.probability}%</p>
                            </div>
                        </div>

                        {/* Notes */}
                        {selectedOpportunity.notes && (
                            <div className="p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                <p className="text-sm text-gray-600 dark:text-gray-300">{selectedOpportunity.notes}</p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowDetailsModal(false);
                                    setShowInteractionModal(true);
                                }}
                                leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                            >
                                Adicionar Interação
                            </Button>
                            <Button
                                variant="success"
                                size="sm"
                                onClick={() => {
                                    setCloseData({ won: true, reason: '' });
                                    setShowCloseModal(true);
                                }}
                            >
                                Marcar como Ganho
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                    setCloseData({ won: false, reason: '' });
                                    setShowCloseModal(true);
                                }}
                            >
                                Marcar como Perdido
                            </Button>
                        </div>

                        {/* Interactions */}
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                                Histórico de Interações ({selectedOpportunity.interactions.length})
                            </h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {selectedOpportunity.interactions.length === 0 ? (
                                    <p className="text-gray-500 text-sm text-center py-4">
                                        Nenhuma interação registada
                                    </p>
                                ) : (
                                    selectedOpportunity.interactions.map((int) => (
                                        <div key={int.id} className="p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="gray" size="sm">
                                                    {INTERACTION_TYPE_LABELS[int.type]}
                                                </Badge>
                                                <span className="text-sm font-medium">{int.title}</span>
                                            </div>
                                            {int.description && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400">{int.description}</p>
                                            )}
                                            <p className="text-xs text-gray-400 mt-1">
                                                {new Date(int.date).toLocaleDateString('pt-MZ')}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Stage History */}
                        {selectedOpportunity.stageHistory.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                                    Histórico de Etapas
                                </h4>
                                <div className="space-y-2">
                                    {selectedOpportunity.stageHistory.map((entry) => (
                                        <div key={entry.id} className="flex items-center gap-2 text-sm">
                                            <span className="text-gray-500">{entry.fromStageName}</span>
                                            <span>→</span>
                                            <span className="font-medium">{entry.toStageName}</span>
                                            <span className="text-gray-400 text-xs">
                                                ({entry.timeInPreviousStage} dias)
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Add Interaction Modal */}
            <Modal
                isOpen={showInteractionModal}
                onClose={() => setShowInteractionModal(false)}
                title="Nova Interação"
                size="md"
            >
                <div className="space-y-4">
                    <Select
                        label="Tipo"
                        value={newInteraction.type}
                        onChange={(e) => setNewInteraction({ ...newInteraction, type: e.target.value as any })}
                        options={Object.entries(INTERACTION_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                    />
                    <Input
                        label="Título *"
                        value={newInteraction.title}
                        onChange={(e) => setNewInteraction({ ...newInteraction, title: e.target.value })}
                        placeholder="Ex: Chamada de apresentação"
                    />
                    <Textarea
                        label="Descrição"
                        value={newInteraction.description}
                        onChange={(e) => setNewInteraction({ ...newInteraction, description: e.target.value })}
                        rows={3}
                    />
                    <Select
                        label="Resultado"
                        value={newInteraction.outcome || 'neutral'}
                        onChange={(e) => setNewInteraction({ ...newInteraction, outcome: e.target.value as any })}
                        options={[
                            { value: 'positive', label: 'Positivo' },
                            { value: 'neutral', label: 'Neutro' },
                            { value: 'negative', label: 'Negativo' },
                        ]}
                    />
                    <Input
                        label="Próxima Ação"
                        value={newInteraction.nextAction}
                        onChange={(e) => setNewInteraction({ ...newInteraction, nextAction: e.target.value })}
                        placeholder="Ex: Enviar proposta"
                    />
                    <Input
                        label="Data da Próxima Ação"
                        type="date"
                        value={newInteraction.nextActionDate}
                        onChange={(e) => setNewInteraction({ ...newInteraction, nextActionDate: e.target.value })}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={() => setShowInteractionModal(false)}>Cancelar</Button>
                        <Button onClick={handleAddInteraction}>Registar Interação</Button>
                    </div>
                </div>
            </Modal>

            {/* Close Opportunity Modal */}
            <Modal
                isOpen={showCloseModal}
                onClose={() => setShowCloseModal(false)}
                title={closeData.won ? 'Marcar como Ganho' : 'Marcar como Perdido'}
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-300">
                        {closeData.won
                            ? 'Parabéns! Esta oportunidade foi convertida com sucesso.'
                            : 'Indique o motivo pelo qual esta oportunidade foi perdida.'
                        }
                    </p>
                    <Textarea
                        label={closeData.won ? 'Observações (opcional)' : 'Motivo da Perda *'}
                        value={closeData.reason}
                        onChange={(e) => setCloseData({ ...closeData, reason: e.target.value })}
                        rows={3}
                        placeholder={closeData.won ? 'Detalhes adicionais...' : 'Ex: Preço, concorrência, timing...'}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={() => setShowCloseModal(false)}>Cancelar</Button>
                        <Button
                            variant={closeData.won ? 'success' : 'danger'}
                            onClick={handleCloseOpportunity}
                        >
                            Confirmar
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Metrics Modal */}
            <Modal
                isOpen={showMetricsModal}
                onClose={() => setShowMetricsModal(false)}
                title="Métricas do Funil"
                size="lg"
            >
                <div className="space-y-6">
                    {/* Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-center">
                            <p className="text-2xl font-bold text-primary-600">{metrics.totalOpportunities}</p>
                            <p className="text-sm text-primary-700">Total</p>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.totalValue)}</p>
                            <p className="text-sm text-green-700">Pipeline</p>
                        </div>
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                            <p className="text-2xl font-bold text-blue-600">{metrics.winRate}%</p>
                            <p className="text-sm text-blue-700">Conversão</p>
                        </div>
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
                            <p className="text-2xl font-bold text-orange-600">{metrics.avgTimeToClose}d</p>
                            <p className="text-sm text-orange-700">Tempo Médio</p>
                        </div>
                    </div>

                    {/* By Stage */}
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Por Etapa</h4>
                        <div className="space-y-2">
                            {metrics.byStage.map((stage) => (
                                <div key={stage.stageId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                    <span className="font-medium">{stage.stageName}</span>
                                    <div className="flex items-center gap-4 text-sm">
                                        <span>{stage.count} ops</span>
                                        <span className="font-semibold text-primary-600">{formatCurrency(stage.value)}</span>
                                        <span className="text-gray-500">{stage.avgTimeInStage}d média</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Loss Reasons */}
                    {metrics.lossReasons.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Motivos de Perda</h4>
                            <div className="space-y-2">
                                {metrics.lossReasons.map((reason, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                        <span className="text-sm">{reason.reason}</span>
                                        <Badge variant="danger">{reason.count}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
