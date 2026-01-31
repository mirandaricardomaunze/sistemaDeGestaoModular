import { useTranslation } from 'react-i18next';
import POSInterface from '../components/pos/POSInterface';

export default function POS() {
    const { t } = useTranslation();
    return (
        <div className="flex-1 flex flex-col gap-3 min-h-0 p-4 overflow-hidden bg-gray-100 dark:bg-dark-900">
            {/* Page Header */}
            <div className="flex-shrink-0">
                <h1 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    {t('pos.title')}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('pos.description')}
                </p>
            </div>

            {/* POS Interface */}
            <div className="flex-1 min-h-0 flex flex-col">
                <POSInterface />
            </div>
        </div>
    );
}
