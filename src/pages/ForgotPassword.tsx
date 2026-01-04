import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineKey, HiOutlineArrowLeft, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
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
    password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
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
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
            {/* Background similar to Login.tsx */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-dark-900">
                <div className="absolute top-0 -left-40 w-96 h-96 bg-primary-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
                <div className="absolute top-0 -right-40 w-96 h-96 bg-primary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
                <div className="absolute -bottom-40 left-40 w-96 h-96 bg-primary-700 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />

                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
                        backgroundSize: '50px 50px'
                    }}
                />
            </div>

            <div className="relative z-10 w-full max-w-md px-4 sm:px-0">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 via-primary-600 to-secondary-500 rounded-3xl blur-xl opacity-40 animate-pulse-slow" />

                <div className="relative backdrop-blur-2xl bg-white/[0.08] border border-white/[0.15] rounded-3xl shadow-2xl p-8 sm:p-10">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 p-[2px]">
                                <div className="w-full h-full rounded-2xl bg-dark-900/80 backdrop-blur-xl flex items-center justify-center">
                                    <HiOutlineKey className="w-8 h-8 text-white" />
                                </div>
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Recuperar Senha</h2>
                        <p className="text-gray-400 text-sm">
                            {step === 1 && "Informe seu email para receber o código de recuperação."}
                            {step === 2 && "Insira o código de 6 dígitos enviado para o seu email."}
                            {step === 3 && "Crie uma nova senha para a sua conta."}
                        </p>
                    </div>

                    {/* Step 1: Email */}
                    {step === 1 && (
                        <form onSubmit={emailForm.handleSubmit(handleSendOTP)} className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300 ml-1">Email</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <HiOutlineMail className="w-5 h-5 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="seu@email.com"
                                        className={`w-full pl-12 pr-4 py-3.5 bg-white/[0.05] border ${emailForm.formState.errors.email ? 'border-red-500/50' : 'border-white/[0.1]'} rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-transparent focus:bg-white/[0.08] transition-all`}
                                        {...emailForm.register('email')}
                                    />
                                </div>
                                {emailForm.formState.errors.email && (
                                    <p className="text-red-400 text-xs ml-1">{emailForm.formState.errors.email.message}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative group disabled:opacity-70"
                            >
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl blur opacity-70 group-hover:opacity-100 transition duration-300" />
                                <div className="relative flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 rounded-xl text-white font-semibold">
                                    {isLoading ? 'Enviando...' : 'Enviar Código'}
                                </div>
                            </button>
                        </form>
                    )}

                    {/* Step 2: OTP */}
                    {step === 2 && (
                        <form onSubmit={otpForm.handleSubmit(handleVerifyOTP)} className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300 ml-1">Código de Verificação</label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder="000000"
                                        maxLength={6}
                                        className={`w-full text-center tracking-[1em] py-3.5 bg-white/[0.05] border ${otpForm.formState.errors.otp ? 'border-red-500/50' : 'border-white/[0.1]'} rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-transparent focus:bg-white/[0.08] transition-all font-mono text-lg`}
                                        {...otpForm.register('otp')}
                                    />
                                </div>
                                {otpForm.formState.errors.otp && (
                                    <p className="text-red-400 text-xs ml-1 text-center">{otpForm.formState.errors.otp.message}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative group disabled:opacity-70"
                            >
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl blur opacity-70 group-hover:opacity-100 transition duration-300" />
                                <div className="relative flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 rounded-xl text-white font-semibold">
                                    {isLoading ? 'Verificando...' : 'Verificar Código'}
                                </div>
                            </button>

                            <div className="text-center">
                                <button type="button" onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-white transition-colors">
                                    Voltar e reenviar código
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Step 3: New Password */}
                    {step === 3 && (
                        <form onSubmit={passwordForm.handleSubmit(handleResetPassword)} className="space-y-6">
                            {/* Password */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300 ml-1">Nova Senha</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <HiOutlineLockClosed className="w-5 h-5 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className={`w-full pl-12 pr-12 py-3.5 bg-white/[0.05] border ${passwordForm.formState.errors.password ? 'border-red-500/50' : 'border-white/[0.1]'} rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-transparent focus:bg-white/[0.08] transition-all`}
                                        {...passwordForm.register('password')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-primary-400"
                                    >
                                        {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {passwordForm.formState.errors.password && (
                                    <p className="text-red-400 text-xs ml-1">{passwordForm.formState.errors.password.message}</p>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-300 ml-1">Confirmar Senha</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <HiOutlineLockClosed className="w-5 h-5 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                                    </div>
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        className={`w-full pl-12 pr-12 py-3.5 bg-white/[0.05] border ${passwordForm.formState.errors.confirmPassword ? 'border-red-500/50' : 'border-white/[0.1]'} rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-transparent focus:bg-white/[0.08] transition-all`}
                                        {...passwordForm.register('confirmPassword')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-primary-400"
                                    >
                                        {showConfirmPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {passwordForm.formState.errors.confirmPassword && (
                                    <p className="text-red-400 text-xs ml-1">{passwordForm.formState.errors.confirmPassword.message}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative group disabled:opacity-70"
                            >
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl blur opacity-70 group-hover:opacity-100 transition duration-300" />
                                <div className="relative flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 rounded-xl text-white font-semibold">
                                    {isLoading ? 'Redefinindo...' : 'Redefinir Senha'}
                                </div>
                            </button>
                        </form>
                    )}

                    <div className="mt-8 text-center border-t border-white/10 pt-6">
                        <Link to="/login" className="flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors">
                            <HiOutlineArrowLeft className="w-4 h-4" />
                            <span>Voltar ao login</span>
                        </Link>
                    </div>

                </div>
            </div>
        </div>
    );
}
