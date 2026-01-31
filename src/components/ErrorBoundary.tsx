import { Component, type ErrorInfo, type ReactNode } from 'react';
import { HiOutlineExclamationCircle } from 'react-icons/hi';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error details to console
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // You can also log the error to an error reporting service
        // logErrorToService(error, errorInfo);
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
        });
    };

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900 px-4">
                    <div className="max-w-md w-full">
                        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <HiOutlineExclamationCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                            </div>

                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                Oops! Algo deu errado
                            </h1>

                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                Ocorreu um erro inesperado. Por favor, tente novamente ou recarregue a página.
                            </p>

                            {import.meta.env.MODE === 'development' && this.state.error && (
                                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left">
                                    <p className="text-sm font-mono text-red-800 dark:text-red-300">
                                        {this.state.error.toString()}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={this.handleReset}
                                    className="px-4 py-2 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors"
                                >
                                    Tentar Novamente
                                </button>

                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                                >
                                    Recarregar Página
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
