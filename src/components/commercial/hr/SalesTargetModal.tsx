import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Modal, Input, Select } from '../../ui';
import { useSalesTargets } from '../../../hooks/useSalesTargets';
import { useEmployees } from '../../../hooks/useData';
import type { SalesTarget } from '../../../services/api';

const targetSchema = z.object({
    employeeId: z.string().optional().or(z.literal('')),
    type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    value: z.coerce.number().positive('O valor deve ser positivo'),
    startDate: z.string().min(1, 'Data de início é obrigatória'),
    endDate: z.string().min(1, 'Data de fim é obrigatória'),
});

type TargetFormData = z.infer<typeof targetSchema>;

interface SalesTargetModalProps {
    isOpen: boolean;
    onClose: () => void;
    target?: SalesTarget | null;
}

export function SalesTargetModal({ isOpen, onClose, target }: SalesTargetModalProps) {
    const { createTarget, updateTarget, isSaving } = useSalesTargets();
    const { employees } = useEmployees();
    const isEditing = !!target;

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<TargetFormData>({
        resolver: zodResolver(targetSchema) as never,
        defaultValues: {
            type: 'MONTHLY',
            value: 0,
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
        },
    });

    useEffect(() => {
        if (target) {
            reset({
                employeeId: target.employeeId || '',
                type: target.type,
                value: target.value,
                startDate: target.startDate.split('T')[0],
                endDate: target.endDate.split('T')[0],
            });
        } else {
            reset({
                type: 'MONTHLY',
                value: 0,
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
            });
        }
    }, [target, reset]);

    const onSubmit = async (data: TargetFormData) => {
        const payload = {
            ...data,
            employeeId: data.employeeId || null,
        };

        if (isEditing && target) {
            await updateTarget({ id: target.id, data: payload as never });
        } else {
            await createTarget(payload as never);
        }
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Editar Meta' : 'Configurar Nova Meta'}
            size="md"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Select
                    label="Operador (Opcional - deixe vazio para meta global)"
                    options={[
                        { value: '', label: 'Meta Global da Equipa' },
                        ...(employees || []).map(e => ({ value: e.id, label: e.name }))
                    ]}
                    {...register('employeeId')}
                    error={errors.employeeId?.message}
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

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                    <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
                    <Button variant="primary" isLoading={isSaving} type="submit">
                        {isEditing ? 'Atualizar Meta' : 'Criar Meta'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
