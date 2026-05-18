import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useStore } from '../../stores/useStore';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import { useEffect, Suspense, lazy, useMemo, useState } from 'react';
import { LoadingOverlay } from '../ui/Loading';
import { PageTransitionLoader } from '../ui/PageTransitionLoader';
import { HiOutlineSparkles } from 'react-icons/hi2';

import { useLocation } from 'react-router-dom';

const ChatWidget = lazy(() => import('../chat/ChatWidget'));

function ChatWidgetLauncher() {
    const [isLoaded, setIsLoaded] = useState(false);
    const location = useLocation();
    const isCommercialInsightsPage = useMemo(
        () => /^\/commercial\/(dashboard|reports|margins|insights)/.test(location.pathname),
        [location.pathname]
    );

    if (isLoaded) {
        return (
            <Suspense fallback={null}>
                <ChatWidget initiallyOpen onClose={() => setIsLoaded(false)} />
            </Suspense>
        );
    }

    if (isCommercialInsightsPage) return null;

    return (
        <button
            onClick={() => setIsLoaded(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 rounded-full shadow-2xl hover:shadow-primary-500/50 transition-all duration-300 flex items-center justify-center text-white z-50 group hover:scale-105"
            title="Assistente IA"
        >
            <HiOutlineSparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
            <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full animate-pulse border-2 border-white" />
        </button>
    );
}

export default function Layout() {
    const { theme } = useStore();
    const location = useLocation();

    // Apply dark mode class to html element
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    // Check if current page is a POS page to remove default padding/scroll
    const isPOSPage = location.pathname.includes('/pos') || location.pathname.includes('/bottle-store/pos') || location.pathname.includes('/pharmacy/pos');

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-100 dark:bg-dark-900 transition-colors duration-300 relative">

            {/* Toast Container */}
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: theme === 'dark' ? '#1e293b' : '#fff',
                        color: theme === 'dark' ? '#f1f5f9' : '#1e293b',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
                    },
                    success: {
                        iconTheme: {
                            primary: '#22c55e',
                            secondary: '#fff',
                        },
                    },
                    error: {
                        iconTheme: {
                            primary: '#ef4444',
                            secondary: '#fff',
                        },
                    },
                }}
            />

            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
                {/* Header */}
                <Header />

                {/* Page Content */}
                <main
                    className={
                        isPOSPage
                            ? "flex-1 flex flex-col min-h-0 overflow-y-auto bg-slate-100 dark:bg-dark-900 p-4 lg:p-6 scrollbar-thin relative"
                            : "flex-1 overflow-y-auto p-4 lg:p-6 pb-16 scrollbar-thin relative"
                    }
                >
                    <PageTransitionLoader />
                    <Suspense fallback={<LoadingOverlay />}>
                        <Outlet />
                    </Suspense>
                </main>

                {!isPOSPage && <Footer />}
            </div>

            {/* AI Chat Assistant */}
            <ChatWidgetLauncher />
        </div>
    );
}
