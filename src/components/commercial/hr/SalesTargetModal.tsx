import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Modal, Input, Select, ConfirmationModal } from '../../ui';
import { useSalesTargets } from '../../../hooks/useSalesTargets';
import { useEmployees } from '../../../hooks/useData';
import { useWarehouses } from '../../../hooks/useWarehouses';
import type { SalesTarget } from '../../../services/api';

const targetSchema = z.object({
    employeeId: z.string().optional().or(z.literal('')),
    warehouseId: z.string().optional().or(z.literal('')),
    type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    value: z.coerce.number().positive('O valor deve ser positivo'),
    startDate: z.string().min(1, 'Data de início é obrigatória'),
    endDate: z.string().min(1, 'Data de fim é obrigatória'),
}).refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'Data fim tem de ser igual ou posterior à data início',
    path: ['endDate'],
});

type TargetFormData = z.infer<typeof targetSchema>;

interface SalesTargetModalProps {
    isOpen: boolean;
    onClose: () => void;
    target?: SalesTarget | null;
}

function defaultDateRange(type: 'DAILY' | 'WEEKLY' | 'MONTHLY') {
    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);
    if (type === 'WEEKLY') {
        const day = today.getDay();
        const diffToMonday = (day + 6) % 7;
        start.setDate(today.getDate() - diffToMonday);
        end.setDate(start.getDate() + 6);
    } else if (type === 'MONTHLY') {
        start.setDate(1);
        end.setMonth(today.getMonth() + 1);
        end.setDate(0);
    }
    return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
    };
}

export function SalesTargetModal({ isOpen, onClose, target }: SalesTargetModalProps) {
    const { createTarget, updateTarget, deleteTarget, isSaving, isDeleting } = useSalesTargets();
    const { employees } = useEmployees();
    const { warehouses } = useWarehouses();
    const isEditing = !!target;
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<TargetFormData>({
        resolver: zodResolver(targetSchema) as never,
        defaultValues: {
            type: 'MONTHLY',
            value: 0,
            ...defaultDateRange('MONTHLY'),
        },
    });

    const watchedType = watch('type');

    useEffect(() => {
        if (target) {
            reset({
                employeeId: target.employeeId || '',
                warehouseId: target.warehouseId || '',
                type: target.type,
                value: target.value,
                startDate: target.startDate.split('T')[0],
                endDate: target.endDate.split('T')[0],
            });
        } else {
            reset({
                employeeId: '',
                warehouseId: '',
                type: 'MONTHLY',
                value: 0,
                ...defaultDateRange('MONTHLY'),
            });
        }
    }, [target, reset]);

    useEffect(() => {
        if (target || !watchedType) return;
        const range = defaultDateRange(watchedType);
        setValue('startDate', range.startDate);
        setValue('endDate', range.endDate);
    }, [watchedType, target, setValue]);

    const onSubmit = async (data: TargetFormData) => {
        const payload = {
            ...data,
            employeeId: data.employeeId || null,
            warehouseId: data.warehouseId || null,
        };

        if (isEditing && target) {
            await updateTarget({ id: target.id, data: payload as never });
        } else {
            await createTarget(payload as never);
        }
        onClose();
    };

    const handleDelete = async () => {
        if (!target) return;
        await deleteTarget(target.id);
        setConfirmDeleteOpen(false);
        onClose();
    };

    const activeWarehouses = (warehouses || []).filter(w => w.isActive !== false);

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={isEditing ? 'Editar Meta' : 'Configurar Nova Meta'}
                size="md"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <Select
                        label="Operador (Opcional)"
                        options={[
                            { value: '', label: 'Meta da Equipa (sem operador)' },
                            ...(employees || []).map(e => ({ value: e.id, label: e.name }))
                        ]}
                        {...register('employeeId')}
                        error={errors.employeeId?.message}
                    />

                    <Select
                        label="Filial / Armazém (Opcional)"
                        options={[
                            { value: '', label: 'Todas as filiais' },
                            ...activeWarehouses.map(w => ({ value: w.id, label: `${w.code} — ${w.name}` }))
                        ]}
                        {...register('warehouseId')}
                        error={errors.warehouseId?.message}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Período"
                            options={[
                                { value: 'DAILY', label: 'Diária' },
                                { value: 'WEEKLY', label: 'Semanal' },
                                { value: 'MONTHLY', label: 'Mensal' },
                            ]}
                            {...register('type')}
                            error={errors.type?.message}
                        />
                        <Input
                            label="Valor Alvo (MT)"
                            type="number"
                            step="0.01"
                            {...register('value')}
                            error={errors.value?.message}
                            leftIcon={<span className="text-gray-400 text-xs">MT</span>}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Data Início"
                            type="date"
                            {...register('startDate')}
                            error={errors.startDate?.message}
                        />
                        <Input
                            label="Data Fim"
                            type="date"
                            {...register('endDate')}
                            error={errors.endDate?.message}
                        />
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-dark-700">
                        <div>
                            {isEditing && (
                                <Button
                                    variant="danger"
                                    type="button"
                                    size="sm"
                                    onClick={() => setConfirmDeleteOpen(true)}
                                >
                                    Eliminar
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
                            <Button variant="primary" isLoading={isSaving} type="submit">
                                {isEditing ? 'Atualizar Meta' : 'Criar Meta'}
                            </Button>
                        </div>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={confirmDeleteOpen}
                onClose={() => setConfirmDeleteOpen(false)}
                onConfirm={handleDelete}
                title="Eliminar meta"
                message="Esta operação remove a meta de forma permanente. Tens a certeza?"
                confirmText="Eliminar"
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
}
