import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
    HiOutlineEnvelope, 
    HiOutlineLockClosed, 
    HiOutlineShieldCheck,
    HiOutlineSquares2X2,
    HiOutlineShoppingCart
} from 'react-icons/hi2';
import { Input, Button } from '../components/ui';
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
    const [shakeForm, setShakeForm] = useState(false);

    // Auto-focus on email
    useEffect(() => {
        const input = document.getElementById('email');
        if (input) input.focus();
    }, []);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        const success = await login(data.email, data.password);
        if (success) {
            navigate('/');
        } else {
            setShakeForm(true);
            setTimeout(() => setShakeForm(false), 650);
        }
    };

    return (
        <div className="min-h-screen flex w-full font-sans bg-white dark:bg-dark-950 overflow-hidden">
            <Toaster
                position="top-center"
                toastOptions={{
                    duration: 5000,
                    style: {
                        borderRadius: '12px',
                        padding: '14px 18px',
                        fontSize: '14px',
                        fontWeight: 500,
                    },
                    error: {
                        style: {
                            background: '#fff1f2',
                            color: '#be123c',
                            border: '1px solid #fecdd3',
                        },
                        iconTheme: { primary: '#e11d48', secondary: '#fff1f2' },
                    },
                }}
            />
            {/* Left Side: Form Section */}
            <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-center px-8 sm:px-16 lg:px-20 relative z-10 transition-all">
                <div className="w-full max-w-[420px] mx-auto animate-fade-in">
                    {/* Header */}
                    <div className="mb-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-lg bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                                <HiOutlineShieldCheck className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                    MULTICORE<span className="text-primary-500">.</span>
                                </h1>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    Modular ERP System
                                </p>
                            </div>
                        </div>
                        
                        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                            Bem-vindo de volta
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            Introduza as suas credenciais para aceder ao sistema.
                        </p>
                    </div>



                    {/* Form */}
                    <form className={`space-y-6 ${shakeForm ? 'animate-shake' : ''}`} onSubmit={handleSubmit(onSubmit)}>
                        <Input
                            label="Email de Acesso"
                            type="email"
                            placeholder="exemplo@multicore.co.mz"
                            leftIcon={<HiOutlineEnvelope className="h-5 w-5" />}
                            error={errors.email?.message}
                            size="lg"
                            {...register('email')}
                        />

                        <div className="space-y-1">
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                    Palavra-passe
                                </label>
                                <Link to="/forgot-password" title="Recuperar acesso" className="text-[10px] font-black text-primary-600 hover:text-primary-500 uppercase tracking-widest transition-colors">
                                    Esqueceu-se?
                                </Link>
                            </div>
                            <Input
                                type="password"
                                showPasswordToggle
                                placeholder="••••••••"
                                leftIcon={<HiOutlineLockClosed className="h-5 w-5" />}
                                error={errors.password?.message}
                                size="lg"
                                {...register('password')}
                            />
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            fullWidth
                            isLoading={isLoading}
                            loadingText="A ENTRAR..."
                            className="group"
                            rightIcon={
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            }
                        >
                            ENTRAR NO SISTEMA
                        </Button>
                    </form>

                    {/* Footer Left */}
                    <div className="mt-10 border-t border-slate-100 dark:border-dark-800 pt-6">
                        <p className="text-center text-sm font-medium text-slate-500">
                            Não possui conta na empresa?{' '}
                            <Link to="/register" className="font-bold text-primary-600 hover:text-primary-500 border-b border-primary-600/30 hover:border-primary-500 pb-0.5 transition-all">
                                Solicitar acesso
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side: Showcase / Illustration Section */}
            <div className="hidden lg:flex flex-1 relative bg-slate-900 border-l border-white/10 overflow-hidden items-center justify-center">
                {/* Abstract Premium Background */}
                <div className="absolute inset-0 z-0">
                    <img 
                        src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop" 
                        alt="Cyber Background" 
                        className="w-full h-full object-cover opacity-30 mix-blend-overlay"
                    />
                    <div className="absolute inset-0 bg-primary-950/90 mix-blend-multiply"></div>
                    <div className="absolute inset-0 bg-slate-900/30"></div>
                </div>

                {/* Glass Cards Layout */}
                <div className="relative z-10 w-full max-w-2xl px-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    
                    <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
                        Gestão <span className="text-primary-400">Inteligente</span>,<br />
                        Negócio Imbatível.
                    </h2>
                    <p className="text-lg text-slate-300 mb-10 max-w-lg">
                        O ERP mais adaptável do mercado. Módulos de farmácia, restauração, comércio e logística, integrados num único cofre em tempo real.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Feature Card 1 */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center mb-4">
                                <HiOutlineSquares2X2 className="w-5 h-5 text-primary-300" />
                            </div>
                            <h3 className="text-white font-bold mb-2">Visão 360º de Dados</h3>
                            <p className="text-sm text-slate-400">Dashboards profissionais instantâneos e reconciliação nativa.</p>
                        </div>
                        {/* Feature Card 2 */}
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-accent-500/20 flex items-center justify-center mb-4">
                                <HiOutlineShoppingCart className="w-5 h-5 text-accent-300" />
                            </div>
                            <h3 className="text-white font-bold mb-2">PDV Ultra-Rápido</h3>
                            <p className="text-sm text-slate-400">Processamento em frações de segundo com atalhos fluidos (F1-F10).</p>
                        </div>
                    </div>

                    <div className="mt-16 flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <div className="h-px w-8 bg-slate-700"></div>
                        <span>Security & Reliability</span>
                    </div>
                </div>

                {/* Decorative glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500/20 rounded-full blur-[100px] pointer-events-none"></div>
            </div>
            
        </div>
    );
}
