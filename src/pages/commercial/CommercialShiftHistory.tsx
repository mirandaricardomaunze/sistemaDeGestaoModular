import React, { useState, useEffect } from 'react';
import { 
    HiOutlineClock,
    HiOutlineArrowDownTray,
    HiOutlinePrinter, 
    HiOutlineEye, 
    HiOutlineCheckCircle, 
    HiOutlineXCircle,
    HiOutlineUser,
    HiOutlineArrowTrendingUp,
    HiOutlineArrowTrendingDown,
    HiOutlineCurrencyDollar,
    HiOutlineArrowPath,
    HiOutlineCalculator
} from 'react-icons/hi2';
import { shiftAPI, type ShiftSession as CashSession } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Card, Badge } from '../../components/ui';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn, formatCurrency } from '../../utils/helpers';
import { CommercialShiftDetailsModal } from '../../components/commercial/pos/CommercialShiftDetailsModal';
import { logger } from '../../utils/logger';

const CommercialShiftHistory: React.FC = () => {
    const [sessions, setSessions] = useState<CashSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ 
        start: format(new Date(), 'yyyy-MM-01'), 
        end: format(new Date(), 'yyyy-MM-dd') 
    });

    const [selectedSession, setSelectedSession] = useState<CashSession | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const response = await shiftAPI.getHistory({
                startDate: dateRange.start,
                endDate: dateRange.end
            });
            const sessionsData = response?.data || (Array.isArray(response) ? response : []);
            setSessions(sessionsData);
        } catch (error) {
            toast.error('Erro ao carregar histórico de turnos');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (session: CashSession) => {
        setSelectedSession(session);
        setShowDetailsModal(true);
    };

    const handlePrintZReport = (session: CashSession) => {
        toast.success(`Relatório Z gerado para o turno de ${session.openedBy?.name}`);
        // Mock print logic similar to ReceiptModal
        logger.debug('Printing Z-Report for shift:', session.id);
    };

    const getStatusBadge = (session: CashSession) => {
        const diff = Number(session.difference || 0);
        
        if (Math.abs(diff) < 0.01) {
            return (
                <Badge variant="success" className="text-[9px] font-black uppercase px-2 py-0.5 border-none bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <HiOutlineCheckCircle className="w-3 h-3 mr-1" />
                    Sem Quebras
                </Badge>
            );
        } else if (diff > 0) {
            return (
                <Badge variant="info" className="text-[9px] font-black uppercase px-2 py-0.5 border-none bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <HiOutlineArrowTrendingUp className="w-3 h-3 mr-1" />
                    Sobra: {formatCurrency(diff)}
                </Badge>
            );
        } else {
            return (
                <Badge variant="danger" className="text-[9px] font-black uppercase px-2 py-0.5 border-none bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    <HiOutlineArrowTrendingDown className="w-3 h-3 mr-1" />
                    Falta: {formatCurrency(Math.abs(diff))}
                </Badge>
            );
        }
    };

    return (
        <div className="space-y-4 animate-fade-in pb-10">
            {/* Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white dark:bg-dark-900 p-6 rounded-lg border border-gray-100 dark:border-dark-700 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-lg bg-indigo-600/10 flex items-center justify-center">
                            <HiOutlineCalculator className="text-indigo-600 w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                            Historial de Turnos
                        </h2>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Controlo de fecho de caixa, suprimentos e performance de operadores</p>
                </div>
                
                <div className="flex items-center gap-2 relative z-10">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={loadHistory} 
                        className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-indigo-600"
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                    >
                        Actualizar
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm"
                        className="rounded-lg border-gray-100 dark:border-dark-700 font-bold text-xs"
                    >
                        <HiOutlineArrowDownTray className="w-4 h-4 mr-2" />
                        Exportar
                    </Button>
                </div>
            </div>

            {/* High Density Filters */}
            <Card padding="md" className="border-none shadow-none bg-gray-100/50 dark:bg-dark-800/50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 block mb-1.5 uppercase tracking-widest pl-1">Operador</label>
                        <div className="relative group">
                            <HiOutlineUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Filtrar por nome..."
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-900 border-none shadow-sm rounded-lg text-gray-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 block mb-1.5 uppercase tracking-widest pl-1">Início</label>
                        <input 
                            type="date" 
                            className="w-full px-4 py-2 bg-white dark:bg-dark-900 border-none shadow-sm rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 block mb-1.5 uppercase tracking-widest pl-1">Fim</label>
                        <input 
                            type="date" 
                            className="w-full px-4 py-2 bg-white dark:bg-dark-900 border-none shadow-sm rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                        />
                    </div>
                    <Button onClick={loadHistory} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-10 font-black uppercase text-[10px] tracking-widest">
                        Processar Filtros
                    </Button>
                </div>
            </Card>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total em Caixa', val: sessions.reduce((acc, s) => acc + Number(s.closingBalance || 0), 0), icon: HiOutlineCurrencyDollar, color: 'text-green-500', bg: 'bg-green-500/10' },
                    { label: 'Total Suprimentos', val: sessions.reduce((acc, s) => acc + Number(s.deposits || 0), 0), icon: HiOutlineArrowTrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                    { label: 'Total Sangrias', val: sessions.reduce((acc, s) => acc + Number(s.withdrawals || 0), 0), icon: HiOutlineArrowTrendingDown, color: 'text-red-500', bg: 'bg-red-500/10' },
                    { label: 'Discrepâncias', val: sessions.reduce((acc, s) => acc + Number(s.difference || 0), 0), icon: HiOutlineXCircle, color: sessions.reduce((acc, s) => acc + Number(s.difference || 0), 0) < 0 ? 'text-red-500' : 'text-emerald-500', bg: sessions.reduce((acc, s) => acc + Number(s.difference || 0), 0) < 0 ? 'bg-red-500/10' : 'bg-emerald-500/10' }
                ].map((stat, i) => (
                    <Card key={i} padding="md" className="border-gray-100 dark:border-dark-700/50 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                            <div className={cn("p-2.5 rounded-lg shrink-0", stat.bg)}>
                                <stat.icon className={cn("w-5 h-5", stat.color)} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">{stat.label}</p>
                                <p className={cn("text-lg font-black tracking-tighter truncate", i === 3 ? stat.color : "text-gray-900 dark:text-white")}>
                                    {formatCurrency(stat.val)}
                                </p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Main Data Table */}
            <Card padding="none" className="overflow-hidden border-gray-100 dark:border-dark-700 shadow-xl shadow-black/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="text-[10px] text-gray-400 border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-900/50 uppercase tracking-[0.2em] font-black">
                                <th className="px-6 py-4 text-left">Sessão (Abertura/Fecho)</th>
                                <th className="px-6 py-4 text-left">Responsável</th>
                                <th className="px-6 py-4 text-right">Fundo / Vendas</th>
                                <th className="px-6 py-4 text-right">Saldo Final</th>
                                <th className="px-6 py-4 text-center">Auditoria</th>
                                <th className="px-6 py-4 text-right pr-10">Acções</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Sincronizando Turnos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : sessions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <HiOutlineClock className="w-16 h-16 text-gray-300" />
                                            <p className="text-sm font-bold uppercase tracking-widest">Sem registos de turnos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sessions.map((session) => (
                                    <tr key={session.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group">
                                        <td className="px-6 py-4 font-mono">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-gray-900 dark:text-white">
                                                    {format(new Date(session.openedAt), "dd MMM yy, HH:mm", { locale: ptBR }).toUpperCase()}
                                                </span>
                                                {session.closedAt ? (
                                                    <span className="text-[9px] text-gray-400 font-bold uppercase">
                                                        FECHADO ÀS {format(new Date(session.closedAt), "HH:mm", { locale: ptBR })}
                                                    </span>
                                                ) : (
                                                    <Badge variant="warning" className="text-[8px] mt-1 w-fit px-1.5 py-0">EM ABERTO</Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase">
                                                    {session.openedBy?.name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase truncate">
                                                        {session.openedBy?.name}
                                                    </span>
                                                    <span className="text-[9px] text-gray-400 font-medium">OP #{(session.id as string).slice(-4).toUpperCase()}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs font-black text-gray-700 dark:text-gray-300">{formatCurrency(session.openingBalance)}</span>
                                                <span className="text-[10px] font-black text-emerald-500 tracking-tighter">+{formatCurrency(session.totalSales)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                                                    {formatCurrency(session.closingBalance || 0)}
                                                </span>
                                                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{session._count?.sales || 0} VENDAS</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {getStatusBadge(session)}
                                        </td>
                                        <td className="px-6 py-4 pr-10">
                                            <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleViewDetails(session)}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all shadow-sm active:scale-95"
                                                    title="Ver Detalhes do Turno"
                                                >
                                                    <HiOutlineEye className="w-5 h-5" />
                                                </button>
                                                <button 
                                                    onClick={() => handlePrintZReport(session)}
                                                    className="p-2 text-gray-500 hover:bg-gray-800 hover:text-white rounded-lg transition-all shadow-sm active:scale-95"
                                                    title="Re-imprimir Relatório Z"
                                                >
                                                    <HiOutlinePrinter className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <CommercialShiftDetailsModal 
                isOpen={showDetailsModal}
                session={selectedSession}
                onClose={() => setShowDetailsModal(false)}
                onPrint={() => selectedSession && handlePrintZReport(selectedSession)}
            />
        </div>
    );
};

export default CommercialShiftHistory;
