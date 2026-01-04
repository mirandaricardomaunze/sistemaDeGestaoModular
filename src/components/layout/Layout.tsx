import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useStore } from '../../stores/useStore';
import Sidebar from './Sidebar';
import Header from './Header';
import ChatWidget from '../chat/ChatWidget';
import { useEffect } from 'react';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export default function Layout() {
    const { theme, sidebarOpen } = useStore();

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

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors duration-200">
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
                className={`transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
                    }`}
            >
                {/* Header */}
                <Header />

                {/* Page Content */}
                <main className="p-4 lg:p-6 min-h-[calc(100vh-64px)]">
                    <Outlet />
                </main>
            </div>

            {/* AI Chat Assistant */}
            <ChatWidget />
        </div>
    );
}
