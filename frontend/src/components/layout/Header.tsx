import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../../stores/useStore';
import { useAuthStore, roleLabels } from '../../stores/useAuthStore';
import {
    HiOutlineBars3,
    HiOutlineMoon,
    HiOutlineSun,
    HiOutlineArrowRightOnRectangle,
    HiOutlineUser,
    HiOutlineCog6Tooth,
    HiArrowPath,
} from 'react-icons/hi2';
import { MdCloudOff } from 'react-icons/md';
import LanguageSelector from '../common/LanguageSelector';
import { NotificationBadge } from '../notifications';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import GlobalSearch from './GlobalSearch';
import SyncQueuePanel from '../offline/SyncQueuePanel';
import { Button } from '../ui/Button';

export default function Header() {
    const navigate = useNavigate();
    const { theme, toggleTheme, toggleSidebar } = useStore();
    const { user, logout } = useAuthStore();
    const { isOnline, networkOnline, isSyncing, pendingCount, failedCount, queueLevel } = useOfflineSync();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showSyncPanel, setShowSyncPanel] = useState(false);
    const { t } = useTranslation();

    const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'Utilizador';
    const firstName = displayName.split(/\s+/)[0];
    const getUserInitials = (name: string) => {
        const parts = name.trim().split(/\s+/).filter(Boolean);
        const initials = parts.length > 1
            ? parts.slice(0, 2).map((part) => part[0]).join('')
            : parts[0]?.slice(0, 2) || 'U';

        return initials.toUpperCase();
    };

    const handleLogout = () => {
        setShowUserMenu(false);
        logout();
        navigate('/login');
    };

    return (
        <header className="sticky top-0 z-30 h-14 lg:h-16 bg-white dark:bg-dark-900/70 backdrop-blur-md border-b border-slate-300/70 dark:border-dark-800/50 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_26px_-24px_rgba(15,23,42,0.75)] transition-all duration-300">
            <div className="flex items-center justify-between h-full px-3 sm:px-4 lg:px-8 gap-2 sm:gap-4 max-w-[1600px] mx-auto">
                {/* Left Section */}
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    {/* Mobile Menu Toggle */}
                    <Button
                        onClick={toggleSidebar}
                        className="p-2.5 rounded-xl bg-white hover:bg-primary-50 dark:bg-transparent dark:hover:bg-primary-900/20 text-slate-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-all duration-200 ring-1 ring-slate-300 dark:ring-dark-700 hover:ring-primary-500/50 shadow-sm"
                        title="Menu"
                    >
                        <HiOutlineBars3 className="w-5 h-5" />
                    </Button>

                    {/* Global Search */}
                    <GlobalSearch />
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-1 sm:gap-2 lg:gap-3">
                    {/* Theme Toggle — hidden on smallest screens to save space */}
                    <Button variant="ghost"
                        onClick={toggleTheme}
                        className="hidden sm:flex p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-700 dark:text-gray-300 transition-all duration-200"
                        title={theme === 'light' ? t('settings.darkMode') : t('settings.lightMode')}
                    >
                        {theme === 'light' ? (
                            <HiOutlineMoon className="w-5 h-5" />
                        ) : (
                            <HiOutlineSun className="w-5 h-5 text-amber-500" />
                        )}
                    </Button>

                    {/* Language Selector */}
                    <div className="hidden md:block">
                        <LanguageSelector />
                    </div>

                    <div className="flex items-center">
                        {(pendingCount > 0 || failedCount > 0) ? (
                            <Button variant="ghost"
                                onClick={() => setShowSyncPanel(true)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                    failedCount > 0 || queueLevel === 'full' || queueLevel === 'critical'
                                        ? 'bg-red-100/60 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300'
                                        : 'bg-amber-100/50 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/20 dark:text-amber-300'
                                }`}
                                title={
                                    queueLevel === 'full' ? 'Fila offline cheia (500). Restaure a ligação para sincronizar.' :
                                    queueLevel === 'critical' ? 'Fila offline próxima do limite (>400). Restaure a ligação assim que possível.' :
                                    !networkOnline ? 'Offline - dados guardados localmente' :
                                    !isOnline ? 'Sem servidor - a tentar restabelecer ligação' :
                                    'Ver fila de sincronização'
                                }
                            >
                                <HiArrowPath className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">
                                    {failedCount > 0 ? `${failedCount} falhadas` : `${pendingCount} pendentes`}
                                </span>
                            </Button>
                        ) : (
                            <Button variant="ghost"
                                onClick={() => setShowSyncPanel(true)}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                    isOnline
                                        ? 'bg-emerald-100/60 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300'
                                        : !networkOnline
                                            ? 'bg-amber-100/60 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/20 dark:text-amber-300'
                                            : 'bg-orange-100/60 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/20 dark:text-orange-300'
                                }`}
                                title={
                                    isOnline ? 'Sistema online - clique para ver fila' :
                                    !networkOnline ? 'Sistema offline - dados salvos localmente' :
                                    'Sem servidor - a tentar restabelecer ligação'
                                }
                            >
                                {isOnline ? (
                                    <>
                                        <span className="relative inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(255,255,255,0.6)] dark:shadow-[0_0_0_2px_rgba(15,23,42,0.6)] animate-pulse"></span>
                                        <span className="hidden sm:inline">Sincronizado</span>
                                    </>
                                ) : (
                                    <>
                                        <MdCloudOff className="w-4 h-4 shrink-0" />
                                        <span className="hidden sm:inline">
                                            {!networkOnline ? 'Offline' : 'Sem servidor'}
                                        </span>
                                    </>
                                )}
                            </Button>
                        )}
                    </div>

                    {/* Notifications */}
                    <NotificationBadge />

                    {/* User Menu */}
                    <div className="relative">
                        <Button variant="ghost"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className={`flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition-all duration-200 ${
                                showUserMenu 
                                ? 'bg-primary-50 dark:bg-primary-900/20' 
                                : 'hover:bg-slate-100 dark:hover:bg-dark-800'
                            }`}
                        >
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-indigo-600 flex items-center justify-center shadow-sm shadow-primary-500/20 overflow-hidden">
                                <span className="text-white font-bold text-sm tracking-tighter">
                                    {getUserInitials(displayName)}
                                </span>
                            </div>
                            <div className="hidden md:block text-left">
                                <p className="text-xs font-bold text-gray-900 dark:text-white leading-none max-w-24 truncate">
                                    {firstName}
                                </p>
                            </div>
                        </Button>

                        {/* User Dropdown */}
                        {showUserMenu && (
                            <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-card-hover border border-slate-300/70 dark:border-dark-700/50 overflow-hidden animate-slide-up z-50">
                                <div className="p-4 bg-slate-50 dark:bg-dark-900 border-b border-slate-200 dark:border-dark-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-inner">
                                            {getUserInitials(displayName)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                {displayName}
                                            </p>
                                            <p className="text-xs text-slate-600 dark:text-gray-400 truncate mb-1">
                                                {user?.email || ''}
                                            </p>
                                            {user?.role && (
                                                <span className="inline-flex px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 ring-1 ring-primary-200 dark:ring-primary-800">
                                                    {roleLabels[user.role]}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-2">
                                    <Link
                                        to="/settings"
                                        onClick={() => setShowUserMenu(false)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/10 hover:text-primary-600 dark:hover:text-primary-400 rounded-xl transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center group-hover:bg-white dark:group-hover:bg-dark-600 transition-colors">
                                            <HiOutlineUser className="w-4 h-4" />
                                        </div>
                                        {t('auth.myProfile')}
                                    </Link>
                                    <Link
                                        to="/settings"
                                        onClick={() => setShowUserMenu(false)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/10 hover:text-primary-600 dark:hover:text-primary-400 rounded-xl transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center group-hover:bg-white dark:group-hover:bg-dark-600 transition-colors">
                                            <HiOutlineCog6Tooth className="w-4 h-4" />
                                        </div>
                                        {t('nav.settings')}
                                    </Link>
                                    <div className="my-2 border-t border-gray-100 dark:border-dark-700" />
                                    <Button variant="danger"
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                                            <HiOutlineArrowRightOnRectangle className="w-4 h-4" />
                                        </div>
                                        {t('auth.logout')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showUserMenu && (
                <div
                    className="fixed inset-0"
                    style={{ zIndex: 40 }}
                    onClick={() => setShowUserMenu(false)}
                />
            )}

            <SyncQueuePanel open={showSyncPanel} onClose={() => setShowSyncPanel(false)} />
        </header>
    );
}
