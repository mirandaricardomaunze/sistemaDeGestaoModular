import { useState, useEffect } from 'react';
import { pharmacyAPI } from '../../services/api/hospitality.api';
import { Card, Button, Input, Select } from '../../components/ui';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineExclamationCircle, HiOutlineSearch } from 'react-icons/hi';
import toast from 'react-hot-toast';

const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
    contraindicated: { label: 'Contraindicado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    major: { label: 'Grave', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    moderate: { label: 'Moderado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    minor: { label: 'Leve', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

export default function PharmacyDrugInteractions() {
    const [interactions, setInteractions] = useState<any[]>([]);
    const [medications, setMedications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [form, setForm] = useState({
        medicationAId: '',
        medicationBId: '',
        severity: 'moderate',
        description: '',
        mechanism: '',
        management: '',
    });

    const fetchInteractions = async () => {
        setIsLoading(true);
        try {
            const data = await pharmacyAPI.getDrugInteractions();
            setInteractions(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Erro ao carregar interações.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMedications = async () => {
        try {
            const data = await pharmacyAPI.getMedications({ limit: 500 });
            const list = Array.isArray(data) ? data : (data.data || []);
            setMedications(list);
        } catch {
            // silent
        }
    };

    useEffect(() => {
        fetchInteractions();
        fetchMedications();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.medicationAId || !form.medicationBId || !form.description) {
            toast.error('Preencha todos os campos obrigatórios.');
            return;
        }
        if (form.medicationAId === form.medicationBId) {
            toast.error('Seleccione dois medicamentos diferentes.');
            return;
        }
        try {
            await pharmacyAPI.createDrugInteraction(form);
            toast.success('Interação registada com sucesso.');
            setShowForm(false);
            setForm({ medicationAId: '', medicationBId: '', severity: 'moderate', description: '', mechanism: '', management: '' });
            fetchInteractions();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Erro ao registar interação.');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await pharmacyAPI.deleteDrugInteraction(id);
            toast.success('Interação eliminada.');
            setDeleteId(null);
            fetchInteractions();
        } catch {
            toast.error('Erro ao eliminar interação.');
        }
    };

    const filtered = interactions.filter(i => {
        if (!search) return true;
        const s = search.toLowerCase();
        const nameA = i.medicationA?.product?.name?.toLowerCase() || '';
        const nameB = i.medicationB?.product?.name?.toLowerCase() || '';
        return nameA.includes(s) || nameB.includes(s) || i.description?.toLowerCase().includes(s);
    });

    const medOptions = medications.map((m: any) => ({
        value: m.id,
        label: m.product?.name || m.id,
    }));

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <Input
                    placeholder="Pesquisar medicamento ou descrição..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5 text-gray-400" />}
                    className="flex-1 max-w-sm bg-white dark:bg-dark-800"
                />
                <Button onClick={() => setShowForm(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />} size="sm">
                    Nova Interação
                </Button>
            </div>

            {/* Add form */}
            {showForm && (
                <Card className="p-4 border-2 border-primary-200 dark:border-primary-800">
                    <h3 className="font-semibold text-sm mb-3 text-primary-700 dark:text-primary-400">Registar Nova Interação Medicamentosa</h3>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Select
                                label="Medicamento A *"
                                options={[{ value: '', label: 'Seleccionar...' }, ...medOptions]}
                                value={form.medicationAId}
                                onChange={(e: any) => setForm(f => ({ ...f, medicationAId: e.target.value }))}
                            />
                            <Select
                                label="Medicamento B *"
                                options={[{ value: '', label: 'Seleccionar...' }, ...medOptions]}
                                value={form.medicationBId}
                                onChange={(e: any) => setForm(f => ({ ...f, medicationBId: e.target.value }))}
                            />
                        </div>
                        <Select
                            label="Gravidade *"
                            options={[
                                { value: 'contraindicated', label: 'Contraindicado' },
                                { value: 'major', label: 'Grave' },
                                { value: 'moderate', label: 'Moderado' },
                                { value: 'minor', label: 'Leve' },
                            ]}
                            value={form.severity}
                            onChange={(e: any) => setForm(f => ({ ...f, severity: e.target.value }))}
                        />
                        <Input
                            label="Descrição da interação *"
                            placeholder="Ex: Risco aumentado de hemorragia..."
                            value={form.description}
                            onChange={(e: any) => setForm(f => ({ ...f, description: e.target.value }))}
                        />
                        <Input
                            label="Mecanismo (opcional)"
                            placeholder="Ex: Inibição do CYP2C9..."
                            value={form.mechanism}
                            onChange={(e: any) => setForm(f => ({ ...f, mechanism: e.target.value }))}
                        />
                        <Input
                            label="Gestão clínica (opcional)"
                            placeholder="Ex: Monitorizar INR semanalmente..."
                            value={form.management}
                            onChange={(e: any) => setForm(f => ({ ...f, management: e.target.value }))}
                        />
                        <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
                            <Button size="sm" type="submit">Guardar</Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* Interactions list */}
            {isLoading ? (
                <div className="text-center py-12 text-gray-400 text-sm">A carregar...</div>
            ) : filtered.length === 0 ? (
                <Card className="p-8 text-center">
                    <HiOutlineExclamationCircle className="w-10 h-10 text-gray-200 dark:text-dark-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Nenhuma interação registada</p>
                    <p className="text-xs text-gray-400 mt-1">Clique em "Nova Interação" para adicionar</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map(interaction => {
                        const sev = SEVERITY_LABELS[interaction.severity] || { label: interaction.severity, color: 'bg-gray-100 text-gray-700' };
                        const nameA = interaction.medicationA?.product?.name || '—';
                        const nameB = interaction.medicationB?.product?.name || '—';
                        return (
                            <Card key={interaction.id} className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-semibold text-sm text-gray-900 dark:text-white">{nameA}</span>
                                            <span className="text-gray-400 text-xs">+</span>
                                            <span className="font-semibold text-sm text-gray-900 dark:text-white">{nameB}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sev.color}`}>{sev.label}</span>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{interaction.description}</p>
                                        {interaction.mechanism && (
                                            <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Mecanismo:</span> {interaction.mechanism}</p>
                                        )}
                                        {interaction.management && (
                                            <p className="text-xs text-gray-500 mt-0.5"><span className="font-medium">Gestão:</span> {interaction.management}</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setDeleteId(interaction.id)}
                                        className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                                    >
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Delete confirmation */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="p-6 max-w-sm w-full mx-4">
                        <h3 className="font-bold text-lg mb-2">Eliminar interação?</h3>
                        <p className="text-sm text-gray-500 mb-4">Esta acção não pode ser revertida.</p>
                        <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>Cancelar</Button>
                            <Button variant="danger" size="sm" onClick={() => handleDelete(deleteId)}>Eliminar</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
