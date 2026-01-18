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
    HiOutlineCube,
    HiOutlineDocumentCheck
} from 'react-icons/hi2';
import { useAuthStore } from '../stores/useAuthStore';
import { modulesAPI, type BusinessModule } from '../services/api';

// Module icons mapping
const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    pharmacy: HiOutlineBeaker,
    inventory: HiOutlineCube,
    hospitality: HiOutlineHomeModern,
    logistics: HiOutlineTruck,
    bottle_store: HiOutlineBuildingStorefront,
    commercial: HiOutlineBuildingStorefront,
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
        try {
            const data = await modulesAPI.getAll();
            setModules(data);
            if (data.length === 0) {
                setRegisterError('Nenhum módulo de negócio encontrado no sistema. Entre em contacto com o suporte.');
            }
        } catch (error) {
            console.error('Error loading modules:', error);
            setRegisterError('Erro ao carregar módulos de negócio. Verifique sua conexão.');
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

    return (
        <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
            <div className="sm:mx-auto sm:w-full sm:max-w-lg">
                <div className="text-center">
                    <div className="mx-auto h-20 w-20 rounded-2xl bg-primary-600 flex items-center justify-center shadow-2xl shadow-primary-500/30 mb-6 transform hover:rotate-6 transition-transform">
                        <HiOutlineUserAdd className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                        Nova Licença
                    </h2>
                    <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Ative o seu ecossistema empresarial em segundos
                    </p>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
                {/* Stepper */}
                <div className="mb-10 px-4 sm:px-10">
                    <div className="flex items-center justify-between relative">
                        {/* Progress Line */}
                        <div className="absolute top-5 left-0 w-full h-[2px] bg-gray-200 dark:bg-gray-700 z-0"></div>
                        <div
                            className="absolute top-5 left-0 h-[2px] bg-primary-600 z-0 transition-all duration-700 ease-in-out"
                            style={{
                                width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%'
                            }}
                        ></div>

                        {/* Step 1 Indicator */}
                        <div className="relative z-10 flex flex-col items-center">
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500
                                ${currentStep >= 1 ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}
                            `}>
                                {currentStep > 1 ? <HiOutlineCheckCircle className="w-6 h-6" /> : <span className="font-bold">1</span>}
                            </div>
                            <span className={`mt-3 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-500 ${currentStep >= 1 ? 'text-primary-600' : 'text-gray-500'}`}>Empresa</span>
                        </div>

                        {/* Step 2 Indicator */}
                        <div className="relative z-10 flex flex-col items-center">
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500
                                ${currentStep >= 2 ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'}
                            `}>
                                {currentStep > 2 ? <HiOutlineCheckCircle className="w-6 h-6" /> : <span className="font-bold">2</span>}
                            </div>
                            <span className={`mt-3 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-500 ${currentStep >= 2 ? 'text-primary-600' : 'text-gray-400'}`}>Solução</span>
                        </div>

                        {/* Step 3 Indicator */}
                        <div className="relative z-10 flex flex-col items-center">
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500
                                ${currentStep === 3 ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-500/30' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'}
                            `}>
                                <span className="font-bold">3</span>
                            </div>
                            <span className={`mt-3 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-500 ${currentStep === 3 ? 'text-primary-600' : 'text-gray-400'}`}>Acesso</span>
                        </div>
                    </div>
                </div>

                <div className={`bg-white dark:bg-gray-800 py-10 px-6 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] sm:rounded-[2rem] sm:px-12 border border-white/20 dark:border-gray-700/50 backdrop-blur-sm transition-all duration-300 ${shakeForm ? 'animate-shake' : ''}`}>

                    {/* Error Alert */}
                    {registerError && (
                        <div className="mb-8 rounded-2xl bg-red-50 dark:bg-red-900/10 p-4 border border-red-200 dark:border-red-900/20 animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex items-center">
                                <HiOutlineExclamationCircle className="h-5 w-5 text-red-500 shrink-0" />
                                <p className="ml-3 text-sm font-bold text-red-800 dark:text-red-200">{registerError}</p>
                            </div>
                        </div>
                    )}

                    <form className="space-y-8" onSubmit={handleSubmit(onSubmit)}>
                        {currentStep === 1 && (
                            <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-8">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Identidade Corporativa</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Dados oficiais para licenciamento e faturação.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {/* Razão Social */}
                                    <div className="sm:col-span-2 space-y-2">
                                        <label htmlFor="companyName" className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Razão Social (Nome Oficial)</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiOutlineOfficeBuilding className="h-5 w-5 text-gray-300 group-focus-within:text-primary-500 transition-colors" />
                                            </div>
                                            <input
                                                id="companyName"
                                                type="text"
                                                className={`block w-full pl-12 pr-4 py-4 border-2 transition-all duration-300 outline-none
                                                    ${errors.companyName ? 'border-red-200 bg-red-50/30' : 'border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/50 focus:border-primary-500 focus:bg-white'} 
                                                    rounded-2xl text-gray-900 dark:text-white sm:text-sm font-medium`}
                                                placeholder="Ex: Grupo Global, S.A."
                                                {...register('companyName')}
                                            />
                                        </div>
                                        {errors.companyName && <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider ml-1">{errors.companyName.message}</p>}
                                    </div>

                                    {/* Nome Comercial / Trade Name */}
                                    <div className="space-y-2">
                                        <label htmlFor="companyTradeName" className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Nome Comercial</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiOutlineMap className="h-5 w-5 text-gray-300 group-focus-within:text-primary-500 transition-colors" />
                                            </div>
                                            <input
                                                id="companyTradeName"
                                                type="text"
                                                className="block w-full pl-12 pr-4 py-4 border-2 border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/50 rounded-2xl focus:border-primary-500 focus:bg-white outline-none transition-all font-medium text-gray-900 dark:text-white sm:text-sm"
                                                placeholder="Nome que os clientes vêem"
                                                {...register('companyTradeName')}
                                            />
                                        </div>
                                    </div>

                                    {/* NUIT */}
                                    <div className="space-y-2">
                                        <label htmlFor="companyNuit" className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">NUIT (Número Fiscal)</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiOutlineHashtag className="h-5 w-5 text-gray-300 group-focus-within:text-primary-500 transition-colors" />
                                            </div>
                                            <input
                                                id="companyNuit"
                                                type="text"
                                                className={`block w-full pl-12 pr-4 py-4 border-2 transition-all duration-300 outline-none
                                                    ${errors.companyNuit ? 'border-red-200 bg-red-50/30' : 'border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/50 focus:border-primary-500 focus:bg-white'} 
                                                    rounded-2xl text-gray-900 dark:text-white sm:text-sm font-medium`}
                                                placeholder="9 dígitos obrigatórios"
                                                {...register('companyNuit')}
                                            />
                                        </div>
                                        {errors.companyNuit && <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider ml-1">{errors.companyNuit.message}</p>}
                                    </div>

                                    {/* Telefone Empresa */}
                                    <div className="space-y-2">
                                        <label htmlFor="companyPhone" className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Contacto Corporativo</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiOutlinePhone className="h-5 w-5 text-gray-300 group-focus-within:text-primary-500 transition-colors" />
                                            </div>
                                            <input
                                                id="companyPhone"
                                                type="tel"
                                                className={`block w-full pl-12 pr-4 py-4 border-2 transition-all duration-300 outline-none
                                                    ${errors.companyPhone ? 'border-red-200 bg-red-50/30' : 'border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/50 focus:border-primary-500 focus:bg-white'} 
                                                    rounded-2xl text-gray-900 dark:text-white sm:text-sm font-medium`}
                                                placeholder="+258 8x xxx xxxx"
                                                {...register('companyPhone')}
                                            />
                                        </div>
                                    </div>

                                    {/* Email Empresa */}
                                    <div className="space-y-2">
                                        <label htmlFor="companyEmail" className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Email da Empresa</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiOutlineMail className="h-5 w-5 text-gray-300 group-focus-within:text-primary-500 transition-colors" />
                                            </div>
                                            <input
                                                id="companyEmail"
                                                type="email"
                                                className={`block w-full pl-12 pr-4 py-4 border-2 transition-all duration-300 outline-none
                                                    ${errors.companyEmail ? 'border-red-200 bg-red-50/30' : 'border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/50 focus:border-primary-500 focus:bg-white'} 
                                                    rounded-2xl text-gray-900 dark:text-white sm:text-sm font-medium`}
                                                placeholder="geral@suaempresa.com"
                                                {...register('companyEmail')}
                                            />
                                        </div>
                                    </div>

                                    {/* Endereço */}
                                    <div className="sm:col-span-2 space-y-2">
                                        <label htmlFor="companyAddress" className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Endereço Sede</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiOutlineLocationMarker className="h-5 w-5 text-gray-300 group-focus-within:text-primary-500 transition-colors" />
                                            </div>
                                            <input
                                                id="companyAddress"
                                                type="text"
                                                className={`block w-full pl-12 pr-4 py-4 border-2 transition-all duration-300 outline-none
                                                    ${errors.companyAddress ? 'border-red-200 bg-red-50/30' : 'border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/50 focus:border-primary-500 focus:bg-white'} 
                                                    rounded-2xl text-gray-900 dark:text-white sm:text-sm font-medium`}
                                                placeholder="Rua, Bairro, Cidade, Província"
                                                {...register('companyAddress')}
                                            />
                                        </div>
                                        {errors.companyAddress && <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider ml-1">{errors.companyAddress.message}</p>}
                                    </div>
                                </div>

                                <div className="pt-6">
                                    <button
                                        type="button"
                                        onClick={nextStep}
                                        className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors active:scale-[0.98] group"
                                    >
                                        Próximo: Escolher Solução
                                        <HiOutlineChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-8">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Solução de Negócio</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Selecione o ecossistema ideal para as suas operações.</p>
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
                                                            group relative flex flex-col p-6 rounded-[1.5rem] border-2 cursor-pointer transition-all duration-500
                                                            ${isActive
                                                                ? 'bg-primary-600 border-primary-600 shadow-2xl shadow-primary-500/40 text-white'
                                                                : 'bg-gray-50 dark:bg-gray-900/50 border-transparent hover:border-primary-200 dark:hover:border-primary-800/50'
                                                            }
                                                        `}
                                                        onClick={() => setValue('moduleCode', mod.code)}
                                                    >
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`
                                                                    p-3 rounded-2xl transition-all duration-500
                                                                    ${isActive ? 'bg-white/20' : 'bg-white dark:bg-gray-800 text-primary-600 shadow-sm'}
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
                                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isActive ? 'border-white bg-white' : 'border-gray-200 dark:border-gray-700'}`}>
                                                                {isActive && <HiOutlineCheckCircle className="w-5 h-5 text-primary-600" />}
                                                            </div>
                                                        </div>

                                                        <p className={`text-xs mb-5 leading-relaxed font-medium ${isActive ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                                                            {mod.description}
                                                        </p>

                                                        <div className={`pt-4 border-t ${isActive ? 'border-white/10' : 'border-gray-200 dark:border-gray-800'}`}>
                                                            <div className="flex flex-wrap gap-2">
                                                                {integratedPillars.map((p) => (
                                                                    <div key={p.name} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider backdrop-blur-md ${isActive ? 'bg-white/10 text-white' : 'bg-white dark:bg-gray-800 text-gray-400 shadow-sm'}`}>
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
                                    {errors.moduleCode && <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider ml-1">{errors.moduleCode.message}</p>}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        className="flex-1 flex justify-center items-center px-4 py-2.5 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors active:scale-[0.98]"
                                    >
                                        <HiOutlineChevronLeft className="mr-2 w-4 h-4" />
                                        Voltar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={nextStep}
                                        className="flex-[2] flex items-center justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors active:scale-[0.98] group"
                                    >
                                        Configurar Acesso
                                        <HiOutlineChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-8">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Mestre do Sistema</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Configure as credenciais de acesso do administrador principal.</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {/* Name Input */}
                                    <div className="sm:col-span-2 space-y-2">
                                        <label htmlFor="name" className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Nome Completo</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiOutlineUser className="h-5 w-5 text-gray-300 group-focus-within:text-primary-500 transition-colors" />
                                            </div>
                                            <input
                                                id="name"
                                                type="text"
                                                className="block w-full pl-12 pr-4 py-4 border-2 border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/50 rounded-2xl focus:border-primary-500 focus:bg-white dark:focus:bg-gray-900 outline-none transition-all font-medium"
                                                placeholder="Seu nome completo"
                                                {...register('name')}
                                            />
                                        </div>
                                        {errors.name && <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider ml-1">{errors.name.message}</p>}
                                    </div>

                                    {/* Email Input */}
                                    <div className="space-y-2">
                                        <label htmlFor="email" className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">E-mail Corporativo</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiOutlineMail className="h-5 w-5 text-gray-300 group-focus-within:text-primary-500 transition-colors" />
                                            </div>
                                            <input
                                                id="email"
                                                type="email"
                                                className="block w-full pl-12 pr-4 py-4 border-2 border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/50 rounded-2xl focus:border-primary-500 focus:bg-white dark:focus:bg-gray-900 outline-none transition-all font-medium"
                                                placeholder="admin@empresa.com"
                                                {...register('email')}
                                            />
                                        </div>
                                        {errors.email && <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider ml-1">{errors.email.message}</p>}
                                    </div>

                                    {/* Phone Input */}
                                    <div className="space-y-2">
                                        <label htmlFor="phone" className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Telefone / WhatsApp</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiOutlinePhone className="h-5 w-5 text-gray-300 group-focus-within:text-primary-500 transition-colors" />
                                            </div>
                                            <input
                                                id="phone"
                                                type="tel"
                                                className="block w-full pl-12 pr-4 py-4 border-2 border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/50 rounded-2xl focus:border-primary-500 focus:bg-white dark:focus:bg-gray-900 outline-none transition-all font-medium"
                                                placeholder="+258 8X XXX XXXX"
                                                {...register('phone')}
                                            />
                                        </div>
                                    </div>

                                    {/* Password */}
                                    <div className="space-y-2">
                                        <label htmlFor="password" title="Senha de acesso" className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Senha Segura</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiOutlineLockClosed className="h-5 w-5 text-gray-300 group-focus-within:text-primary-500 transition-colors" />
                                            </div>
                                            <input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                className="block w-full pl-12 pr-12 py-4 border-2 border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/50 rounded-2xl focus:border-primary-500 focus:bg-white dark:focus:bg-gray-900 outline-none transition-all font-medium"
                                                placeholder="••••••••"
                                                {...register('password')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-300 hover:text-primary-500 transition-colors"
                                            >
                                                {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                        {errors.password && <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider ml-1">{errors.password.message}</p>}
                                    </div>

                                    {/* Confirm Password */}
                                    <div className="space-y-2">
                                        <label htmlFor="confirmPassword" title="Confirmar senha" className="block text-xs font-black uppercase text-gray-400 tracking-widest ml-1">Confirmar Senha</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <HiOutlineLockClosed className="h-5 w-5 text-gray-300 group-focus-within:text-primary-500 transition-colors" />
                                            </div>
                                            <input
                                                id="confirmPassword"
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                className="block w-full pl-12 pr-12 py-4 border-2 border-gray-50 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-900/50 rounded-2xl focus:border-primary-500 focus:bg-white dark:focus:bg-gray-900 outline-none transition-all font-medium"
                                                placeholder="••••••••"
                                                {...register('confirmPassword')}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-300 hover:text-primary-500 transition-colors"
                                            >
                                                {showConfirmPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                        {errors.confirmPassword && <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider ml-1">{errors.confirmPassword.message}</p>}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        className="flex-1 flex justify-center items-center px-4 py-2.5 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors active:scale-[0.98]"
                                    >
                                        <HiOutlineChevronLeft className="mr-2 w-4 h-4" />
                                        Voltar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className={`flex-[2] flex items-center justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors active:scale-[0.98] ${isLoading ? 'opacity-75 cursor-wait' : ''}`}
                                    >
                                        {isLoading ? (
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <HiOutlineCheckCircle className="mr-2 w-5 h-5" />
                                        )}
                                        {isLoading ? 'A Processar...' : 'Finalizar e Ativar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>

                    <div className="mt-12">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                                    Já possui uma licença?
                                </span>
                            </div>
                        </div>

                        <div className="mt-6">
                            <Link
                                to="/login"
                                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                            >
                                Entrar no Painel de Controlo
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="mt-12 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400/50">
                    &copy; {new Date().getFullYear()} Sistema Altamente Evoluído
                </p>
            </div>
        </div>
    );
}
