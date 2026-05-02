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

export default function Header() {
    const navigate = useNavigate();
    const { theme, toggleTheme, toggleSidebar } = useStore();
    const { user, logout } = useAuthStore();
    const { isOnline, isSyncing, pendingCount, failedCount } = useOfflineSync();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showSyncPanel, setShowSyncPanel] = useState(false);
    const { t } = useTranslation();

    const getUserInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    const handleLogout = () => {
        setShowUserMenu(false);
        logout();
        navigate('/login');
    };

    return (
        <header className="sticky top-0 z-30 h-16 bg-white/70 dark:bg-dark-900/70 backdrop-blur-md border-b border-gray-200/50 dark:border-dark-800/50 transition-all duration-300">
            <div className="flex items-center justify-between h-full px-4 lg:px-8 gap-4 max-w-[1600px] mx-auto">
                {/* Left Section */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={toggleSidebar}
                        className="p-2.5 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-all duration-300 ring-1 ring-gray-200 dark:ring-dark-700 hover:ring-primary-500/50 shadow-sm hover:shadow-md"
                        title="Menu"
                    >
                        <HiOutlineBars3 className="w-5 h-5" />
                    </button>

                    {/* Global Search */}
                    <GlobalSearch />
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-3 lg:gap-4">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-dark-800 text-gray-600 dark:text-gray-300 transition-all duration-300 hover:rotate-12 ring-1 ring-gray-200/50 dark:ring-dark-700/50 shadow-sm"
                        title={theme === 'light' ? t('settings.darkMode') : t('settings.lightMode')}
                    >
                        {theme === 'light' ? (
                            <HiOutlineMoon className="w-5 h-5" />
                        ) : (
                            <HiOutlineSun className="w-5 h-5 text-amber-500" />
                        )}
                    </button>

                    {/* Language Selector */}
                    <div className="hidden md:block">
                        <LanguageSelector />
                    </div>

                    <div className="flex items-center">
                        {(pendingCount > 0 || failedCount > 0) ? (
                            <button
                                onClick={() => setShowSyncPanel(true)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ring-1 hover:scale-105 active:scale-95 ${
                                    failedCount > 0
                                        ? 'bg-red-100/60 text-red-700 hover:bg-red-200 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-900/40'
                                        : 'bg-amber-100/50 text-amber-700 hover:bg-amber-200 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-900/40'
                                }`}
                                title={isOnline ? 'Ver fila de sincronização' : 'Offline — dados guardados localmente'}
                            >
                                <HiArrowPath className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">
                                    {failedCount > 0 ? `${failedCount} falhadas` : `${pendingCount} pendentes`}
                                </span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowSyncPanel(true)}
                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all ring-1 ${isOnline
                                    ? 'text-emerald-500 bg-emerald-50/50 ring-emerald-100/50 dark:bg-emerald-900/10 dark:ring-emerald-900/20 hover:bg-emerald-100/50'
                                    : 'text-amber-500 bg-amber-50 ring-amber-100 dark:bg-amber-900/20 dark:ring-amber-900/40 hover:bg-amber-100'
                                    }`}
                                title={isOnline ? 'Sistema Online — clique para ver fila' : 'Sistema Offline — dados salvos localmente'}
                            >
                                {isOnline ? (
                                    <>
                                        <div className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase hidden lg:inline tracking-widest opacity-80">Online</span>
                                    </>
                                ) : (
                                    <>
                                        <MdCloudOff className="w-4 h-4" />
                                        <span className="text-[10px] font-bold uppercase hidden lg:inline tracking-widest opacity-80">Offline</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Notifications */}
                    <NotificationBadge />

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className={`flex items-center gap-2 p-1 rounded-xl transition-all duration-300 ring-1 ${
                                showUserMenu 
                                ? 'bg-primary-50 ring-primary-200 dark:bg-primary-900/20 dark:ring-primary-800' 
                                : 'hover:bg-gray-100 dark:hover:bg-dark-800 ring-gray-200/50 dark:ring-dark-700/50'
                            }`}
                        >
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-primary-500/20 overflow-hidden">
                                <span className="text-white font-bold text-sm tracking-tighter">
                                    {user ? getUserInitials(user.name) : 'U'}
                                </span>
                            </div>
                            <div className="hidden sm:block text-left mr-1">
                                <p className="text-xs font-bold text-gray-900 dark:text-white leading-none mb-0.5">
                                    {user?.name.split(' ')[0] || 'Utilizador'}
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-none">
                                    Painel
                                </p>
                            </div>
                        </button>

                        {/* User Dropdown */}
                        {showUserMenu && (
                            <div className="absolute right-0 mt-3 w-64 bg-white/95 dark:bg-dark-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-dark-700/50 overflow-hidden animate-slide-up z-50">
                                <div className="p-4 bg-gradient-to-br from-gray-50 to-white dark:from-dark-800 dark:to-dark-900 border-b border-gray-100 dark:border-dark-700">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-inner">
                                            {user ? getUserInitials(user.name) : 'U'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                                {user?.name || 'Utilizador'}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">
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
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                                            <HiOutlineArrowRightOnRectangle className="w-4 h-4" />
                                        </div>
                                        {t('auth.logout')}
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
