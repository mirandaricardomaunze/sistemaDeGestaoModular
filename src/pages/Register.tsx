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
    HiOutlineLocationMarker
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

// Module icons mapping - matches BusinessModule.code
const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    PHARMACY: HiOutlineBeaker,
    COMMERCIAL: HiOutlineShoppingCart,
    BOTTLE_STORE: HiOutlineBuildingStorefront,
    HOSPITALITY: HiOutlineHomeModern,
    RESTAURANT: HiOutlineCake,
    LOGISTICS: HiOutlineTruck,
};

// Integrated Pillars configuration (shown for all modules)
const integratedPillars = [
    { name: 'POS', icon: HiOutlineShoppingCart, color: 'text-green-500' },
    { name: 'CRM', icon: HiOutlineUsers, color: 'text-blue-500' },
    { name: 'RH', icon: HiOutlineBriefcase, color: 'text-purple-500' },
    { name: 'Fiscal', icon: HiOutlineDocumentCheck, color: 'text-emerald-500' },
];

// Validation Schema
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

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
        setValue,
        trigger,
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            moduleCode: '',
        },
    });

    const selectedModule = watch('moduleCode');

    const loadModules = async () => {
        setLoadingModules(true);
        setRegisterError(null);

        // Professional approach: Load from local constants first for instant UI
        setModules(OPTIONAL_MODULES);

        try {
            // Sync with backend to ensure latest descriptions/metadata if available
            const data = await modulesAPI.getAll();
            if (data && data.length > 0) {
                setModules(data);
            }
        } catch (error) {
            console.warn('Backend modules fetch failed, continuing with static constants:', error);
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

    // Shared input class generator
    const inputClass = (hasError?: boolean) =>
        `block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-dark-800/50 border ${hasError ? 'border-red-500' : 'border-slate-200 dark:border-dark-700/50'
        } rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all duration-200 sm:text-sm font-medium`;

    const stepLabels = ['Empresa', 'Solução', 'Acesso'];

    return (
        <div className="min-h-screen relative flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50 dark:bg-dark-950 overflow-hidden font-sans">
            {/* Animated Background Elements — same as Login */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-500/10 dark:bg-primary-500/5 rounded-full blur-3xl animate-blob"></div>
                <div className="absolute top-1/2 -right-24 w-80 h-80 bg-accent-500/10 dark:bg-accent-500/5 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-24 left-1/4 w-72 h-72 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
                <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] dark:opacity-[0.05]"></div>
            </div>

            <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-2xl px-4">
                {/* Logo & Header — same as Login */}
                <div className="text-center group">
                    <div className="relative mx-auto h-24 w-24 mb-8">
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary-600 to-accent-600 rounded-3xl blur-xl opacity-40 group-hover:opacity-60 transition duration-1000 animate-pulse-slow"></div>
                        <div className="relative h-full w-full rounded-3xl bg-gradient-to-tr from-primary-600 to-primary-500 flex items-center justify-center shadow-2xl border border-white/20">
                            <HiOutlineUserAdd className="w-12 h-12 text-white animate-float" />
                        </div>
                    </div>

                    <h2 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">
                        MULTICORE<span className="text-primary-500">.</span>
                    </h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                        Modular Management ERP
                    </p>
                </div>

                {/* Stepper */}
                <div className="mt-10 mb-8 px-4 sm:px-10">
                    <div className="flex items-center justify-between relative">
                        {/* Progress Line */}
                        <div className="absolute top-5 left-0 w-full h-[2px] bg-slate-200 dark:bg-dark-700 z-0"></div>
                        <div
                            className="absolute top-5 left-0 h-[2px] bg-primary-500 z-0 transition-all duration-700 ease-in-out"
                            style={{
                                width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%'
                            }}
                        ></div>

                        {stepLabels.map((label, i) => {
                            const s = i + 1;
                            return (
                                <div key={s} className="relative z-10 flex flex-col items-center">
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500
                                        ${currentStep >= s
                                            ? 'bg-gradient-to-r from-primary-600 to-primary-500 border-primary-600 text-white shadow-lg shadow-primary-500/30'
                                            : 'bg-white dark:bg-dark-800 border-slate-200 dark:border-dark-600 text-slate-400'
                                        }
                                    `}>
                                        {currentStep > s ? <HiOutlineCheckCircle className="w-6 h-6" /> : <span className="font-bold">{s}</span>}
                                    </div>
                                    <span className={`mt-3 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-500 ${currentStep >= s ? 'text-primary-600' : 'text-slate-400'}`}>{label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="animate-slide-up">
                    <div className={`bg-white/70 dark:bg-dark-900/40 backdrop-blur-xl py-10 px-6 sm:px-12 shadow-2xl sm:rounded-3xl border border-white/20 dark:border-dark-800/50 transition-all duration-500 ${shakeForm ? 'animate-shake' : ''}`}>

                        {/* Error Alert */}
                        {registerError && (
                            <div className="mb-6 rounded-2xl bg-red-50/50 dark:bg-red-950/20 p-4 border border-red-100 dark:border-red-900/30 animate-fade-in">
                                <div className="flex items-center gap-3">
                                    <HiOutlineExclamationCircle className="h-5 w-5 text-red-500 shrink-0" />
                                    <p className="text-sm font-medium text-red-800 dark:text-red-300">{registerError}</p>
                                    <button
                                        onClick={() => setRegisterError(null)}
                                        className="ml-auto p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    >
                                        <svg className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        <form className="space-y-8" onSubmit={handleSubmit(onSubmit)}>
                            {currentStep === 1 && (
                                <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-8">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Identidade Corporativa</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Dados oficiais para licenciamento e faturação.</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {/* Razão Social */}
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <label htmlFor="companyName" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Razão Social (Nome Oficial)</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <HiOutlineOfficeBuilding className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                                </div>
                                                <input
                                                    id="companyName"
                                                    type="text"
                                                    className={inputClass(!!errors.companyName)}
                                                    placeholder="Ex: Grupo Global, S.A."
                                                    {...register('companyName')}
                                                />
                                            </div>
                                            {errors.companyName && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.companyName.message}</p>}
                                        </div>

                                        {/* Nome Comercial */}
                                        <div className="space-y-1.5">
                                            <label htmlFor="companyTradeName" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Nome Comercial</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <HiOutlineMap className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                                </div>
                                                <input
                                                    id="companyTradeName"
                                                    type="text"
                                                    className={inputClass()}
                                                    placeholder="Nome que os clientes veem"
                                                    {...register('companyTradeName')}
                                                />
                                            </div>
                                        </div>

                                        {/* NUIT */}
                                        <div className="space-y-1.5">
                                            <label htmlFor="companyNuit" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">NUIT (Número Fiscal)</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <HiOutlineHashtag className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                                </div>
                                                <input
                                                    id="companyNuit"
                                                    type="text"
                                                    className={inputClass(!!errors.companyNuit)}
                                                    placeholder="9 dígitos obrigatórios"
                                                    {...register('companyNuit')}
                                                />
                                            </div>
                                            {errors.companyNuit && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.companyNuit.message}</p>}
                                        </div>

                                        {/* Telefone Empresa */}
                                        <div className="space-y-1.5">
                                            <label htmlFor="companyPhone" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Contacto Corporativo</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <HiOutlinePhone className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                                </div>
                                                <input
                                                    id="companyPhone"
                                                    type="tel"
                                                    className={inputClass(!!errors.companyPhone)}
                                                    placeholder="+258 8x xxx xxxx"
                                                    {...register('companyPhone')}
                                                />
                                            </div>
                                        </div>

                                        {/* Email Empresa */}
                                        <div className="space-y-1.5">
                                            <label htmlFor="companyEmail" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Email da Empresa</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <HiOutlineMail className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                                </div>
                                                <input
                                                    id="companyEmail"
                                                    type="email"
                                                    className={inputClass(!!errors.companyEmail)}
                                                    placeholder="geral@suaempresa.com"
                                                    {...register('companyEmail')}
                                                />
                                            </div>
                                        </div>

                                        {/* Endereço */}
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <label htmlFor="companyAddress" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Endereço Sede</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <HiOutlineLocationMarker className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                                </div>
                                                <input
                                                    id="companyAddress"
                                                    type="text"
                                                    className={inputClass(!!errors.companyAddress)}
                                                    placeholder="Rua, Bairro, Cidade, Província"
                                                    {...register('companyAddress')}
                                                />
                                            </div>
                                            {errors.companyAddress && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.companyAddress.message}</p>}
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={nextStep}
                                            className="relative w-full overflow-hidden group py-3.5 px-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-bold shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                                        >
                                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            <div className="flex items-center justify-center gap-2">
                                                <span>PRÓXIMO: ESCOLHER SOLUÇÃO</span>
                                                <HiOutlineChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-8">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Solução de Negócio</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Selecione o ecossistema ideal para as suas operações.</p>
                                    </div>

                                    {/* Module Selection */}
                                    <div className="space-y-4">
                                        {loadingModules ? (
                                            <div className="flex flex-col items-center justify-center py-16 space-y-4">
                                                <div className="relative">
                                                    <div className="w-12 h-12 border-4 border-primary-100 rounded-full"></div>
                                                    <div className="absolute top-0 w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-primary-600/50">A carregar soluções...</span>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                                                {modules.map((mod) => {
                                                    const Icon = moduleIcons[mod.code] || HiOutlineShoppingCart;
                                                    const isActive = selectedModule === mod.code;
                                                    return (
                                                        <label
                                                            key={mod.code}
                                                            className={`
                                                                group relative flex flex-col p-6 rounded-3xl border-2 cursor-pointer transition-all duration-500
                                                                ${isActive
                                                                    ? 'bg-gradient-to-r from-primary-600 to-primary-500 border-primary-600 shadow-2xl shadow-primary-500/30 text-white'
                                                                    : 'bg-slate-50/50 dark:bg-dark-800/30 border-slate-200/50 dark:border-dark-700/50 hover:border-primary-300 dark:hover:border-primary-800/50'
                                                                }
                                                            `}
                                                            onClick={() => setValue('moduleCode', mod.code)}
                                                        >
                                                            <div className="flex items-center justify-between mb-4">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`
                                                                        p-3 rounded-2xl transition-all duration-500
                                                                        ${isActive ? 'bg-white/20' : 'bg-white dark:bg-dark-800 text-primary-600 shadow-sm'}
                                                                    `}>
                                                                        <Icon className="w-6 h-6" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-lg font-black tracking-tight block">
                                                                            {mod.name}
                                                                        </span>
                                                                        <div className={`text-[9px] font-black uppercase tracking-[0.2em] opacity-60 ${isActive ? 'text-white' : 'text-primary-600'}`}>Pacote Enterprise</div>
                                                                    </div>
                                                                </div>
                                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isActive ? 'border-white bg-white' : 'border-slate-200 dark:border-dark-700'}`}>
                                                                    {isActive && <HiOutlineCheckCircle className="w-5 h-5 text-primary-600" />}
                                                                </div>
                                                            </div>

                                                            <p className={`text-xs mb-5 leading-relaxed font-medium ${isActive ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                {mod.description}
                                                            </p>

                                                            <div className={`pt-4 border-t ${isActive ? 'border-white/10' : 'border-slate-200 dark:border-dark-800'}`}>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {integratedPillars.map((p) => (
                                                                        <div key={p.name} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider backdrop-blur-md ${isActive ? 'bg-white/10 text-white' : 'bg-white dark:bg-dark-800 text-slate-400 shadow-sm'}`}>
                                                                            <p.icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : p.color}`} />
                                                                            {p.name}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {errors.moduleCode && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.moduleCode.message}</p>}
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                        <button
                                            type="button"
                                            onClick={prevStep}
                                            className="flex-1 flex justify-center items-center px-4 py-3.5 border border-slate-200 dark:border-dark-700 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-dark-800/50 hover:bg-white dark:hover:bg-dark-800 transition-all active:scale-[0.98]"
                                        >
                                            <HiOutlineChevronLeft className="mr-2 w-4 h-4" />
                                            Voltar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={nextStep}
                                            className="relative flex-[2] overflow-hidden group py-3.5 px-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-bold shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                                        >
                                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            <div className="flex items-center justify-center gap-2">
                                                <span>CONFIGURAR ACESSO</span>
                                                <HiOutlineChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-8">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Especialista Multicore</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Configure as credenciais de acesso do administrador principal.</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {/* Name */}
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <label htmlFor="name" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Nome Completo</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <HiOutlineUser className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                                </div>
                                                <input
                                                    id="name"
                                                    type="text"
                                                    className={inputClass(!!errors.name)}
                                                    placeholder="Seu nome completo"
                                                    {...register('name')}
                                                />
                                            </div>
                                            {errors.name && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.name.message}</p>}
                                        </div>

                                        {/* Email */}
                                        <div className="space-y-1.5">
                                            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">E-mail Corporativo</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <HiOutlineMail className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                                </div>
                                                <input
                                                    id="email"
                                                    type="email"
                                                    className={inputClass(!!errors.email)}
                                                    placeholder="admin@empresa.com"
                                                    {...register('email')}
                                                />
                                            </div>
                                            {errors.email && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.email.message}</p>}
                                        </div>

                                        {/* Phone */}
                                        <div className="space-y-1.5">
                                            <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Telefone / WhatsApp</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <HiOutlinePhone className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                                </div>
                                                <input
                                                    id="phone"
                                                    type="tel"
                                                    className={inputClass()}
                                                    placeholder="+258 8X XXX XXXX"
                                                    {...register('phone')}
                                                />
                                            </div>
                                        </div>

                                        {/* Password */}
                                        <div className="space-y-1.5">
                                            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Senha Segura</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <HiOutlineLockClosed className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                                </div>
                                                <input
                                                    id="password"
                                                    type={showPassword ? 'text' : 'password'}
                                                    className={`block w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-dark-800/50 border ${errors.password ? 'border-red-500' : 'border-slate-200 dark:border-dark-700/50'} rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all duration-200 sm:text-sm font-medium`}
                                                    placeholder="••••••••"
                                                    {...register('password')}
                                                />
                                                <div
                                                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-slate-400 hover:text-primary-500 transition-colors"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                                                </div>
                                            </div>
                                            {errors.password && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.password.message}</p>}
                                        </div>

                                        {/* Confirm Password */}
                                        <div className="space-y-1.5">
                                            <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1">Confirmar Senha</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                    <HiOutlineLockClosed className="h-5 w-5 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                                                </div>
                                                <input
                                                    id="confirmPassword"
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    className={`block w-full pl-11 pr-12 py-3 bg-slate-50 dark:bg-dark-800/50 border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-200 dark:border-dark-700/50'} rounded-2xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all duration-200 sm:text-sm font-medium`}
                                                    placeholder="••••••••"
                                                    {...register('confirmPassword')}
                                                />
                                                <div
                                                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-slate-400 hover:text-primary-500 transition-colors"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                >
                                                    {showConfirmPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                                                </div>
                                            </div>
                                            {errors.confirmPassword && <p className="text-xs font-medium text-red-500 mt-1 ml-1">{errors.confirmPassword.message}</p>}
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                        <button
                                            type="button"
                                            onClick={prevStep}
                                            className="flex-1 flex justify-center items-center px-4 py-3.5 border border-slate-200 dark:border-dark-700 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-dark-800/50 hover:bg-white dark:hover:bg-dark-800 transition-all active:scale-[0.98]"
                                        >
                                            <HiOutlineChevronLeft className="mr-2 w-4 h-4" />
                                            Voltar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="relative flex-[2] overflow-hidden group py-3.5 px-6 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-bold shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none"
                                        >
                                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            <div className="flex items-center justify-center gap-2">
                                                {isLoading ? (
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <HiOutlineCheckCircle className="w-5 h-5" />
                                                        <span>FINALIZAR E ATIVAR</span>
                                                    </>
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-dark-800/50">
                            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                                Já possui uma licença?{' '}
                                <Link to="/login" className="font-bold text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors">
                                    Entrar no Painel de Controlo
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
