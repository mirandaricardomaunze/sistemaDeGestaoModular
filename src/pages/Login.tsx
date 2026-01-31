import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff, HiOutlineShieldCheck, HiOutlineExclamationCircle } from 'react-icons/hi';
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
            navigate('/');
        } else {
            setLoginError('Email ou senha incorretos. Verifique as suas credenciais e tente novamente.');
            // Trigger shake animation
            setShakeForm(true);
            setTimeout(() => setShakeForm(false), 650);
        }
    };

    return (
        <div className="min-h-screen relative flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-dark-950 overflow-hidden font-sans">
            {/* Animated Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-500/10 dark:bg-primary-500/5 rounded-full blur-3xl animate-blob"></div>
                <div className="absolute top-1/2 -right-24 w-80 h-80 bg-accent-500/10 dark:bg-accent-500/5 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-24 left-1/4 w-72 h-72 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl animate-blob animation-delay-4000"></div>

                {/* Grid Overlay */}
                <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] dark:opacity-[0.05]"></div>
            </div>

            <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md px-4">
                {/* Logo & Header */}
                <div className="text-center group">
                    <div className="relative mx-auto h-24 w-24 mb-8">
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary-600 to-accent-600 rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition duration-1000 animate-pulse-slow"></div>
                        <div className="relative h-full w-full rounded-3xl bg-gradient-to-tr from-primary-600 to-primary-500 flex items-center justify-center shadow-2xl border border-white/20">
                            <HiOutlineShieldCheck className="w-12 h-12 text-white animate-float" />
                        </div>
                    </div>

                    <h2 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">
                        MULTICORE<span className="text-primary-500">.</span>
                    </h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                        Modular Management ERP
                    </p>
                </div>

                <div className="mt-10 animate-slide-up">
                    <div className={`bg-white/70 dark:bg-dark-900/40 backdrop-blur-xl py-10 px-8 shadow-2xl sm:rounded-3xl border border-white/20 dark:border-dark-800/50 transition-all duration-500 ${shakeForm ? 'animate-shake' : ''}`}>

                        {/* Welcome Text */}
                        <div className="mb-8">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Bem-vindo de volta</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Entre com as suas credenciais para gerir o seu negócio.</p>
                        </div>

                        {/* Error Alert */}
                        {loginError && (
                            <div className="mb-6 rounded-2xl bg-red-50/50 dark:bg-red-950/20 p-4 border border-red-100 dark:border-red-900/30 animate-fade-in">
                                <div className="flex items-center gap-3">
                                    <HiOutlineExclamationCircle className="h-5 w-5 text-red-500 shrink-0" />
                                    <p className="text-sm font-medium text-red-800 dark:text-red-300">{loginError}</p>
                                    <button
                                        onClick={() => setLoginError(null)}
                                        className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    >
                                        <svg className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">
                                    Endereço de Email
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <HiOutlineMail className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                    </div>
                                    <input
                                        id="email"
                                        type="email"
                                        className={`block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-dark-800/50 border ${errors.email ? 'border-red-500' : 'border-slate-200 dark:border-dark-700/50'} rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all duration-200`}
                                        placeholder="seu@email.com"
                                        {...register('email')}
                                    />
                                </div>
                                {errors.email && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.email.message}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between px-1">
                                    <label htmlFor="password" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                        Palavra-passe
                                    </label>
                                    <Link to="/forgot-password" virtual-link className="text-xs font-bold text-primary-600 hover:text-primary-500 dark:text-primary-400">
                                        Esqueceu-se?
                                    </Link>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <HiOutlineLockClosed className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                    </div>
                                    <input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        className={`block w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-dark-800/50 border ${errors.password ? 'border-red-500' : 'border-slate-200 dark:border-dark-700/50'} rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all duration-200`}
                                        placeholder="••••••••"
                                        {...register('password')}
                                    />
                                    <div
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-slate-400 hover:text-primary-500 transition-colors"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <HiOutlineEyeOff className="h-5 w-5" /> : <HiOutlineEye className="h-5 w-5" />}
                                    </div>
                                </div>
                                {errors.password && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.password.message}</p>}
                            </div>

                            <div className="flex items-center px-1">
                                <label className="flex items-center group cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded-lg bg-slate-100 dark:bg-dark-800 border-slate-200 dark:border-dark-700 text-primary-500 focus:ring-primary-500 transition-all"
                                    />
                                    <span className="ml-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                        Manter sessão iniciada
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="relative w-full overflow-hidden group py-3.5 px-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-bold shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none"
                            >
                                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                <div className="flex items-center justify-center gap-2">
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <HiOutlineShieldCheck className="w-5 h-5" />
                                            <span>AUTENTICAR</span>
                                        </>
                                    )}
                                </div>
                            </button>
                        </form>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-dark-800/50">
                            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                                Não possui uma conta?{' '}
                                <Link to="/register" className="font-bold text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors">
                                    Crie uma gratuitamente
                                </Link>
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-12 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-dark-600">
                            &copy; {new Date().getFullYear()} MULTICORE • Intelligent Management Solutions
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
