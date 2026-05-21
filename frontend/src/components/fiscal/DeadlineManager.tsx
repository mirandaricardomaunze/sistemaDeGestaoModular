import { useState, useMemo } from 'react';
import {
    HiOutlineCalendar,
    HiOutlinePlus,
    HiOutlineCheck,
    HiOutlineBell,
    HiOutlineTrash,
    HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import { useFiscalStore } from '../../stores/useFiscalStore';
import { useUser } from '../../stores/useAuthStore';
import { Button, Card, Input, Modal, Select, Badge, Pagination, usePagination, ConfirmationModal } from '../ui';
import { generateId } from '../../utils/helpers';
import { calculateDeadlineDate, formatPeriod, getCurrentFiscalPeriod } from '../../utils/fiscalCalculations';
import type { FiscalDeadline, DeadlineType } from '../../types/fiscal';
import toast from 'react-hot-toast';

export default function DeadlineManager() {
    const { deadlines, addDeadline, deleteDeadline, completeDeadline } = useFiscalStore();
    const user = useUser();
    const [nowTimestamp] = useState(() => Date.now());

    const [showModal, setShowModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        type: 'iva' as DeadlineType,
        title: '',
        description: '',
        dueDate: '',
        isRecurring: true,
        recurringPattern: 'monthly' as 'monthly' | 'quarterly' | 'annual',
    });

    // Sort deadlines by due date
    const sortedDeadlines = useMemo(() => {
        return [...deadlines].sort((a, b) => {
            // Pending first, then by date
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
    }, [deadlines]);

    // Pagination
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedDeadlines,
        totalItems,
    } = usePagination(sortedDeadlines, 10);

    const typeOptions = [
        { value: 'iva', label: 'IVA' },
        { value: 'inss', label: 'INSS' },
        { value: 'irt', label: 'IRPS' },
        { value: 'saft', label: 'SAF-T' },
        { value: 'other', label: 'Outro' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.dueDate) {
            toast.error('Preencha todos os campos obrigatÃ³rios');
            return;
        }

        const now = new Date().toISOString();

        const newDeadline: FiscalDeadline = {
            id: generateId(),
            type: formData.type,
            title: formData.title,
            description: formData.description,
            dueDate: formData.dueDate,
            reminderDays: [7, 3, 1],
            status: 'pending',
            isRecurring: formData.isRecurring,
            recurringPattern: formData.recurringPattern,
            createdAt: now,
            updatedAt: now,
        };

        addDeadline(newDeadline);
        toast.success('Prazo criado com sucesso!');
        setShowModal(false);
        resetForm();
    };

    const handleComplete = (id: string) => {
        completeDeadline(id, user?.id ?? 'anonymous');
        toast.success('Prazo marcado como concluÃ­do!');
    };

    const handleDelete = (id: string) => {
        deleteDeadline(id);
        toast.success('Prazo eliminado!');
        setShowDeleteConfirm(null);
    };

    const resetForm = () => {
        setFormData({
            type: 'iva',
            title: '',
            description: '',
            dueDate: '',
            isRecurring: true,
            recurringPattern: 'monthly',
        });
    };

    const generateStandardDeadlines = () => {
        const currentPeriod = getCurrentFiscalPeriod();
        const dueDate = calculateDeadlineDate(currentPeriod);
        const now = new Date().toISOString();

        const standardDeadlines: Omit<FiscalDeadline, 'id' | 'createdAt' | 'updatedAt'>[] = [
            {
                type: 'iva',
                title: 'DeclaraÃ§Ã£o Mensal IVA',
                description: `SubmissÃ£o da declaraÃ§Ã£o de IVA de ${formatPeriod(currentPeriod)}`,
                dueDate,
                reminderDays: [7, 3, 1],
                status: 'pending',
                isRecurring: true,
                recurringPattern: 'monthly',
            },
            {
                type: 'inss',
                title: 'DeclaraÃ§Ã£o INSS',
                description: `SubmissÃ£o da folha de contribuiÃ§Ãµes INSS de ${formatPeriod(currentPeriod)}`,
                dueDate,
                reminderDays: [7, 3, 1],
                status: 'pending',
                isRecurring: true,
                recurringPattern: 'monthly',
            },
            {
                type: 'irt',
                title: 'Pagamento RetenÃ§Ãµes IRPS',
                description: `Pagamento das retenÃ§Ãµes IRPS de ${formatPeriod(currentPeriod)}`,
                dueDate,
                reminderDays: [7, 3, 1],
                status: 'pending',
                isRecurring: true,
                recurringPattern: 'monthly',
            },
        ];

        standardDeadlines.forEach((d) => {
            addDeadline({
                ...d,
                id: generateId(),
                createdAt: now,
                updatedAt: now,
            });
        });

        toast.success('Prazos padrÃ£o criados com sucesso!');
    };

    const getStatusBadge = (deadline: FiscalDeadline) => {
        const dueDate = new Date(deadline.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (deadline.status === 'completed') {
            return <Badge variant="success">ConcluÃ­do</Badge>;
        }
        if (deadline.status === 'cancelled') {
            return <Badge variant="gray">Cancelado</Badge>;
        }
        if (daysUntilDue < 0) {
            return <Badge variant="danger">Atrasado ({Math.abs(daysUntilDue)} dias)</Badge>;
        }
        if (daysUntilDue <= 3) {
            return <Badge variant="warning">Urgente ({daysUntilDue} dias)</Badge>;
        }
        return <Badge variant="primary">{daysUntilDue} dias</Badge>;
    };

    const getTypeColor = (type: DeadlineType) => {
        const colors: Record<DeadlineType, string> = {
            iva: 'bg-blue-500',
            inss: 'bg-green-500',
            irt: 'bg-orange-500',
            saft: 'bg-purple-500',
            other: 'bg-gray-500',
        };
        return colors[type] || 'bg-gray-500';
    };

    // Upcoming urgent deadlines
    const urgentDeadlines = useMemo(() => sortedDeadlines.filter(d => {
        if (d.status !== 'pending') return false;
        const daysUntilDue = Math.ceil((new Date(d.dueDate).getTime() - nowTimestamp) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= 7;
    }), [sortedDeadlines, nowTimestamp]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Prazos e Obrigaces Fiscais
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Gerencie os prazos de submissÃ£o de declaraÃ§Ãµes fiscais
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={generateStandardDeadlines}>
                        <HiOutlineBell className="w-5 h-5 mr-2" />
                        Gerar Prazos PadrÃ£o
                    </Button>
                    <Button onClick={() => setShowModal(true)}>
                        <HiOutlinePlus className="w-5 h-5 mr-2" />
                        Novo Prazo
                    </Button>
                </div>
            </div>

            {/* Upcoming Urgent Deadlines Alert */}
            {urgentDeadlines.length > 0 && (
                <Card padding="md" className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <HiOutlineExclamationTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-red-800 dark:text-red-300">
                                AtenÃ§Ã£o: Prazos PrÃ³ximos
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-400">
                                Existem obrigaÃ§Ãµes fiscais a vencer nos prÃ³ximos 7 dias. Verifique a lista abaixo.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Deadlines List */}
            <Card padding="none">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                        <thead className="bg-gray-50 dark:bg-dark-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DescriÃ§Ã£o</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Data Limite</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Recorrente</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">AÃ§Ãµes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                            {paginatedDeadlines.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <HiOutlineCalendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>Nenhum prazo configurado</p>
                                        <p className="text-sm mt-1">
                                            Clique em "Gerar Prazos PadrÃ£o" para criar os prazos mensais automÃ¡ticos
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedDeadlines.map((deadline) => (
                                    <tr
                                        key={deadline.id}
                                        className={`hover:bg-gray-50 dark:hover:bg-dark-800 ${deadline.status === 'completed' ? 'opacity-60' : ''
                                            }`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${getTypeColor(deadline.type)}`}></div>
                                                <span className="font-medium text-gray-900 dark:text-white uppercase">
                                                    {deadline.type}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {deadline.title}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                {deadline.description}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <p className="font-mono text-gray-900 dark:text-white">
                                                {new Date(deadline.dueDate).toLocaleDateString('pt-MZ')}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {getStatusBadge(deadline)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {deadline.isRecurring ? (
                                                <Badge variant="info" size="sm">
                                                    {deadline.recurringPattern === 'monthly' && 'Mensal'}
                                                    {deadline.recurringPattern === 'quarterly' && 'Trimestral'}
                                                    {deadline.recurringPattern === 'annual' && 'Anual'}
                                                </Badge>
                                            ) : (
                                                <Badge variant="gray" size="sm">Ãšnico</Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                {deadline.status === 'pending' && (
                                                    <Button variant="ghost"
                                                        onClick={() => handleComplete(deadline.id)}
                                                        className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                                                        title="Marcar como concluÃ­do"
                                                    >
                                                        <HiOutlineCheck className="w-5 h-5" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost"
                                                    onClick={() => setShowDeleteConfirm(deadline.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <HiOutlineTrash className="w-5 h-5" />
                                                </Button>
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

            {/* Add Deadline Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title="Novo Prazo Fiscal"
                size="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Select
                        label="Tipo de ObrigaÃ§Ã£o"
                        options={typeOptions}
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as DeadlineType })}
                    />

                    <Input
                        label="TÃ­tulo"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                        placeholder="Ex: DeclaraÃ§Ã£o Mensal IVA"
                    />

                    <Input
                        label="DescriÃ§Ã£o"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="DescriÃ§Ã£o detalhada da obrigaÃ§Ã£o"
                    />

                    <Input
                        label="Data Limite"
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        required
                    />

                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.isRecurring}
                                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Recorrente</span>
                        </label>

                        {formData.isRecurring && (
                            <select
                                className="p-2 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-sm"
                                value={formData.recurringPattern}
                                onChange={(e) => setFormData({ ...formData, recurringPattern: e.target.value as 'monthly' | 'quarterly' | 'annual' })}
                            >
                                <option value="monthly">Mensal</option>
                                <option value="quarterly">Trimestral</option>
                                <option value="annual">Anual</option>
                            </select>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-dark-700">
                        <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit">
                            Criar Prazo
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmationModal
                isOpen={!!showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(null)}
                onConfirm={() => { if (showDeleteConfirm) handleDelete(showDeleteConfirm); }}
                title="Confirmar EliminaÃ§Ã£o"
                message="Tem certeza que deseja eliminar este prazo? Esta aÃ§Ã£o nÃ£o pode ser desfeita."
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
            />
        </div>
    );
}
