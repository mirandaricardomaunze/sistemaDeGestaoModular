import { Card, Badge } from '../ui';
import { LoadingSpinner, EmptyState } from '../ui';
import { HiOutlineClock, HiOutlineUser, HiOutlineTag, HiOutlineCash } from 'react-icons/hi';
import { formatCurrency, formatDate } from '../../utils/helpers';

interface HospitalityHistoryProps {
    history: any[];
    isLoading: boolean;
}

export default function HospitalityHistory({ history, isLoading }: HospitalityHistoryProps) {
    if (isLoading) return <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>;

    if (!history || history.length === 0) {
        return (
            <EmptyState
                title="Sem histórico de reservas"
                description="Não foram encontradas reservas ou estadias concluídas."
                icon={<HiOutlineClock className="w-12 h-12 text-gray-300" />}
            />
        );
    }

    return (
        <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-800/50">
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hóspede / Quarto</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Período</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Valor Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                        {history.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-dark-700/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                            <HiOutlineUser className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white capitalize">{item.customerName || 'Hóspede Desconhecido'}</p>
                                            <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">Quarto {item.room?.number}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm">
                                        <p className="text-gray-900 dark:text-white font-medium">{formatDate(item.checkIn)}</p>
                                        <p className="text-gray-500 dark:text-gray-400 text-xs">até {item.checkOut ? formatDate(item.checkOut) : 'Em aberto'}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant={item.status === 'completed' ? 'success' : 'warning'}>
                                        {item.status === 'completed' ? 'CONCLUÍDO' : item.status.toUpperCase()}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(item.totalPrice || 0)}</p>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-tight">Venda #{item.saleId || 'N/A'}</p>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
