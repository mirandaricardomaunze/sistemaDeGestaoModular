import { useTranslation } from 'react-i18next';
import AlertSystem from '../components/alerts/AlertSystem';

export default function Alerts() {
    const { t } = useTranslation();
    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t('alerts.title')}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    {t('alerts.description')}
                </p>
            </div>

            {/* Alert System */}
            <AlertSystem />
        </div>
    );
}
