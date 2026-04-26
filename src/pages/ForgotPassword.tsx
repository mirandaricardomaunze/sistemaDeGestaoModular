import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HiOutlineEnvelope, HiOutlineLockClosed, HiOutlineKey, HiOutlineArrowLeft, HiOutlineEye, HiOutlineEyeSlash, HiOutlineShieldCheck } from 'react-icons/hi2';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

// Schemas
const emailSchema = z.object({
    email: z.string().email('Email inválido'),
});

const otpSchema = z.object({
    otp: z.string().length(6, 'O código deve ter 6 dígitos'),
});

const passwordSchema = z.object({
    password: z.string()
        .min(8, 'A senha deve ter pelo menos 8 caracteres')
        .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
        .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
        .regex(/[0-9]/, 'A senha deve conter pelo menos um número'),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
});

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Forms
    const emailForm = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });
    const otpForm = useForm<z.infer<typeof otpSchema>>({ resolver: zodResolver(otpSchema) });
    const passwordForm = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });

    const handleSendOTP = async (data: z.infer<typeof emailSchema>) => {
        setIsLoading(true);
        try {
            await authAPI.forgotPassword(data.email);
            setEmail(data.email);
            setStep(2);
            toast.success('Código enviado para o seu email!');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao enviar código.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async (data: z.infer<typeof otpSchema>) => {
        setIsLoading(true);
        try {
            await authAPI.verifyOTP(email, data.otp);
            setOtp(data.otp);
            setStep(3);
            toast.success('Código verificado com sucesso!');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Código inválido.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (data: z.infer<typeof passwordSchema>) => {
        setIsLoading(true);
        try {
            await authAPI.resetPassword({ email, otp, newPassword: data.password });
            toast.success('Senha alterada com sucesso!');
            navigate('/login');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao redefinir senha.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-dark-950 overflow-hidden font-sans">
            {/* Animated Background Elements -- same as Login */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-500/10 dark:bg-primary-500/5 rounded-full blur-3xl animate-blob"></div>
                <div className="absolute top-1/2 -right-24 w-80 h-80 bg-accent-500/10 dark:bg-accent-500/5 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-24 left-1/4 w-72 h-72 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
                <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] dark:opacity-[0.05]"></div>
            </div>

            <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md px-4">
                {/* Logo & Header -- same as Login */}
                <div className="text-center group">
                    <div className="relative mx-auto h-24 w-24 mb-8">
                        <div className="absolute inset-0 bg-primary-600 rounded-lg blur-xl opacity-40 group-hover:opacity-60 transition duration-1000 animate-pulse-slow"></div>
                        <div className="relative h-full w-full rounded-lg bg-primary-600 flex items-center justify-center shadow-2xl border border-white/20">
                            <HiOutlineKey className="w-12 h-12 text-white animate-float" />
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
                    <div className="bg-white/70 dark:bg-dark-900/40 backdrop-blur-xl py-10 px-8 shadow-2xl sm:rounded-lg border border-white/20 dark:border-dark-800/50 transition-all duration-500">

                        {/* Welcome Text */}
                        <div className="mb-8">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Recuperar Senha</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {step === 1 && "Informe seu email para receber o código de recuperação."}
                                {step === 2 && "Insira o código de 6 dígitos enviado para o seu email."}
                                {step === 3 && "Crie uma nova senha para a sua conta."}
                            </p>
                        </div>

                        {/* Step Indicator */}
                        <div className="flex items-center justify-center gap-2 mb-8">
                            {[1, 2, 3].map((s) => (
                                <div key={s} className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step >= s
                                            ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25'
                                            : 'bg-slate-100 dark:bg-dark-800 text-slate-400 dark:text-slate-500'
                                        }`}>
                                        {step > s ? '?' : s}
                                    </div>
                                    {s < 3 && (
                                        <div className={`w-8 h-0.5 rounded-full transition-all duration-500 ${step > s ? 'bg-primary-500' : 'bg-slate-200 dark:bg-dark-700'
                                            }`} />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Step 1: Email */}
                        {step === 1 && (
                            <form onSubmit={emailForm.handleSubmit(handleSendOTP)} className="space-y-6">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">
                                        Endereço de Email
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <HiOutlineEnvelope className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                        </div>
                                        <input
                                            type="email"
                                            placeholder="seu@email.com"
                                            className={`block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-dark-800/50 border ${emailForm.formState.errors.email ? 'border-red-500' : 'border-slate-200 dark:border-dark-700/50'} rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all duration-200`}
                                            {...emailForm.register('email')}
                                        />
                                    </div>
                                    {emailForm.formState.errors.email && (
                                        <p className="text-xs font-medium text-red-500 mt-1 ml-1">{emailForm.formState.errors.email.message}</p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="relative w-full overflow-hidden group py-3.5 px-6 rounded-lg bg-gradient-to-r from-primary-600 to-primary-500 text-white font-bold shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none"
                                >
                                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                    <div className="flex items-center justify-center gap-2">
                                        {isLoading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <HiOutlineEnvelope className="w-5 h-5" />
                                                <span>ENVIAR CÓDIGO</span>
                                            </>
                                        )}
                                    </div>
                                </button>
                            </form>
                        )}

                        {/* Step 2: OTP */}
                        {step === 2 && (
                            <form onSubmit={otpForm.handleSubmit(handleVerifyOTP)} className="space-y-6">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">
                                        Código de Verificação
                                    </label>
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            placeholder="000000"
                                            maxLength={6}
                                            className={`block w-full text-center tracking-[0.5em] py-3 bg-slate-50 dark:bg-dark-800/50 border ${otpForm.formState.errors.otp ? 'border-red-500' : 'border-slate-200 dark:border-dark-700/50'} rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all duration-200 font-mono text-lg`}
                                            {...otpForm.register('otp')}
                                        />
                                    </div>
                                    {otpForm.formState.errors.otp && (
                                        <p className="text-xs font-medium text-red-500 mt-1 ml-1 text-center">{otpForm.formState.errors.otp.message}</p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="relative w-full overflow-hidden group py-3.5 px-6 rounded-lg bg-gradient-to-r from-primary-600 to-primary-500 text-white font-bold shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none"
                                >
                                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                    <div className="flex items-center justify-center gap-2">
                                        {isLoading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <HiOutlineShieldCheck className="w-5 h-5" />
                                                <span>VERIFICAR CÓDIGO</span>
                                            </>
                                        )}
                                    </div>
                                </button>

                                <div className="text-center">
                                    <button type="button" onClick={() => setStep(1)} className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors">
                                        Voltar e reenviar código
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Step 3: New Password */}
                        {step === 3 && (
                            <form onSubmit={passwordForm.handleSubmit(handleResetPassword)} className="space-y-6">
                                {/* Password */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">
                                        Nova Senha
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <HiOutlineLockClosed className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            className={`block w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-dark-800/50 border ${passwordForm.formState.errors.password ? 'border-red-500' : 'border-slate-200 dark:border-dark-700/50'} rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all duration-200`}
                                            {...passwordForm.register('password')}
                                        />
                                        <div
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-slate-400 hover:text-primary-500 transition-colors"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <HiOutlineEyeSlash className="h-5 w-5" /> : <HiOutlineEye className="h-5 w-5" />}
                                        </div>
                                    </div>
                                    {passwordForm.formState.errors.password && (
                                        <p className="text-xs font-medium text-red-500 mt-1 ml-1">{passwordForm.formState.errors.password.message}</p>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">
                                        Confirmar Senha
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <HiOutlineLockClosed className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                        </div>
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            className={`block w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-dark-800/50 border ${passwordForm.formState.errors.confirmPassword ? 'border-red-500' : 'border-slate-200 dark:border-dark-700/50'} rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all duration-200`}
                                            {...passwordForm.register('confirmPassword')}
                                        />
                                        <div
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-slate-400 hover:text-primary-500 transition-colors"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? <HiOutlineEyeSlash className="h-5 w-5" /> : <HiOutlineEye className="h-5 w-5" />}
                                        </div>
                                    </div>
                                    {passwordForm.formState.errors.confirmPassword && (
                                        <p className="text-xs font-medium text-red-500 mt-1 ml-1">{passwordForm.formState.errors.confirmPassword.message}</p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="relative w-full overflow-hidden group py-3.5 px-6 rounded-lg bg-gradient-to-r from-primary-600 to-primary-500 text-white font-bold shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none"
                                >
                                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                    <div className="flex items-center justify-center gap-2">
                                        {isLoading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <HiOutlineShieldCheck className="w-5 h-5" />
                                                <span>REDEFINIR SENHA</span>
                                            </>
                                        )}
                                    </div>
                                </button>
                            </form>
                        )}

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-dark-800/50">
                            <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors">
                                <HiOutlineArrowLeft className="w-4 h-4" />
                                <span>Voltar ao login</span>
                            </Link>
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
