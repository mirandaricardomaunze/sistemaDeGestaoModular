import {
    HiOutlineDocumentAdd,
    HiOutlinePrinter,
    HiOutlineCube,
    HiOutlineCheck,
    HiOutlineClock,
} from 'react-icons/hi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../../utils/helpers';

export type OrderStatus = 'created' | 'printed' | 'separated' | 'completed' | 'cancelled';

export interface StatusTransition {
    status: OrderStatus;
    timestamp: string;
    responsibleName?: string;
    notes?: string;
}

interface OrderStatusTrackerProps {
    currentStatus: OrderStatus;
    transitions: StatusTransition[];
    className?: string;
}

const statusConfig: Record<OrderStatus, {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
}> = {
    created: {
        label: 'Criada',
        icon: HiOutlineDocumentAdd,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    printed: {
        label: 'Impressa',
        icon: HiOutlinePrinter,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    separated: {
        label: 'Separada',
        icon: HiOutlineCube,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
    completed: {
        label: 'Completada',
        icon: HiOutlineCheck,
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    cancelled: {
        label: 'Cancelada',
        icon: HiOutlineClock,
        color: 'text-red-600',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
};

const statusOrder: OrderStatus[] = ['created', 'printed', 'separated', 'completed'];

export default function OrderStatusTracker({
    currentStatus,
    transitions,
    className,
}: OrderStatusTrackerProps) {
    const currentIndex = statusOrder.indexOf(currentStatus);
    const isCancelled = currentStatus === 'cancelled';

    const getTransitionForStatus = (status: OrderStatus): StatusTransition | undefined => {
        return transitions.find((t) => t.status === status);
    };

    return (
        <div className={cn('', className)}>
            {/* Horizontal Timeline for larger screens */}
            <div className="hidden md:flex items-center justify-between">
                {statusOrder.map((status, index) => {
                    const config = statusConfig[status];
                    const transition = getTransitionForStatus(status);
                    const isCompleted = !isCancelled && currentIndex >= index;
                    const isCurrent = status === currentStatus;
                    const Icon = config.icon;

                    return (
                        <div key={status} className="flex items-center flex-1">
                            {/* Step */}
                            <div className="flex flex-col items-center">
                                <div
                                    className={cn(
                                        'w-14 h-14 rounded-full flex items-center justify-center transition-all relative',
                                        isCompleted
                                            ? `${config.bgColor} ${config.color}`
                                            : 'bg-gray-100 dark:bg-dark-700 text-gray-400',
                                        isCurrent && 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-dark-800',
                                        isCurrent && config.color.replace('text-', 'ring-')
                                    )}
                                >
                                    <Icon className="w-7 h-7" />
                                    {isCompleted && transition && (
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                            <HiOutlineCheck className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </div>
                                <p className={cn(
                                    'mt-3 text-sm font-medium',
                                    isCompleted ? config.color : 'text-gray-500'
                                )}>
                                    {config.label}
                                </p>
                                {transition && (
                                    <div className="mt-1 text-center">
                                        <p className="text-xs text-gray-500">
                                            {format(new Date(transition.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                                        </p>
                                        {transition.responsibleName && (
                                            <p className="text-xs text-gray-400">
                                                {transition.responsibleName}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Connector */}
                            {index < statusOrder.length - 1 && (
                                <div
                                    className={cn(
                                        'flex-1 h-1 mx-4 rounded-full transition-all',
                                        currentIndex > index
                                            ? 'bg-gradient-to-r from-green-400 to-green-500'
                                            : 'bg-gray-200 dark:bg-dark-600'
                                    )}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Vertical Timeline for mobile */}
            <div className="md:hidden space-y-4">
                {statusOrder.map((status, index) => {
                    const config = statusConfig[status];
                    const transition = getTransitionForStatus(status);
                    const isCompleted = !isCancelled && currentIndex >= index;
                    const isCurrent = status === currentStatus;
                    const Icon = config.icon;

                    return (
                        <div key={status} className="flex items-start gap-4">
                            {/* Icon and Line */}
                            <div className="flex flex-col items-center">
                                <div
                                    className={cn(
                                        'w-12 h-12 rounded-full flex items-center justify-center transition-all',
                                        isCompleted
                                            ? `${config.bgColor} ${config.color}`
                                            : 'bg-gray-100 dark:bg-dark-700 text-gray-400',
                                        isCurrent && 'ring-4 ring-offset-2',
                                        isCurrent && config.color.replace('text-', 'ring-')
                                    )}
                                >
                                    <Icon className="w-6 h-6" />
                                </div>
                                {index < statusOrder.length - 1 && (
                                    <div
                                        className={cn(
                                            'w-0.5 h-12 mt-2',
                                            currentIndex > index
                                                ? 'bg-green-400'
                                                : 'bg-gray-200 dark:bg-dark-600'
                                        )}
                                    />
                                )}
                            </div>
                            {/* Content */}
                            <div className="flex-1 pt-2">
                                <p className={cn(
                                    'font-medium',
                                    isCompleted ? config.color : 'text-gray-500'
                                )}>
                                    {config.label}
                                </p>
                                {transition ? (
                                    <div className="mt-1">
                                        <p className="text-sm text-gray-500">
                                            {format(new Date(transition.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                        </p>
                                        {transition.responsibleName && (
                                            <p className="text-sm text-gray-400">
                                                Por: {transition.responsibleName}
                                            </p>
                                        )}
                                        {transition.notes && (
                                            <p className="text-sm text-gray-400 mt-1 italic">
                                                "{transition.notes}"
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400">Pendente</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Cancelled Status */}
            {isCancelled && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <HiOutlineClock className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="font-medium text-red-700 dark:text-red-400">
                                Encomenda Cancelada
                            </p>
                            {getTransitionForStatus('cancelled') && (
                                <p className="text-sm text-red-600 dark:text-red-500">
                                    {format(
                                        new Date(getTransitionForStatus('cancelled')!.timestamp),
                                        "dd/MM/yyyy 'às' HH:mm",
                                        { locale: ptBR }
                                    )}
                                    {getTransitionForStatus('cancelled')?.responsibleName && (
                                        <span> por {getTransitionForStatus('cancelled')?.responsibleName}</span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
