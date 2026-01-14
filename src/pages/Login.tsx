import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff, HiOutlineShieldCheck, HiOutlineExclamationCircle, HiOutlineUser } from 'react-icons/hi';
import { useAuthStore } from '../stores/useAuthStore';

// Validation Schema
const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
    const navigate = useNavigate();
    const { login, isLoading } = useAuthStore();
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [shakeForm, setShakeForm] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setLoginError(null);
        const success = await login(data.email, data.password);
        if (success) {
            navigate('/logistics');
        } else {
            setLoginError('Email ou senha incorretos. Verifique as suas credenciais e tente novamente.');
            // Trigger shake animation
            setShakeForm(true);
            setTimeout(() => setShakeForm(false), 650);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                {/* Logo & Header */}
                <div className="text-center">
                    <div className="mx-auto h-20 w-20 rounded-xl bg-primary-600 flex items-center justify-center shadow-lg mb-4">
                        <HiOutlineUser className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        Sistema de Gestão
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        Entre na sua conta para continuar
                    </p>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className={`bg-white dark:bg-gray-800 py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-gray-100 dark:border-gray-700 transition-all duration-300 ${shakeForm ? 'animate-shake' : ''}`}>

                    {/* Error Alert */}
                    {loginError && (
                        <div className="mb-6 rounded-md bg-red-50 dark:bg-red-900/30 p-4 border border-red-100 dark:border-red-900/50">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <HiOutlineExclamationCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Falha na Autenticação</h3>
                                    <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                                        <p>{loginError}</p>
                                    </div>
                                </div>
                                <div className="ml-auto pl-3">
                                    <div className="-mx-1.5 -my-1.5">
                                        <button
                                            onClick={() => setLoginError(null)}
                                            type="button"
                                            className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 focus:outline-none"
                                        >
                                            <span className="sr-only">Dismiss</span>
                                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Email
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <HiOutlineMail className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    className={`appearance-none block w-full pl-10 pr-3 py-2 border ${errors.email ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white dark:placeholder-gray-500`}
                                    placeholder="seu@email.com"
                                    {...register('email')}
                                    onChange={() => loginError && setLoginError(null)}
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-2 text-sm text-red-600" id="email-error">
                                    {errors.email.message}
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Senha
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <HiOutlineLockClosed className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    className={`appearance-none block w-full pl-10 pr-10 py-2 border ${errors.password ? 'border-red-300' : 'border-gray-300 dark:border-gray-600'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white dark:placeholder-gray-500`}
                                    placeholder="••••••••"
                                    {...register('password')}
                                    onChange={() => loginError && setLoginError(null)}
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? (
                                        <HiOutlineEyeOff className="h-5 w-5 text-gray-400 hover:text-gray-500" aria-hidden="true" />
                                    ) : (
                                        <HiOutlineEye className="h-5 w-5 text-gray-400 hover:text-gray-500" aria-hidden="true" />
                                    )}
                                </div>
                            </div>
                            {errors.password && (
                                <p className="mt-2 text-sm text-red-600" id="password-error">
                                    {errors.password.message}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                    Lembrar-me
                                </label>
                            </div>

                            <div className="text-sm">
                                <Link to="/forgot-password" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
                                    Esqueci a senha
                                </Link>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors ${isLoading ? 'opacity-75 cursor-wait' : ''}`}
                            >
                                {isLoading ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <HiOutlineShieldCheck className="w-5 h-5 mr-2" />
                                )}
                                {isLoading ? 'A entrar...' : 'Entrar na Conta'}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                                    Novo por aqui?
                                </span>
                            </div>
                        </div>

                        <div className="mt-6">
                            <Link
                                to="/register"
                                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                            >
                                Criar uma nova conta
                            </Link>
                        </div>
                    </div>


                </div>

                {/* Footer */}
                <p className="mt-8 text-center text-xs text-gray-500">
                    &copy; {new Date().getFullYear()} Sistema de Gestão Comercial. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
}
