import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useStore } from '../../stores/useStore';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import ChatWidget from '../chat/ChatWidget';
import { useEffect, Suspense } from 'react';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { LoadingOverlay } from '../ui/Loading';

// Footer imported at top
import { useLocation } from 'react-router-dom';

export default function Layout() {
    const { theme, sidebarOpen } = useStore();
    const location = useLocation();

    // Initialize offline data synchronization
    useOfflineSync();

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
        <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-dark-900 transition-colors duration-200">
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
            <div
                className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
                    }`}
            >
                {/* Header */}
                <Header />

                {/* Page Content */}
                <main
                    className={
                        isPOSPage
                            ? "flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-100 dark:bg-dark-900"
                            : "flex-1 overflow-y-auto p-4 lg:p-6 pb-12 scrollbar-thin"
                    }
                >
                    <Suspense fallback={<LoadingOverlay />}>
                        <Outlet />
                    </Suspense>
                </main>

                {/* Footer - Hide on POS pages to save space if needed, or keep it depending on requirements. Usually POS is full screen. Keeping for now but verify if needed. */}
                {!isPOSPage && <Footer />}
            </div>

            {/* AI Chat Assistant */}
            <ChatWidget />
        </div>
    );
}
