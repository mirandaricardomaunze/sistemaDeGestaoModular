import { logger } from '../utils/logger';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlineUser,
    HiOutlineMail,
    HiOutlineLockClosed,
    HiOutlineEye,
    HiOutlineEyeOff,
    HiOutlinePhone,
    HiOutlineUserAdd,
    HiOutlineExclamationCircle,
    HiOutlineOfficeBuilding,
    HiOutlineChevronRight,
    HiOutlineChevronLeft,
    HiOutlineCheckCircle,
    HiOutlineShoppingCart,
    HiOutlineHashtag,
    HiOutlineMap,
    HiOutlineLocationMarker,
    HiOutlineViewGrid
} from 'react-icons/hi';
import {
    HiOutlineBeaker,
    HiOutlineBuildingStorefront,
    HiOutlineHomeModern,
    HiOutlineTruck,
    HiOutlineUsers,
    HiOutlineBriefcase,
    HiOutlineDocumentCheck,
    HiOutlineCake
} from 'react-icons/hi2';
import { useAuthStore } from '../stores/useAuthStore';
import { modulesAPI } from '../services/api';
import { OPTIONAL_MODULES, type BusinessModule } from '../constants/modules.constants';

// Module icons mapping
const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    PHARMACY: HiOutlineBeaker,
    COMMERCIAL: HiOutlineShoppingCart,
    BOTTLE_STORE: HiOutlineBuildingStorefront,
    HOSPITALITY: HiOutlineHomeModern,
    RESTAURANT: HiOutlineCake,
    LOGISTICS: HiOutlineTruck,
};

const integratedPillars = [
    { name: 'POS', icon: HiOutlineShoppingCart, color: 'text-green-500' },
    { name: 'CRM', icon: HiOutlineUsers, color: 'text-blue-500' },
    { name: 'RH', icon: HiOutlineBriefcase, color: 'text-purple-500' },
    { name: 'Fiscal', icon: HiOutlineDocumentCheck, color: 'text-emerald-500' },
];

const registerSchema = z.object({
    companyName: z.string().min(2, 'Razão Social deve ter pelo menos 2 caracteres'),
    companyTradeName: z.string().optional(),
    companyNuit: z.string().min(9, 'NUIT deve ter pelo menos 9 dígitos'),
    companyAddress: z.string().min(5, 'Endereço completo é necessário'),
    companyPhone: z.string().min(5, 'Telefone de contacto da empresa'),
    companyEmail: z.string().email('Email da empresa inválido').optional().or(z.literal('')),
    moduleCode: z.string().min(1, 'Selecione um módulo'),
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a senha'),
    phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
    const navigate = useNavigate();
    const { register: registerUser, isLoading } = useAuthStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [registerError, setRegisterError] = useState<string | null>(null);
    const [shakeForm, setShakeForm] = useState(false);
    const [modules, setModules] = useState<BusinessModule[]>([]);
    const [loadingModules, setLoadingModules] = useState(true);

    const { register, handleSubmit, formState: { errors }, watch, setValue, trigger } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: { moduleCode: '' },
    });

    const selectedModule = watch('moduleCode');

    const loadModules = async () => {
        setLoadingModules(true);
        setModules(OPTIONAL_MODULES);
        try {
            const data = await modulesAPI.getAll();
            if (data && data.length > 0) setModules(data);
        } catch (error) {
            logger.warn('Backend modules fetch failed, continuing with static constants:', error);
        } finally {
            setLoadingModules(false);
        }
    };

    useEffect(() => {
        loadModules();
        register('moduleCode');
    }, [register]);

    const nextStep = async () => {
        let fieldsToValidate: Array<keyof RegisterFormData> = [];
        if (currentStep === 1) {
            fieldsToValidate = ['companyName', 'companyNuit', 'companyAddress', 'companyPhone', 'companyEmail', 'companyTradeName'];
        } else if (currentStep === 2) {
            fieldsToValidate = ['moduleCode'];
        }

        const result = await trigger(fieldsToValidate as any);
        if (result) {
            setCurrentStep(currentStep + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            setShakeForm(true);
            setTimeout(() => setShakeForm(false), 650);
        }
    };

    const prevStep = () => {
        setCurrentStep(currentStep - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const onSubmit = async (data: RegisterFormData) => {
        setRegisterError(null);
        const result = await registerUser({
            name: data.name,
            email: data.email,
            password: data.password,
            role: 'admin',
            phone: data.phone,
            companyName: data.companyName,
            companyTradeName: data.companyTradeName,
            companyNuit: data.companyNuit,
            companyAddress: data.companyAddress,
            companyPhone: data.companyPhone,
            companyEmail: data.companyEmail,
            moduleCode: data.moduleCode,
        });

        if (result.success) {
            navigate('/login');
        } else {
            setRegisterError(result.error || 'Não foi possível criar a conta. Verifique os dados e tente novamente.');
            setShakeForm(true);
            setTimeout(() => setShakeForm(false), 650);
        }
    };

    const inputClass = (hasError?: boolean) =>
        `block w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-dark-800/50 border ${hasError ? 'border-red-500' : 'border-slate-200 dark:border-dark-700/60'
        } rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-medium`;

    const stepLabels = ['Empresa', 'Solução', 'Acesso'];

    return (
        <div className="min-h-screen flex w-full font-sans bg-white dark:bg-dark-950 overflow-hidden">
            {/* Left Side: Form Section */}
            <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col px-6 sm:px-12 lg:px-16 py-8 relative z-10 transition-all h-screen overflow-y-auto custom-scrollbar">
                <div className="w-full max-w-[420px] mx-auto animate-fade-in my-auto py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
                                <HiOutlineUserAdd className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                    MULTICORE<span className="text-primary-500">.</span>
                                </h1>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    Registo Empresarial
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Stepper */}
                    <div className="mb-8 relative">
                        <div className="absolute top-4 left-0 w-full h-[2px] bg-slate-100 dark:bg-dark-800 z-0 rounded-full"></div>
                        <div
                            className="absolute top-4 left-0 h-[2px] bg-primary-500 z-0 transition-all duration-700 ease-in-out"
                            style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%' }}
                        ></div>

                        <div className="flex justify-between relative z-10">
                            {stepLabels.map((label, i) => {
                                const s = i + 1;
                                return (
                                    <div key={s} className="flex flex-col items-center">
                                        <div className={`
                                            w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500
                                            ${currentStep >= s
                                                ? 'bg-gradient-to-r from-primary-600 to-primary-500 border-primary-600 text-white shadow-lg shadow-primary-500/30'
                                                : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-dark-700 text-slate-400'
                                            }
                                        `}>
                                            {currentStep > s ? <HiOutlineCheckCircle className="w-5 h-5" /> : <span className="font-bold text-xs">{s}</span>}
                                        </div>
                                        <span className={`mt-2 text-[9px] font-black uppercase tracking-[0.2em] transition-colors duration-500 ${currentStep >= s ? 'text-primary-600' : 'text-slate-400'}`}>
                                            {label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Error Handling */}
                    <div className={`transition-all duration-300 overflow-hidden ${registerError ? 'max-h-24 opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
                        <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-900/30">
                            <div className="flex items-start gap-3">
                                <HiOutlineExclamationCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-sm font-medium text-red-800 dark:text-red-300">{registerError}</p>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    <form className={`space-y-6 ${shakeForm ? 'animate-shake' : ''}`} onSubmit={handleSubmit(onSubmit)}>
                        {currentStep === 1 && (
                            <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-5">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Empresa Oficial</h2>
                                    <p className="text-xs text-slate-500 mb-4">Dados oficiais para a faturação do software.</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Razão Social</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><HiOutlineOfficeBuilding className="h-5 w-5 text-slate-400" /></div>
                                            <input className={inputClass(!!errors.companyName)} placeholder="Ex: Farmácia Sagrada Lda" {...register('companyName')} />
                                        </div>
                                        {errors.companyName && <p className="text-[10px] text-red-500 font-bold">{errors.companyName.message}</p>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">NUIT</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><HiOutlineHashtag className="h-5 w-5 text-slate-400" /></div>
                                                <input className={inputClass(!!errors.companyNuit)} placeholder="900000000" {...register('companyNuit')} />
                                                {errors.companyNuit && <p className="text-[10px] text-red-500 font-bold mt-1 max-w-[150px] truncate">{errors.companyNuit.message}</p>}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Telefone</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><HiOutlinePhone className="h-5 w-5 text-slate-400" /></div>
                                                <input className={inputClass(!!errors.companyPhone)} placeholder="84 000 0000" {...register('companyPhone')} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Endereço (Sede)</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><HiOutlineLocationMarker className="h-5 w-5 text-slate-400" /></div>
                                            <input className={inputClass(!!errors.companyAddress)} placeholder="Avenida, Cidade" {...register('companyAddress')} />
                                        </div>
                                    </div>
                                </div>
                                <button type="button" onClick={nextStep} className="w-full relative overflow-hidden group mt-6 py-4 px-6 rounded-2xl bg-slate-900 dark:bg-primary-600 text-white font-bold shadow-xl hover:-translate-y-0.5 transition-all">
                                    <span className="relative z-10 flex items-center justify-center gap-2">PRÓXIMO PASSO <HiOutlineChevronRight className="w-4 h-4" /></span>
                                </button>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-5">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Solução Principal</h2>
                                    <p className="text-xs text-slate-500 mb-4">Que ecossistema Multicore irá impulsionar o seu negócio?</p>
                                </div>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {modules.map((mod) => {
                                        const Icon = moduleIcons[mod.code] || HiOutlineShoppingCart;
                                        const isActive = selectedModule === mod.code;
                                        return (
                                            <label
                                                key={mod.code}
                                                className={`group flex items-center p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300
                                                    ${isActive ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-100 dark:border-dark-800 hover:border-primary-200'}
                                                `}
                                                onClick={() => setValue('moduleCode', mod.code)}
                                            >
                                                <div className={`p-3 rounded-xl mr-4 ${isActive ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' : 'bg-slate-100 dark:bg-dark-800 text-slate-500'}`}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <span className={`block font-bold ${isActive ? 'text-primary-700 dark:text-primary-400' : 'text-slate-900 dark:text-white'}`}>{mod.name}</span>
                                                    <span className="block text-xs text-slate-500 truncate max-w-[200px]">{mod.description}</span>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-primary-500 bg-primary-500' : 'border-slate-300 hover:border-primary-300'}`}>
                                                    {isActive && <HiOutlineCheckCircle className="w-4 h-4 text-white" />}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                                {errors.moduleCode && <p className="text-[10px] text-red-500 font-bold">{errors.moduleCode.message}</p>}
                                <div className="flex gap-3">
                                    <button type="button" onClick={prevStep} className="flex-1 py-4 px-6 rounded-2xl bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-white font-bold hover:bg-slate-200 transition-all">Voltar</button>
                                    <button type="button" onClick={nextStep} className="flex-[2] py-4 px-6 rounded-2xl bg-slate-900 dark:bg-primary-600 text-white font-bold shadow-xl hover:-translate-y-0.5 transition-all">Próximo</button>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-5">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Acesso do Gestor</h2>
                                    <p className="text-xs text-slate-500 mb-4">A primeira conta é sempre o Super Administrador (Master).</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Nome do Administrador</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><HiOutlineUser className="h-5 w-5 text-slate-400" /></div>
                                            <input className={inputClass(!!errors.name)} placeholder="Rui Silva" {...register('name')} />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Email Login</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><HiOutlineMail className="h-5 w-5 text-slate-400" /></div>
                                            <input type="email" className={inputClass(!!errors.email)} placeholder="admin@multicore.co.mz" {...register('email')} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Senha Segura</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><HiOutlineLockClosed className="h-5 w-5 text-slate-400" /></div>
                                                <input type={showPassword ? 'text' : 'password'} className={inputClass(!!errors.password)} placeholder="••••••••" {...register('password')} />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Confirmar</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><HiOutlineLockClosed className="h-5 w-5 text-slate-400" /></div>
                                                <input type={showConfirmPassword ? 'text' : 'password'} className={inputClass(!!errors.confirmPassword)} placeholder="••••••••" {...register('confirmPassword')} />
                                            </div>
                                            {errors.confirmPassword && <p className="text-[10px] text-red-500 font-bold truncate">{errors.confirmPassword.message}</p>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={prevStep} disabled={isLoading} className="flex-1 py-4 px-6 rounded-2xl bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-white font-bold hover:bg-slate-200 transition-all opacity-80 disabled:opacity-50">Voltar</button>
                                    <button type="submit" disabled={isLoading} className="flex-[2] py-4 px-6 rounded-2xl bg-slate-900 dark:bg-primary-600 text-white font-bold shadow-xl hover:-translate-y-0.5 transition-all text-sm">
                                        {isLoading ? 'CONFIGURANDO...' : 'FINALIZAR REGISTO'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>

                    {/* Footer Left */}
                    <div className="mt-8 border-t border-slate-100 dark:border-dark-800 pt-6">
                        <p className="text-center text-sm font-medium text-slate-500">
                            Já está registado?{' '}
                            <Link to="/login" className="font-bold text-primary-600 hover:text-primary-500 border-b border-primary-600/30 hover:border-primary-500 pb-0.5 transition-all">
                                Ir para o Login
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Side: Showcase / Illustration Section (Exactly like Login) */}
            <div className="hidden lg:flex flex-1 relative bg-slate-900 border-l border-white/10 overflow-hidden items-center justify-center">
                <div className="absolute inset-0 z-0">
                    <img 
                        src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop" 
                        alt="Cyber Background" 
                        className="w-full h-full object-cover opacity-30 mix-blend-overlay"
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-primary-900/80 to-accent-900/90 mix-blend-multiply"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
                </div>

                <div className="relative z-10 w-full max-w-2xl px-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
                        Inove mais Rápido.<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-300">Cresça sem Limites.</span>
                    </h2>
                    <p className="text-lg text-slate-300 mb-10 max-w-lg">
                        Adquira a plataforma tecnológica do futuro para o seu negócio. Registe-se e desfrute do Multicore ERP num ambiente SaaS poderoso e escalável.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center mb-4">
                                <HiOutlineDocumentCheck className="w-5 h-5 text-primary-300" />
                            </div>
                            <h3 className="text-white font-bold mb-2">Conformidade Fiscal</h3>
                            <p className="text-sm text-slate-400">Totalmente de acordo com as normas de tributação e certificação nacionais.</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-accent-500/20 flex items-center justify-center mb-4">
                                <HiOutlineBriefcase className="w-5 h-5 text-accent-300" />
                            </div>
                            <h3 className="text-white font-bold mb-2">Backoffice Completo</h3>
                            <p className="text-sm text-slate-400">Desde Gestão de Turnos a Recursos Humanos e Salários Integrados.</p>
                        </div>
                    </div>

                    <div className="mt-16 flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <div className="h-px w-8 bg-slate-700"></div>
                        <span>Enterprise Grade Software</span>
                    </div>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500/20 rounded-full blur-[100px] pointer-events-none"></div>
            </div>
        </div>
    );
}
