import { useTranslation } from 'react-i18next';
import { Card, Badge, TableContainer } from '../ui';
import { HiOutlineClock, HiOutlineUser } from 'react-icons/hi2';
import { formatCurrency, formatDate } from '../../utils/helpers';

interface HospitalityHistoryProps {
    history: any[];
    isLoading: boolean;
}

export default function HospitalityHistory({ history, isLoading }: HospitalityHistoryProps) {
    const { t } = useTranslation();
    const isEmpty = !isLoading && (!history || history.length === 0);

    return (
        <TableContainer
            isLoading={isLoading}
            isEmpty={isEmpty}
            minHeight="400px"
            emptyTitle={t('hotel_module.reservations.noData')}
            emptyDescription={t('hotel_module.reservations.searchPlaceholder')}
        >
            <Card padding="none" className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-800/50">
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('hotel_module.reservations.guest')}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('hotel_module.reservations.checkIn')} / {t('hotel_module.reservations.checkOut')}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">{t('common.status')}</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">{t('hotel_module.finance.revenue')}</th>
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
                                                <p className="font-bold text-gray-900 dark:text-white capitalize">{item.customerName || t('common.noData')}</p>
                                                <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">{t('hotel_module.rooms.types.single')} {item.room?.number}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm">
                                            <p className="text-gray-900 dark:text-white font-medium">{formatDate(item.checkIn)}</p>
                                            <p className="text-gray-500 dark:text-gray-400 text-xs">{item.checkOut ? formatDate(item.checkOut) : t('common.active')}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant={item.status === 'completed' ? 'success' : 'warning'}>
                                            {item.status === 'completed' ? t('common.finished') : t(`hotel_module.rooms.statuses.${item.status}`) || item.status.toUpperCase()}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(item.totalPrice || 0)}</p>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-tight">{t('commercial.sales.receipt')} #{item.saleId || 'N/A'}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </TableContainer>
    );
}

