import { useTranslation } from 'react-i18next';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { HiOutlineGlobeAlt } from 'react-icons/hi';
import { MdCloudDone, MdCloudOff } from 'react-icons/md';

export default function Footer() {
    const { t } = useTranslation();
    const { settings } = useCompanySettings();
    const { isOnline } = useOfflineSync();
    const currentYear = new Date().getFullYear();

    return (
        <footer className="py-2.5 px-4 lg:px-6 bg-white dark:bg-dark-800 border-t border-gray-200 dark:border-dark-700 transition-colors duration-200">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                        {settings?.companyName || 'Sistema'}
                    </span>
                    <span className="text-gray-300 dark:text-dark-600">|</span>
                    <span className="flex items-center gap-1">
                        <HiOutlineGlobeAlt className="w-3 h-3 text-primary-500" />
                        Moçambique
                    </span>
                    <span className="hidden sm:inline text-gray-300 dark:text-dark-600">|</span>
                    <span className="font-medium">v1.0.5</span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        {isOnline ? (
                            <span className="flex items-center gap-1 text-emerald-500 font-bold uppercase tracking-tighter">
                                <MdCloudDone className="w-3.5 h-3.5" />
                                Online
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-amber-500 font-bold uppercase tracking-tighter">
                                <MdCloudOff className="w-3.5 h-3.5" />
                                Offline
                            </span>
                        )}
                    </div>
                    <span className="hidden sm:inline text-gray-300 dark:text-dark-600">|</span>
                    <p>
                        © {currentYear} {t('footer.allRightsReserved', 'Todos os direitos reservados.')}
                    </p>
                </div>
            </div>
        </footer>
    );
}
