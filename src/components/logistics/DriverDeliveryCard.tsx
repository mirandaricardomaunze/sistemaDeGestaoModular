/**
 * DriverDeliveryCard Component
 *
 * Responsibility: Render a single delivery card for the Driver Panel.
 * Displays delivery info + allowed action buttons.
 * Zero business logic — all data and actions come via props.
 *
 * Design tokens:
 *   Priority visual cues:  urgent=red pulse ring, high=orange, normal=blue, low=gray
 *   Action buttons: one per allowed transition, colour-coded by destination status
 */

import { useState } from 'react';
import { Button, Badge, Modal } from '../ui';
import { SignaturePad } from '../ui/SignaturePad';
import { DeliveryStatusTimeline } from './DeliveryStatusTimeline';
import { useDeliveryStatusTimeline } from '../../hooks/useLogistics';
import type { DriverPanelDelivery, Delivery } from '../../hooks/useDriverPanel';
import {
    HiOutlineMapPin,
    HiOutlineUser,
    HiOutlinePhone,
    HiOutlineClock,
    HiOutlineChevronDown,
    HiOutlineChevronUp,
    HiOutlineExclamationTriangle,
    HiOutlineTruck,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineArrowPath,
} from 'react-icons/hi2';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
    urgent: {
        ring: 'ring-2 ring-red-500',
        badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
        label: 'Urgente',
        pulse: true,
    },
    high: {
        ring: 'ring-2 ring-orange-400',
        badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        label: 'Alta',
        pulse: false,
    },
    normal: {
        ring: '',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
        label: 'Normal',
        pulse: false,
    },
    low: {
        ring: '',
        badge: 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400',
        label: 'Baixa',
        pulse: false,
    },
} as const;

const STATUS_ACTION_CONFIG: Partial<Record<Delivery['status'], { label: string; className: string; icon: React.ElementType }>> = {
    in_transit:       { label: 'Iniciar Trânsito',     className: 'bg-blue-600 hover:bg-blue-700 text-white',    icon: HiOutlineTruck },
    out_for_delivery: { label: 'Saiu para Entrega',    className: 'bg-indigo-600 hover:bg-indigo-700 text-white', icon: HiOutlineMapPin },
    delivered:        { label: 'Marcar Entregue',      className: 'bg-emerald-600 hover:bg-emerald-700 text-white', icon: HiOutlineCheckCircle },
    failed:           { label: 'Registar Falha',       className: 'bg-red-600 hover:bg-red-700 text-white',       icon: HiOutlineXCircle },
    returned:         { label: 'Devolver',             className: 'bg-gray-600 hover:bg-gray-700 text-white',     icon: HiOutlineArrowPath },
    cancelled:        { label: 'Cancelar',             className: 'border border-gray-300 dark:border-dark-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700', icon: HiOutlineXCircle },
};

// ─── Sub-component: Failure Reason Input ─────────────────────────────────────

interface FailureInputProps {
    value: string;
    onChange: (v: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading: boolean;
}

function FailureReasonInput({ value, onChange, onConfirm, onCancel, isLoading }: FailureInputProps) {
    return (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 space-y-2">
            <p className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-1">
                <HiOutlineExclamationTriangle className="w-4 h-4" />
                Motivo da falha (obrigatório)
            </p>
            <textarea
                className="w-full text-sm rounded-lg border border-red-300 dark:border-red-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 p-2 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                rows={2}
                placeholder="Descreva o motivo..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                aria-label="Motivo da falha"
            />
            <div className="flex gap-2">
                <Button
                    size="sm"
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    onClick={onConfirm}
                    disabled={!value.trim()}
                    isLoading={isLoading}
                >
                    Confirmar Falha
                </Button>
                <Button size="sm" variant="outline" onClick={onCancel}>
                    Cancelar
                </Button>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DriverDeliveryCardProps {
    item: DriverPanelDelivery;
    onStatusUpdate: (params: { deliveryId: string; status: Delivery['status']; failureReason?: string; recipientSign?: string }) => Promise<void>;
    isUpdating: boolean;
}

export function DriverDeliveryCard({ item, onStatusUpdate, isUpdating }: DriverDeliveryCardProps) {
    const { delivery, allowedTransitions } = item;
    const [isTimelineOpen, setIsTimelineOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<Delivery['status'] | null>(null);
    const [failureReason, setFailureReason] = useState('');
    const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

    const timeline = useDeliveryStatusTimeline(delivery);
    const priorityConfig = PRIORITY_CONFIG[delivery.priority] ?? PRIORITY_CONFIG.normal;

    const handleActionClick = (status: Delivery['status']) => {
        if (status === 'delivered') {
            setIsSignatureModalOpen(true);
        } else if (status === 'failed' || status === 'returned') {
            // Require failure reason before confirming
            setPendingStatus(status);
        } else {
            onStatusUpdate({ deliveryId: delivery.id, status });
        }
    };

    const handleFailureConfirm = async () => {
        if (!pendingStatus || !failureReason.trim()) return;
        await onStatusUpdate({ 
            deliveryId: delivery.id, 
            status: pendingStatus, 
            failureReason: failureReason.trim() 
        });
        setPendingStatus(null);
        setFailureReason('');
    };

    const handleSignatureSave = async (signature: string) => {
        await onStatusUpdate({
            deliveryId: delivery.id,
            status: 'delivered',
            recipientSign: signature
        });
        setIsSignatureModalOpen(false);
    };

    return (
        <article
            className={`bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden transition-shadow hover:shadow-md ${priorityConfig.ring}`}
            aria-label={`Entrega ${delivery.number}`}
        >
            {/* Card Header */}
            <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                        {priorityConfig.pulse && (
                            <span className="flex h-2.5 w-2.5 flex-shrink-0">
                                <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                            </span>
                        )}
                        <h3 className="font-bold text-base text-gray-900 dark:text-white font-mono truncate">
                            {delivery.number}
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityConfig.badge}`}>
                            {priorityConfig.label}
                        </span>
                        <Badge
                            variant={
                                delivery.status === 'pending' ? 'warning' :
                                delivery.status === 'in_transit' ? 'primary' :
                                delivery.status === 'out_for_delivery' ? 'info' : 'gray'
                            }
                        >
                            {delivery.status === 'pending' ? 'Pendente' :
                             delivery.status === 'scheduled' ? 'Agendada' :
                             delivery.status === 'in_transit' ? 'Em Trânsito' :
                             delivery.status === 'out_for_delivery' ? 'Em Entrega' : delivery.status}
                        </Badge>
                    </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 mb-3">
                    <HiOutlineMapPin className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="line-clamp-2">{delivery.deliveryAddress}</span>
                </div>

                {/* Recipient */}
                {delivery.recipientName && (
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5">
                            <HiOutlineUser className="w-3.5 h-3.5" aria-hidden="true" />
                            {delivery.recipientName}
                        </span>
                        {delivery.recipientPhone && (
                            <a
                                href={`tel:${delivery.recipientPhone}`}
                                className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400 hover:underline"
                                aria-label={`Ligar para ${delivery.recipientName}`}
                            >
                                <HiOutlinePhone className="w-3.5 h-3.5" aria-hidden="true" />
                                {delivery.recipientPhone}
                            </a>
                        )}
                    </div>
                )}

                {/* Scheduled date */}
                {delivery.scheduledDate && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mt-2">
                        <HiOutlineClock className="w-3.5 h-3.5" aria-hidden="true" />
                        Agendada para {new Date(delivery.scheduledDate).toLocaleDateString('pt-MZ', {
                            weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            {allowedTransitions.length > 0 && (
                <div className="px-4 sm:px-5 pb-4 flex flex-wrap gap-2">
                    {allowedTransitions.map(({ status, label }) => {
                        const actionConfig = STATUS_ACTION_CONFIG[status];
                        if (!actionConfig) return null;
                        const ActionIcon = actionConfig.icon;
                        return (
                            <button
                                key={status}
                                type="button"
                                onClick={() => handleActionClick(status)}
                                disabled={isUpdating}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${actionConfig.className}`}
                                aria-label={`${label} — Entrega ${delivery.number}`}
                            >
                                <ActionIcon className="w-4 h-4" aria-hidden="true" />
                                {label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Failure reason input (shown when driver clicks Registar Falha) */}
            {pendingStatus && (
                <div className="px-4 sm:px-5 pb-4">
                    <FailureReasonInput
                        value={failureReason}
                        onChange={setFailureReason}
                        onConfirm={handleFailureConfirm}
                        onCancel={() => { setPendingStatus(null); setFailureReason(''); }}
                        isLoading={isUpdating}
                    />
                </div>
            )}

            {/* Timeline Toggle */}
            <button
                type="button"
                onClick={() => setIsTimelineOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 sm:px-5 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-dark-700/50 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors border-t border-gray-100 dark:border-dark-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                aria-expanded={isTimelineOpen}
                aria-controls={`timeline-${delivery.id}`}
            >
                <span>Ver histórico de estados</span>
                {isTimelineOpen
                    ? <HiOutlineChevronUp className="w-4 h-4" aria-hidden="true" />
                    : <HiOutlineChevronDown className="w-4 h-4" aria-hidden="true" />
                }
            </button>

            {isTimelineOpen && (
                <div
                    id={`timeline-${delivery.id}`}
                    className="px-4 sm:px-5 py-3 border-t border-gray-100 dark:border-dark-700 bg-gray-50 dark:bg-dark-700/30"
                >
                    <DeliveryStatusTimeline events={timeline} />
                </div>
            )}

            {/* Signature Modal */}
            <Modal
                isOpen={isSignatureModalOpen}
                onClose={() => setIsSignatureModalOpen(false)}
                title="Prova de Entrega Digital"
                size="md"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800">
                        <p className="text-sm text-primary-800 dark:text-primary-300 font-medium">
                            Por favor, peça ao cliente para assinar no campo abaixo para confirmar a recepção da entrega #{delivery.number}.
                        </p>
                    </div>
                    
                    <SignaturePad 
                        onSave={handleSignatureSave}
                        onClear={() => {}}
                    />
                </div>
            </Modal>
        </article>
    );
}
