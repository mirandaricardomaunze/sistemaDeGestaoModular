
import { formatCurrency } from '../../../utils/helpers';
import { 
    HiOutlineXMark, 
    HiOutlineDocumentChartBar, 
    HiOutlinePrinter,
    HiOutlineCalendar,
    HiOutlineUser,
    HiOutlineArrowUpCircle, 
    HiOutlineArrowDownCircle, 
    HiOutlineExclamationTriangle, 
    HiOutlineCheckCircle
} from 'react-icons/hi2';
import type { ShiftSession } from '../../../services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../../ui';

interface CommercialShiftDetailsModalProps {
    isOpen: boolean;
    session: ShiftSession | null;
    onClose: () => void;
    onPrint?: () => void;
}

export function CommercialShiftDetailsModal({ isOpen, session, onClose, onPrint }: CommercialShiftDetailsModalProps) {
    if (!isOpen || !session) return null;

    const diff = Number(session.difference || 0);
    const expectedCash = Number(session.openingBalance) + Number(session.cashSales) + Number(session.deposits) - Number(session.withdrawals);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-dark-800 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                            <HiOutlineDocumentChartBar className="text-white w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-lg uppercase tracking-tight">Auditoria de Turno</h2>
                            <p className="text-white/50 text-[10px] uppercase font-bold tracking-widest leading-none">ID: #{session.id.slice(-6).toUpperCase()}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
                        <HiOutlineXMark className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto p-6 space-y-6">
                    {/* Top Info Bar */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-3 bg-gray-50 dark:bg-dark-900 rounded-lg border border-gray-100 dark:border-dark-700">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <HiOutlineUser className="w-3 h-3" /> Operador
                            </p>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{session.openedBy?.name}</p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-dark-900 rounded-lg border border-gray-100 dark:border-dark-700">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <HiOutlineCalendar className="w-3 h-3" /> Data
                            </p>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                                {format(new Date(session.openedAt), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-dark-900 rounded-lg border border-gray-100 dark:border-dark-700">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <HiOutlineArrowUpCircle className="w-3 h-3" /> Abertura
                            </p>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                {format(new Date(session.openedAt), "HH:mm", { locale: ptBR })}
                            </p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-dark-900 rounded-lg border border-gray-100 dark:border-dark-700">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <HiOutlineArrowDownCircle className="w-3 h-3" /> Fecho
                            </p>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                {session.closedAt ? format(new Date(session.closedAt), "HH:mm", { locale: ptBR }) : 'Sessão Aberta'}
                            </p>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Breakdown */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 italic">Fluxo de Caixa</h3>
                            <div className="bg-gray-50 dark:bg-dark-900/50 rounded-lg p-5 space-y-3 border border-gray-100 dark:border-dark-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500 font-medium italic">Fundo de Início</span>
                                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{formatCurrency(session.openingBalance)}</span>
                                </div>
                                <div className="flex justify-between items-center text-green-600">
                                    <span className="text-xs font-medium italic">Vendas (Dinheiro)</span>
                                    <span className="text-sm font-black">+ {formatCurrency(session.cashSales)}</span>
                                </div>
                                <div className="flex justify-between items-center text-blue-600">
                                    <span className="text-xs font-medium italic">Suprimentos</span>
                                    <span className="text-sm font-black">+ {formatCurrency(session.deposits)}</span>
                                </div>
                                <div className="flex justify-between items-center text-red-500">
                                    <span className="text-xs font-medium italic">Sangrias</span>
                                    <span className="text-sm font-black">- {formatCurrency(session.withdrawals)}</span>
                                </div>
                                <div className="pt-3 border-t border-gray-200 dark:border-dark-700 flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Esperado em Caixa</span>
                                    <span className="text-base font-black text-gray-900 dark:text-white">{formatCurrency(expectedCash)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Audit Part */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1 italic">Declaração & Auditoria</h3>
                            <div className="bg-gray-100/50 dark:bg-dark-900 rounded-lg p-5 space-y-3 border border-gray-200 dark:border-dark-700">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs text-gray-500 font-medium italic">Informado no Fecho</span>
                                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(session.closingBalance || 0)}</span>
                                </div>
                                
                                {session.closedAt && (
                                    <div className={`p-4 rounded-lg flex items-center justify-between ${Math.abs(diff) < 0.01 ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
                                        <div className="flex items-center gap-2">
                                            {Math.abs(diff) < 0.01 ? <HiOutlineCheckCircle className="w-5 h-5 text-green-600" /> : <HiOutlineExclamationTriangle className={`w-5 h-5 ${diff > 0 ? 'text-green-600' : 'text-red-500'}`} />}
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${Math.abs(diff) < 0.01 ? 'text-green-700 dark:text-green-500' : 'text-red-600 dark:text-red-400'}`}>
                                                {Math.abs(diff) < 0.01 ? 'Conferência Exacta' : diff > 0 ? 'Excedente de Caixa' : 'Diferença Negativa'}
                                            </span>
                                        </div>
                                        <span className={`text-sm font-black ${diff >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                            {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                                        </span>
                                    </div>
                                )}

                                <div className="pt-2 border-t border-gray-200 dark:border-dark-700 space-y-1.5">
                                     <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-gray-500 font-medium italic">M-Pesa</span>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">{formatCurrency(session.mpesaSales)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-gray-500 font-medium italic">Cartão (POS)</span>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">{formatCurrency(session.cardSales)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-gray-500 font-medium italic">Crédito</span>
                                        <span className="font-bold text-gray-700 dark:text-gray-300">{formatCurrency(session.creditSales)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-dark-800">
                                        <span className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">Total em Vendas</span>
                                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(session.totalSales)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Operations */}
                    <div className="bg-gray-50 dark:bg-dark-900/40 p-5 rounded-lg space-y-3">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 px-1 truncate">
                             Comentrios & Observações
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-medium pl-1 leading-relaxed italic">
                            {session.notes || 'Sem observações registadas para este turno.'}
                        </p>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-dark-900/50 border-t border-gray-100 dark:border-dark-700 flex gap-3">
                    <Button 
                        variant="outline" 
                        className="flex-1 rounded-lg font-black uppercase text-[10px] tracking-widest h-12"
                        onClick={onClose}
                    >
                        Fechar Visualização
                    </Button>
                    <Button 
                        className="flex-1 rounded-lg font-black uppercase text-[10px] tracking-widest h-12 flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/10"
                        onClick={onPrint}
                    >
                        <HiOutlinePrinter className="w-4 h-4" />
                        Imprimir Relatório Z
                    </Button>
                </div>
            </div>
        </div>
    );
}
