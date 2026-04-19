import { logger } from '../../utils/logger';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Badge, LoadingSpinner, EmptyState, ConfirmationModal } from '../ui';
import { hospitalityAPI } from '../../services/api';
import toast from 'react-hot-toast';
import {
    HiOutlineHome,
    HiOutlineCheck,
    HiOutlinePlay,
    HiOutlineArrowPath,
    HiOutlineClock,
    HiOutlineExclamationCircle,
    HiOutlineUser,
    HiOutlineTrash
} from 'react-icons/hi2';

interface HousekeepingTask {
    id: string;
    roomId: string;
    type: 'checkout_cleaning' | 'stay_cleaning' | 'deep_cleaning' | 'maintenance_prep';
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: number;
    assignedTo: string | null;
    notes: string | null;
    scheduledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    room: {
        id: string;
        number: string;
        type: string;
        status: string;
    };
}

interface HousekeepingPanelProps {
    onRoomCleaned?: () => void;
}

export default function HousekeepingPanel({ onRoomCleaned }: HousekeepingPanelProps) {
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const data = await hospitalityAPI.getHousekeepingTasks(
                filter !== 'all' ? { status: filter } : undefined
            );
            setTasks(data);
        } catch (error) {
            logger.error('Failed to fetch housekeeping tasks:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [filter]);

    const handleStatusChange = async (taskId: string, newStatus: 'in_progress' | 'completed') => {
        try {
            await hospitalityAPI.updateHousekeepingTask(taskId, { status: newStatus });
            toast.success(
                newStatus === 'in_progress'
                    ? t('messages.saveSuccess')
                    : t('messages.updateSuccess')
            );
            fetchTasks();
            if (newStatus === 'completed') {
                onRoomCleaned?.();
            }
        } catch (error: any) {
            toast.error(error.message || t('messages.errorOccurred'));
        }
    };

    const handleDelete = async (taskId: string) => {
        setTaskToDelete(taskId);
        setDeleteConfirmOpen(true);
    };

    const performDelete = async () => {
        if (!taskToDelete) return;
        try {
            await hospitalityAPI.deleteHousekeepingTask(taskToDelete);
            toast.success(t('messages.deleteSuccess'));
            setDeleteConfirmOpen(false);
            setTaskToDelete(null);
            fetchTasks();
        } catch (error: any) {
            toast.error(error.message || t('messages.errorOccurred'));
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'checkout_cleaning': return t('hotel_module.housekeeping.clean');
            case 'stay_cleaning': return t('hotel_module.housekeeping.inspect');
            case 'deep_cleaning': return t('hotel_module.rooms.statuses.dirty');
            case 'maintenance_prep': return t('hotel_module.rooms.statuses.maintenance');
            default: return type;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'checkout_cleaning': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'stay_cleaning': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'deep_cleaning': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'maintenance_prep': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="warning">{t('hotel_module.housekeeping.status.pending')}</Badge>;
            case 'in_progress':
                return <Badge variant="info">{t('hotel_module.housekeeping.status.in_progress')}</Badge>;
            case 'completed':
                return <Badge variant="success">{t('hotel_module.housekeeping.status.completed')}</Badge>;
            case 'cancelled':
                return <Badge variant="danger">{t('common.cancel')}</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    const formatTime = (dateStr: string | null) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleTimeString(t('common.locale') === 'pt' ? 'pt-PT' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-lg">
                        <HiOutlineHome className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                            {t('hotel_module.housekeeping.title')}
                        </h3>
                        <p className="text-[10px] text-gray-500 font-medium">
                            {pendingTasks.length} {t('hotel_module.housekeeping.status.pending')} • {inProgressTasks.length} {t('hotel_module.housekeeping.status.in_progress')} • {completedTasks.length} {t('hotel_module.housekeeping.status.completed')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex gap-1 bg-gray-100 dark:bg-dark-900 rounded-lg p-1">
                        {['all', 'pending', 'in_progress', 'completed'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status as any)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filter === status
                                    ? 'bg-white dark:bg-dark-700 text-primary-600 shadow-sm border border-gray-200 dark:border-dark-600'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                {status === 'all' ? t('common.all')
                                    : t(`hotel_module.housekeeping.status.${status}`)}
                            </button>
                        ))}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchTasks}
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                    >
                        {t('common.refresh')}
                    </Button>
                </div>
            </div>

            {/* Tasks Grid */}
            {tasks.length === 0 ? (
                <EmptyState
                    title={t('common.noData')}
                    description={t('hotel_module.housekeeping.inspect')}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tasks.map((task) => (
                        <Card
                            key={task.id}
                            className={`p-4 hover:shadow-lg transition-all border-l-4 ${task.status === 'pending' ? 'border-l-amber-500'
                                : task.status === 'in_progress' ? 'border-l-blue-500'
                                    : 'border-l-green-500'
                                }`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-100 dark:bg-dark-700 rounded-lg">
                                        <HiOutlineHome className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-gray-900 dark:text-white">
                                            Q-{task.room.number}
                                        </h4>
                                        <p className="text-xs text-gray-500 capitalize">{t(`hotel_module.rooms.types.${task.room.type}`) || task.room.type}</p>
                                    </div>
                                </div>
                                {task.priority >= 2 && (
                                    <div className="p-1 bg-red-100 dark:bg-red-900/30 rounded-full" title="Alta Prioridade">
                                        <HiOutlineExclamationCircle className="w-4 h-4 text-red-600" />
                                    </div>
                                )}
                            </div>

                            {/* Type Badge */}
                            <div className="mb-3">
                                <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getTypeColor(task.type)}`}>
                                    {getTypeLabel(task.type)}
                                </span>
                            </div>

                            {/* Notes */}
                            {task.notes && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 italic">
                                    "{task.notes}"
                                </p>
                            )}

                            {/* Status & Time Info */}
                            <div className="flex items-center justify-between mb-4 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                    <HiOutlineClock className="w-3 h-3" />
                                    <span>{t('common.active')}: {formatTime(task.createdAt)}</span>
                                </div>
                                {getStatusBadge(task.status)}
                            </div>

                            {/* Assigned To */}
                            {task.assignedTo && (
                                <div className="flex items-center gap-2 mb-3 text-sm text-gray-600 dark:text-gray-400">
                                    <HiOutlineUser className="w-4 h-4" />
                                    <span>{task.assignedTo}</span>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-dark-700">
                                {task.status === 'pending' && (
                                    <Button
                                        size="sm"
                                        fullWidth
                                        onClick={() => handleStatusChange(task.id, 'in_progress')}
                                        leftIcon={<HiOutlinePlay className="w-4 h-4" />}
                                    >
                                        {t('common.save')}
                                    </Button>
                                )}
                                {task.status === 'in_progress' && (
                                    <Button
                                        size="sm"
                                        fullWidth
                                        variant="primary"
                                        onClick={() => handleStatusChange(task.id, 'completed')}
                                        leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                                    >
                                        {t('common.finished')}
                                    </Button>
                                )}
                                {task.status !== 'completed' && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(task.id)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </Button>
                                )}
                                {task.status === 'completed' && (
                                    <div className="flex-1 text-center text-xs text-green-600 font-bold py-2">
                                        ✅ {t('common.finished')} {formatTime(task.completedAt)}
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <ConfirmationModal
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setTaskToDelete(null);
                }}
                onConfirm={performDelete}
                title={t('common.confirm')}
                message={t('messages.confirmDelete')}
                confirmText={t('common.delete')}
                cancelText={t('common.cancel')}
                variant="danger"
            />
        </div>
    );
}
