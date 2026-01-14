import { useTranslation } from 'react-i18next';
import POSInterface from '../components/pos/POSInterface';

export default function POS() {
    const { t } = useTranslation();
    return (
        <div className="flex-1 flex flex-col space-y-4 min-h-0">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t('pos.title')}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    {t('pos.description')}
                </p>
            </div>

            {/* POS Interface */}
            <div className="flex-1 min-h-0">
                <POSInterface />
            </div>
        </div>
    );
}
