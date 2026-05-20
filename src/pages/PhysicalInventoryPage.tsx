import { useEffect, useMemo, useState } from 'react';
import {
    HiOutlineArrowPath,
    HiOutlineCheckCircle,
    HiOutlineClipboardDocumentList,
    HiOutlinePlus,
} from 'react-icons/hi2';
import { Badge, Button, Card, Input, PageHeader, Select, TableLoadingState } from '../components/ui';
import { useWarehouses } from '../hooks/useWarehouses';
import {
    useApprovePhysicalInventory,
    useCreatePhysicalInventory,
    usePhysicalInventories,
    usePhysicalInventoryDetail,
    useSubmitPhysicalInventoryCounts,
} from '../hooks/usePhysicalInventory';

const statusVariant = {
    DRAFT: 'gray',
    COUNTING: 'warning',
    REVIEW: 'primary',
    APPROVED: 'success',
    CANCELLED: 'danger',
} as const;

export default function PhysicalInventoryPage() {
    const { warehouses, isLoading: warehousesLoading } = useWarehouses();
    const [warehouseId, setWarehouseId] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [notes, setNotes] = useState('');
    const [counts, setCounts] = useState<Record<string, number>>({});

    const inventoriesQuery = usePhysicalInventories(warehouseId || undefined);
    const detailQuery = usePhysicalInventoryDetail(selectedId || undefined);
    const createMutation = useCreatePhysicalInventory();
    const submitMutation = useSubmitPhysicalInventoryCounts(selectedId);
    const approveMutation = useApprovePhysicalInventory();

    const warehouseOptions = useMemo(
        () => warehouses.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.code} - ${warehouse.name}` })),
        [warehouses]
    );

    useEffect(() => {
        if (!warehouseId && warehouses[0]) setWarehouseId(warehouses[0].id);
    }, [warehouseId, warehouses]);

    useEffect(() => {
        if (!selectedId && inventoriesQuery.data?.[0]) setSelectedId(inventoriesQuery.data[0].id);
    }, [inventoriesQuery.data, selectedId]);

    useEffect(() => {
        const detail = detailQuery.data;
        if (!detail) return;
        setCounts(Object.fromEntries(detail.lines.map((line) => [line.id, line.countedQuantity])));
    }, [detailQuery.data]);

    const detail = detailQuery.data;
    const lines = detail?.lines ?? [];
    const totalDifference = lines.reduce((sum, line) => sum + ((counts[line.id] ?? line.countedQuantity) - line.expectedQuantity), 0);
    const changedLines = lines.filter((line) => (counts[line.id] ?? line.countedQuantity) !== line.countedQuantity);

    const handleCreate = async () => {
        if (!warehouseId) return;
        const created = await createMutation.mutateAsync({ warehouseId, notes: notes || null });
        setSelectedId(created.id);
        setNotes('');
    };

    const handleSubmitCounts = async () => {
        if (!selectedId || changedLines.length === 0) return;
        await submitMutation.mutateAsync(changedLines.map((line) => ({
            lineId: line.id,
            countedQuantity: counts[line.id] ?? line.countedQuantity,
            notes: line.notes ?? null,
        })));
    };

    const handleApprove = async () => {
        if (!selectedId) return;
        await approveMutation.mutateAsync(selectedId);
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Inventario Fisico"
                subtitle="Contagem ciclica com ajuste automatico de stock apos aprovacao."
                icon={<HiOutlineClipboardDocumentList />}
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                        onClick={() => {
                            inventoriesQuery.refetch();
                            detailQuery.refetch();
                        }}
                    >
                        Actualizar
                    </Button>
                }
            />

            <Card variant="glass" className="p-4">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                    <Select
                        size="sm"
                        label="Armazem"
                        value={warehouseId}
                        onChange={(event) => {
                            setWarehouseId(event.target.value);
                            setSelectedId('');
                        }}
                        options={warehouseOptions}
                        disabled={warehousesLoading}
                    />
                    <Input
                        size="sm"
                        label="Notas"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Ex: contagem mensal"
                    />
                    <Button
                        size="sm"
                        leftIcon={<HiOutlinePlus className="w-4 h-4" />}
                        isLoading={createMutation.isPending}
                        disabled={!warehouseId}
                        onClick={handleCreate}
                    >
                        Nova contagem
                    </Button>
                </div>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
                <Card variant="glass" padding="none" className="overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">Sessoes</h2>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[620px] overflow-y-auto">
                        {inventoriesQuery.isLoading ? (
                            <div className="p-5 text-sm text-slate-500">A carregar contagens...</div>
                        ) : inventoriesQuery.data?.length ? (
                            inventoriesQuery.data.map((inventory) => (
                                <Button variant="ghost"
                                    key={inventory.id}
                                    type="button"
                                    onClick={() => setSelectedId(inventory.id)}
                                    className={`w-full text-left p-5 transition-colors hover:bg-slate-50 dark:hover:bg-dark-800 ${selectedId === inventory.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-black text-sm text-slate-900 dark:text-white">{inventory.reference}</p>
                                            <p className="text-[11px] font-semibold text-slate-500">{inventory.warehouse?.name}</p>
                                        </div>
                                        <Badge variant={statusVariant[inventory.status]}>{inventory.status}</Badge>
                                    </div>
                                    <p className="mt-2 text-[11px] text-slate-500">{inventory._count?.lines ?? 0} linhas</p>
                                </Button>
                            ))
                        ) : (
                            <div className="p-8 text-sm text-slate-500">Sem contagens para este filtro.</div>
                        )}
                    </div>
                </Card>

                <Card variant="glass" padding="none" className="overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-black text-slate-900 dark:text-white">{detail?.reference || 'Seleccione uma contagem'}</h2>
                            <p className="text-[11px] font-semibold text-slate-500">
                                Diferenca total: <span className={totalDifference === 0 ? 'text-emerald-600' : 'text-amber-600'}>{totalDifference}</span>
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={!detail || detail.status !== 'DRAFT' && detail.status !== 'COUNTING' || changedLines.length === 0}
                                isLoading={submitMutation.isPending}
                                onClick={handleSubmitCounts}
                            >
                                Enviar contagem
                            </Button>
                            <Button
                                size="sm"
                                variant="success"
                                leftIcon={<HiOutlineCheckCircle className="w-4 h-4" />}
                                disabled={!detail || detail.status !== 'REVIEW'}
                                isLoading={approveMutation.isPending}
                                onClick={handleApprove}
                            >
                                Aprovar ajustes
                            </Button>
                        </div>
                    </div>

                    <div className="min-h-[500px] overflow-x-auto">
                        {detailQuery.isLoading ? (
                            <TableLoadingState columns={5} rows={8} message="A carregar linhas..." />
                        ) : detail ? (
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-dark-900/60 text-[10px] uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4 text-left">Produto</th>
                                        <th className="px-5 py-4 text-right">Esperado</th>
                                        <th className="px-5 py-4 text-right">Contado</th>
                                        <th className="px-5 py-4 text-right">Diferenca</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {lines.map((line) => {
                                        const counted = counts[line.id] ?? line.countedQuantity;
                                        const difference = counted - line.expectedQuantity;
                                        return (
                                            <tr key={line.id} className="hover:bg-slate-50/70 dark:hover:bg-dark-800/50">
                                                <td className="px-5 py-4">
                                                    <p className="font-bold text-slate-900 dark:text-white">{line.product?.name}</p>
                                                    <p className="text-[11px] text-slate-500">{line.product?.code}</p>
                                                </td>
                                                <td className="px-5 py-4 text-right font-mono">{line.expectedQuantity}</td>
                                                <td className="px-5 py-4 text-right">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        className="h-10 w-28 rounded-xl border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-800 px-3 text-right text-sm font-mono"
                                                        value={counted}
                                                        disabled={detail.status !== 'DRAFT' && detail.status !== 'COUNTING'}
                                                        onChange={(event) => setCounts((previous) => ({
                                                            ...previous,
                                                            [line.id]: Number(event.target.value),
                                                        }))}
                                                    />
                                                </td>
                                                <td className={`px-5 py-4 text-right font-black ${difference === 0 ? 'text-slate-500' : difference > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {difference > 0 ? `+${difference}` : difference}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="p-10 text-center text-sm font-semibold text-slate-500">Crie ou seleccione uma contagem.</div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
