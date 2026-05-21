import { useState } from 'react';
import { Button, Input, Modal, Textarea } from '../ui';
import { useApprovalActions } from '../../hooks/useApprovals';
import {
    APPROVAL_REQUEST_LABELS,
    type ApprovalRequestType,
} from '../../types/approvals';

interface RequestApprovalModalProps {
    open: boolean;
    onClose: () => void;
    onSubmitted?: (approvalId: string) => void;
    requestType: ApprovalRequestType;
    resourceType?: string;
    resourceId?: string;
    initialAmount?: number;
    title?: string;
    description?: string;
}

export function RequestApprovalModal({
    open,
    onClose,
    onSubmitted,
    requestType,
    resourceType,
    resourceId,
    initialAmount,
    title,
    description,
}: RequestApprovalModalProps) {
    const [reason, setReason] = useState('');
    const [amount, setAmount] = useState<number | ''>(initialAmount ?? '');
    const { create } = useApprovalActions();

    const handleSubmit = async () => {
        if (!reason.trim() || reason.trim().length < 3) return;
        const result = await create.mutateAsync({
            requestType,
            resourceType: resourceType ?? null,
            resourceId: resourceId ?? null,
            amount: typeof amount === 'number' ? amount : null,
            reason: reason.trim(),
        });
        const approvalId = result.data?.id || result.id;
        if (approvalId) onSubmitted?.(approvalId);
        setReason('');
        onClose();
    };

    return (
        <Modal isOpen={open} onClose={onClose} title={title ?? `Solicitar aprovação: ${APPROVAL_REQUEST_LABELS[requestType]}`}>
            <div className="space-y-4 p-4">
                {description && <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>}

                <Input
                    label="Valor"
                    type="number"
                    step="0.01"
                    value={amount === '' ? '' : String(amount)}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                />

                <Textarea
                    label="Motivo (obrigatório)"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explique porque precisa desta aprovação"
                />

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={create.isPending || reason.trim().length < 3}
                    >
                        Enviar pedido
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
