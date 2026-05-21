import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';
import {
    HiOutlineBellAlert,
    HiOutlineShoppingCart,
    HiOutlineExclamationTriangle,
    HiOutlineDocumentPlus,
    HiOutlineUserPlus,
    HiOutlineReceiptRefund,
    HiOutlineCurrencyDollar,
    HiOutlineSparkles,
    HiOutlineLightBulb,
    HiOutlineCalendar
} from 'react-icons/hi2';
import React from 'react';
import { playCalendarChime } from '../utils/sound';

export const useNotifications = () => {
    const { socket, isConnected } = useSocket();

    useEffect(() => {
        if (!socket) return;

        // Generic/System Notifications
        socket.on('notification:new', (data) => {
            toast(data.message, {
                icon: React.createElement(HiOutlineBellAlert, { className: 'text-primary-500 w-5 h-5' }),
                duration: 5000,
            });
        });

        // Restaurant: New Orders
        socket.on('restaurant:new_order', (data) => {
            toast(`Novo Pedido no Restaurante! Mesa: ${data.table || 'Takeaway'}`, {
                icon: React.createElement(HiOutlineShoppingCart, { className: 'text-rose-500 w-5 h-5' }),
                duration: 6000,
            });
        });

        // Inventory: Low Stock
        socket.on('inventory:low_stock', (data) => {
            toast(`Stock Crítico: ${data.productName || data.message}`, {
                icon: React.createElement(HiOutlineExclamationTriangle, { className: 'text-amber-500 w-5 h-5' }),
                duration: 7000,
            });
        });

        // Logistics: Incidents
        socket.on('logistics:incident', (data) => {
            toast(`Incidente Reportado: ${data.type || data.message}`, {
                icon: React.createElement(HiOutlineExclamationTriangle, { className: 'text-orange-500 w-5 h-5' }),
                duration: 8000,
            });
        });

        // Pharmacy: New Prescription
        socket.on('pharmacy:new_prescription', (data) => {
            toast(`Nova Receita: ${data.patientName}`, {
                icon: React.createElement(HiOutlineDocumentPlus, { className: 'text-teal-500 w-5 h-5' }),
                duration: 6000,
            });
        });

        // Pharmacy: Narcotic/Controlled Alert
        socket.on('pharmacy:narcotic_alert', (data) => {
            toast(data.message, {
                icon: React.createElement(HiOutlineBellAlert, { className: 'text-purple-600 w-5 h-5 animate-pulse' }),
                duration: 9000,
            });
        });

        // Bottle Store: Returns/Deposits
        socket.on('bottlestore:bottle_update', (data) => {
            const label = data.type === 'deposit' ? 'Depósito' : 'Devolução';
            toast(`${label} de Vasilhames Registado`, {
                icon: React.createElement(HiOutlineReceiptRefund, { className: 'text-indigo-500 w-5 h-5' }),
                duration: 5000,
            });
        });

        // HR: New Employee
        socket.on('hr:new_employee', (data) => {
            toast(`Novo Funcionário: ${data.name}`, {
                icon: React.createElement(HiOutlineUserPlus, { className: 'text-cyan-600 w-5 h-5' }),
                duration: 6000,
            });
        });

        // CRM: New Opportunity
        socket.on('crm:new_opportunity', (data) => {
            toast(`Nova Oportunidade: ${data.title}`, {
                icon: React.createElement(HiOutlineLightBulb, { className: 'text-yellow-500 w-5 h-5' }),
                duration: 6000,
            });
        });

        // Payments: Successful Transaction
        socket.on('payment:success', (data) => {
            toast(`Pagamento Recebido: ${data.amount} MT (${data.module.toUpperCase()})`, {
                icon: React.createElement(HiOutlineCurrencyDollar, { className: 'text-emerald-500 w-5 h-5' }),
                duration: 7000,
            });
        });

        // AI: Analysis/Action Complete
        socket.on('ai:action_complete', (data) => {
            toast(`Análise IA Concluída: ${data.action}`, {
                icon: React.createElement(HiOutlineSparkles, { className: 'text-violet-500 w-5 h-5' }),
                duration: 6000,
            });
        });

        // Calendar: Event Reminder
        socket.on('calendar:reminder', (data) => {
            playCalendarChime();
            toast(
                `${data.title} — em ${data.minutesUntilStart} min`,
                {
                    icon: React.createElement(HiOutlineCalendar, { className: 'text-blue-500 w-5 h-5' }),
                    duration: 8000,
                }
            );
        });

        return () => {
            socket.off('notification:new');
            socket.off('restaurant:new_order');
            socket.off('inventory:low_stock');
            socket.off('logistics:incident');
            socket.off('pharmacy:new_prescription');
            socket.off('pharmacy:narcotic_alert');
            socket.off('bottlestore:bottle_update');
            socket.off('hr:new_employee');
            socket.off('crm:new_opportunity');
            socket.off('payment:success');
            socket.off('ai:action_complete');
            socket.off('calendar:reminder');
        };
    }, [socket]);

    return { isConnected };
};
