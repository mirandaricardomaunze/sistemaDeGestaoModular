import { type HTMLAttributes } from 'react';

interface LoadingSpinnerProps extends HTMLAttributes<HTMLDivElement> {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    variant?: 'spinner' | 'dots' | 'pulse';
}

export function LoadingSpinner({
    size = 'md',
    variant = 'spinner',
    className = '',
    ...props
}: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
        xl: 'w-16 h-16',
    };

    if (variant === 'dots') {
        return (
            <div className={`flex gap-2 ${className}`} {...props}>
                <div className={`${sizeClasses[size]} bg-primary-600 rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
                <div className={`${sizeClasses[size]} bg-primary-600 rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
                <div className={`${sizeClasses[size]} bg-primary-600 rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
            </div>
        );
    }

    if (variant === 'pulse') {
        return (
            <div className={`${sizeClasses[size]} bg-primary-600 rounded-full animate-pulse ${className}`} {...props}></div>
        );
    }

    return (
        <div className={className} {...props}>
            <svg
                className={`${sizeClasses[size]} animate-spin text-primary-600`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
            >
                <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                ></circle>
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
            </svg>
        </div>
    );
}

interface LoadingOverlayProps {
    message?: string;
}

export function LoadingOverlay({ message = 'A carregar...' }: LoadingOverlayProps) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl p-8 text-center">
                <LoadingSpinner size="xl" className="mx-auto mb-4" />
                <p className="text-gray-700 dark:text-gray-300 font-medium">{message}</p>
            </div>
        </div>
    );
}

export function LoadingCard() {
    return (
        <div className="bg-white dark:bg-dark-800 rounded-xl p-6 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 dark:bg-dark-700 rounded w-5/6"></div>
        </div>
    );
}

export default LoadingSpinner;
