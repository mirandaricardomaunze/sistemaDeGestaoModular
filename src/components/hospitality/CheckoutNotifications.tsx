/**
 * CheckoutNotifications Component
 * Shows alerts for today's expected checkouts with quick actions
 */

import { useState, useEffect } from 'react';
import { Card, Button, Badge } from '../ui';
import { hospitalityAPI } from '../../services/api';
import {
    HiOutlineBell,
    HiOutlineLogout,
    HiOutlineUser,
    HiOutlineHome,
    HiOutlineChevronDown,
    HiOutlineChevronUp
} from 'react-icons/hi';

interface CheckoutBooking {
    id: string;
    customerName: string;
    expectedCheckout: string;
    room: {
        id: string;
        number: string;
        type: string;
    };
    consumptions: any[];
}

interface CheckoutNotificationsProps {
    onViewGuest?: (bookingId: string) => void;
    onCheckout?: (bookingId: string) => void;
}

export default function CheckoutNotifications({ onViewGuest, onCheckout }: CheckoutNotificationsProps) {
    const [checkouts, setCheckouts] = useState<CheckoutBooking[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCheckouts = async () => {
            try {
                const data = await hospitalityAPI.getTodayCheckouts();
                setCheckouts(data);
            } catch (error) {
                console.error('Failed to fetch today checkouts:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCheckouts();
        // Refresh every 5 minutes
        const interval = setInterval(fetchCheckouts, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (isLoading || checkouts.length === 0) {
        return null;
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800 p-4">
            {/* Header */}
            <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-lg animate-pulse">
                        <HiOutlineBell className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200 uppercase tracking-tight">
                            Check-outs Hoje
                        </h3>
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                            {checkouts.length} quarto{checkouts.length > 1 ? 's' : ''} com saída prevista
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant="warning" className="font-bold">
                        {checkouts.length}
                    </Badge>
                    {isExpanded ? (
                        <HiOutlineChevronUp className="w-5 h-5 text-amber-600" />
                    ) : (
                        <HiOutlineChevronDown className="w-5 h-5 text-amber-600" />
                    )}
                </div>
            </div>

            {/* Expanded List */}
            {isExpanded && (
                <div className="mt-4 space-y-2 border-t border-amber-200 dark:border-amber-800 pt-4">
                    {checkouts.map((booking) => (
                        <div
                            key={booking.id}
                            className="flex items-center justify-between bg-white dark:bg-dark-800 p-3 rounded-lg shadow-sm border border-amber-100 dark:border-dark-700"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 dark:bg-dark-700 rounded-lg">
                                    <HiOutlineHome className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            Q-{booking.room.number}
                                        </span>
                                        <span className="text-xs text-gray-500 capitalize">
                                            ({booking.room.type})
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <HiOutlineUser className="w-3 h-3" />
                                        <span>{booking.customerName}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-amber-600 font-medium">
                                    Previsto: {formatTime(booking.expectedCheckout)}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onViewGuest?.(booking.id)}
                                    title="Ver Detalhes"
                                >
                                    <HiOutlineUser className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => onCheckout?.(booking.id)}
                                    leftIcon={<HiOutlineLogout className="w-4 h-4" />}
                                >
                                    Check-out
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
