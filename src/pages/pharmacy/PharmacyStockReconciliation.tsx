import { useState, useEffect } from 'react';
import { Card, Button, Input, PageHeader } from '../../components/ui';
import { pharmacyAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
    HiOutlineClipboardDocumentCheck as HiOutlineClipboardCheck, HiOutlineArrowPath as HiOutlineRefresh, HiOutlineExclamationCircle,
    HiOutlineCheckCircle, HiOutlineArrowUp, HiOutlineArrowDown, HiOutlineArrowsRightLeft, HiOutlineMagnifyingGlass
} from 'react-icons/hi2';

interface SnapshotItem {
    medicationId: string;
    name: string;
    code: string;
    systemStock: number;
    physicalCount: string; // string for input binding
}

export default function PharmacyStockReconciliation() {
    const [snapshot, setSnapshot] = useState<SnapshotItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notes, setNotes] = useState('');
    const [result, setResult] = useState<any>(null);
    const [search, setSearch] = useState('');

    const loadSnapshot = async () => {
        setIsLoading(true);
        try {
            const data = await pharmacyAPI.getStockReconciliationSnapshot();
            setSnapshot((data as any[]).map(item => ({
                ...item,
                physicalCount: String(item.systemStock), // default to system stock
            })));
            setResult(null);
        } catch {
            toast.error('Erro ao carregar snapshot de stock.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSnapshot();
    }, []);

    const updateCount = (medicationId: string, value: string) => {
        setSnapshot(prev => prev.map(item =>
            item.medicationId === medicationId ? { ...item, physicalCount: value } : item
        ));
    };

    const variances = snapshot.filter(item => {
        const physical = parseInt(item.physicalCount) || 0;
        return physical !== item.systemStock;
    });

    const handleSubmit = async () => {
        if (variances.length === 0) {
            toast('Nenhuma variação detectada - contagem igual ao sistema.', { icon: 'â„¹️' });
            return;
        }
        const confirmed = window.confirm(
            `Vai ajustar ${variances.length} produto(s) com variaces. Esta acção é irreversível. Continuar?`
        );
        if (!confirmed) return;
        setIsSubmitting(true);
        try {
            const counts = snapshot.map(item => ({
                medicationId: item.medicationId,
                physicalCount: parseInt(item.physicalCount) || 0,
                systemStock: item.systemStock,
            }));
            const res = await pharmacyAPI.submitStockReconciliation({ counts, notes: notes || undefined });
            setResult(res);
            toast.success(`Reconciliação concluída: ${res.adjustedCount} produto(s) ajustado(s).`);
            loadSnapshot();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Erro ao submeter reconciliação.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filtered = snapshot.filter(item =>
        !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-5">
            {/* Header */}
            <PageHeader 
                title="Reconciliação de Stock"
                subtitle="Compare a contagem física com o sistema e ajuste as diferenças"
                icon={<HiOutlineArrowsRightLeft />}
                actions={
                    <Button
                        variant="outline"
                        leftIcon={<HiOutlineRefresh className="w-4 h-4" />}
                        onClick={loadSnapshot}
                        disabled={isLoading}
                    >
                        Actualizar
                    </Button>
                }
            />

            {/* Summary stats */}
            {snapshot.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <Card className="p-4 text-center">
                        <p className="text-2xl font-black text-gray-900 dark:text-white">{snapshot.length}</p>
                        <p className="text-sm text-gray-500">Total Medicamentos</p>
                    </Card>
                    <Card className="p-4 text-center border-amber-200 dark:border-amber-800">
                        <p className="text-2xl font-black text-amber-600">{variances.length}</p>
                        <p className="text-sm text-gray-500">Com Variação</p>
                    </Card>
                    <Card className="p-4 text-center border-green-200 dark:border-green-800">
                        <p className="text-2xl font-black text-green-600">{snapshot.length - variances.length}</p>
                        <p className="text-sm text-gray-500">Sem Variação</p>
                    </Card>
                </div>
            )}

            {/* Result banner */}
            {result && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                    <HiOutlineCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-green-700 dark:text-green-400">Reconciliação concluída</p>
                        <p className="text-sm text-green-600">{result.adjustedCount} produto(s) foram ajustados no sistema.</p>
                    </div>
                </div>
            )}

            {/* Variances preview */}
            {variances.length > 0 && (
                <Card className="p-4 border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                        <HiOutlineExclamationCircle className="w-4 h-4" />
                        {variances.length} produto(s) com variação detectada
                    </p>
                    <div className="space-y-1">
                        {variances.map(item => {
                            const physical = parseInt(item.physicalCount) || 0;
                            const diff = physical - item.systemStock;
                            return (
                                <div key={item.medicationId} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{item.name}</span>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                        <span className="text-gray-500">Sis: {item.systemStock}</span>
                                        <span className="text-gray-500">→</span>
                                        <span className="font-medium">Físico: {physical}</span>
                                        <span className={`flex items-center gap-0.5 font-bold text-xs ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {diff > 0 ? <HiOutlineArrowUp className="w-3 h-3" /> : <HiOutlineArrowDown className="w-3 h-3" />}
                                            {diff > 0 ? '+' : ''}{diff}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Search + count table */}
            <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b dark:border-dark-700 flex items-center gap-3">
                    <Input
                        placeholder="Pesquisar medicamento..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        leftIcon={<HiOutlineMagnifyingGlass className="w-4 h-4 text-gray-400" />}
                        className="flex-1 bg-white dark:bg-dark-800"
                    />
                    <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} itens</span>
                </div>

                {isLoading ? (
                    <div className="py-12 text-center text-gray-400 text-sm">A carregar...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-dark-700 text-left">
                                    <th className="px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300">Medicamento</th>
                                    <th className="px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300 text-right">Sistema</th>
                                    <th className="px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300 text-right w-36">Contagem Física</th>
                                    <th className="px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300 text-right">Variação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                {filtered.map(item => {
                                    const physical = parseInt(item.physicalCount) || 0;
                                    const diff = physical - item.systemStock;
                                    const hasDiff = diff !== 0;
                                    return (
                                        <tr key={item.medicationId} className={`hover:bg-gray-50 dark:hover:bg-dark-700/50 ${hasDiff ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                                            <td className="px-4 py-2.5">
                                                <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                                                <p className="text-xs text-gray-400">{item.code}</p>
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium">{item.systemStock}</td>
                                            <td className="px-4 py-2.5 text-right">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={item.physicalCount}
                                                    onChange={e => updateCount(item.medicationId, e.target.value)}
                                                    className={`w-24 px-2 py-1 text-right text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-800 dark:text-white ${hasDiff
                                                        ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20'
                                                        : 'border-gray-300 dark:border-dark-600'
                                                        }`}
                                                />
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                {hasDiff ? (
                                                    <span className={`flex items-center justify-end gap-1 font-bold text-xs ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {diff > 0 ? <HiOutlineArrowUp className="w-3 h-3" /> : <HiOutlineArrowDown className="w-3 h-3" />}
                                                        {diff > 0 ? '+' : ''}{diff}
                                                    </span>
                                                ) : (
                                                    <HiOutlineCheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                                            Nenhum medicamento encontrado
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Notes + Submit */}
            {snapshot.length > 0 && (
                <Card className="p-4 space-y-3">
                    <Input
                        label="Notas da reconciliação (opcional)"
                        placeholder="Ex: Contagem mensal de Abril, supervisado por..."
                        value={notes}
                        onChange={(e: any) => setNotes(e.target.value)}
                    />
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || variances.length === 0}
                        leftIcon={<HiOutlineClipboardCheck className="w-4 h-4" />}
                        size="lg"
                        className="w-full"
                    >
                        {isSubmitting
                            ? 'A submeter...'
                            : variances.length === 0
                                ? 'Nenhuma variação para ajustar'
                                : `Confirmar Reconciliação (${variances.length} ajuste${variances.length !== 1 ? 's' : ''})`
                        }
                    </Button>
                </Card>
            )}
        </div>
    );
}
