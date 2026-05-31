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
    HiOutlineCloud,
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
                    {/* Theme Toggle */}
                    <Button variant="ghost"
                        onClick={toggleTheme}
                        className="flex p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-700 dark:text-gray-300 transition-all duration-200"
                        title={theme === 'light' ? t('settings.darkMode') : t('settings.lightMode')}
                    >
                        {theme === 'light' ? (
                            <HiOutlineMoon className="w-5 h-5" />
                        ) : (
                            <HiOutlineSun className="w-5 h-5 text-amber-500" />
                        )}
                    </Button>

                    {/* Language Selector */}
                    <LanguageSelector />

                    {/* Sync Status */}
                    {(pendingCount > 0 || failedCount > 0) ? (
                        <div className="relative">
                            <Button variant="ghost"
                                onClick={() => setShowSyncPanel(true)}
                                className={`relative p-2.5 rounded-xl transition-all duration-300 hover:scale-105
                                    ${failedCount > 0 || queueLevel === 'full' || queueLevel === 'critical'
                                        ? 'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20'
                                        : 'text-amber-500 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/20'
                                    }`}
                                title={
                                    queueLevel === 'full' ? 'Fila offline cheia (500). Restaure a ligação para sincronizar.' :
                                    queueLevel === 'critical' ? 'Fila offline próxima do limite (>400). Restaure a ligação assim que possível.' :
                                    failedCount > 0 ? `${failedCount} sincronizações falhadas` : `${pendingCount} sincronizações pendentes`
                                }
                            >
                                <HiArrowPath className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                            </Button>
                            <span
                                className={`pointer-events-none absolute -top-1 -right-1 min-w-[18px] h-[18px]
                                    flex items-center justify-center text-[9px] font-black text-white
                                    rounded-full px-1 ring-2 ring-white dark:ring-dark-900 shadow-md z-10
                                    ${failedCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}
                            >
                                {failedCount > 0 ? failedCount : pendingCount}
                            </span>
                        </div>
                    ) : (
                        <Button variant="ghost"
                            onClick={() => setShowSyncPanel(true)}
                            className={`relative p-2.5 rounded-xl transition-all duration-300 hover:scale-105
                                ${isOnline
                                    ? 'text-emerald-500 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/20'
                                    : !networkOnline
                                        ? 'text-amber-500 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/20'
                                        : 'text-orange-500 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/20'
                                }`}
                            title={
                                isOnline ? 'Sistema online (Sincronizado)' :
                                !networkOnline ? 'Sistema offline - dados salvos localmente' :
                                'Sem servidor - a tentar restabelecer ligação'
                            }
                        >
                            {isOnline ? (
                                <HiOutlineCloud className="w-5 h-5 shrink-0" />
                            ) : (
                                <MdCloudOff className="w-5 h-5 shrink-0" />
                            )}
                        </Button>
                    )}

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
                            <div className="absolute right-0 mt-3 sm:mt-4 w-[calc(100vw-24px)] sm:w-80 max-w-[320px] bg-white dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-slate-200/80 dark:border-dark-700/50 overflow-hidden origin-top-right animate-in fade-in zoom-in-95 duration-200 z-50">
                                <div className="p-4 sm:p-5 bg-gradient-to-b from-slate-50 to-white dark:from-dark-900/80 dark:to-dark-800/40 border-b border-slate-200 dark:border-dark-700">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white text-lg sm:text-xl font-black shadow-inner shadow-white/20 ring-4 ring-primary-50 dark:ring-primary-900/20">
                                            {getUserInitials(displayName)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-base font-bold text-gray-900 dark:text-white truncate">
                                                {displayName}
                                            </p>
                                            <p className="text-xs font-medium text-slate-500 dark:text-gray-400 truncate mb-1.5">
                                                {user?.email || ''}
                                            </p>
                                            {user?.role && (
                                                <span className="inline-flex px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 ring-1 ring-primary-200 dark:ring-primary-800/80">
                                                    {roleLabels[user.role]}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-2 sm:p-3 space-y-1">
                                    <Link
                                        to="/settings"
                                        onClick={() => setShowUserMenu(false)}
                                        className="group w-full flex items-center gap-3 px-3 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-400 rounded-xl transition-all"
                                    >
                                        <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 dark:bg-dark-700 flex items-center justify-center group-hover:bg-white dark:group-hover:bg-dark-600 group-hover:shadow-sm transition-all">
                                            <HiOutlineUser className="w-5 h-5 text-slate-500 group-hover:text-primary-600 dark:text-slate-400 dark:group-hover:text-primary-400" />
                                        </div>
                                        <span className="flex-1 text-left">{t('auth.myProfile')}</span>
                                    </Link>
                                    <Link
                                        to="/settings"
                                        onClick={() => setShowUserMenu(false)}
                                        className="group w-full flex items-center gap-3 px-3 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-400 rounded-xl transition-all"
                                    >
                                        <div className="w-9 h-9 shrink-0 rounded-xl bg-slate-100 dark:bg-dark-700 flex items-center justify-center group-hover:bg-white dark:group-hover:bg-dark-600 group-hover:shadow-sm transition-all">
                                            <HiOutlineCog6Tooth className="w-5 h-5 text-slate-500 group-hover:text-primary-600 dark:text-slate-400 dark:group-hover:text-primary-400" />
                                        </div>
                                        <span className="flex-1 text-left">{t('nav.settings')}</span>
                                    </Link>
                                    <div className="my-2 border-t border-slate-100 dark:border-dark-700/80 mx-2" />
                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        className="group w-full flex items-center gap-3 px-3 py-3 text-sm font-black text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all outline-none focus:ring-2 focus:ring-red-500/20"
                                    >
                                        <div className="w-9 h-9 shrink-0 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center group-hover:bg-white dark:group-hover:bg-red-900/50 group-hover:shadow-sm transition-all">
                                            <HiOutlineArrowRightOnRectangle className="w-5 h-5 text-red-500 dark:text-red-400" />
                                        </div>
                                        <span className="flex-1 text-left tracking-wide uppercase text-xs">{t('auth.logout')}</span>
                                    </button>
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
