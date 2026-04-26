import { logger } from '../utils/logger';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlineUser,
    HiOutlineEnvelope as HiOutlineMail,
    HiOutlineLockClosed,
    HiOutlinePhone,
    HiOutlineUserPlus as HiOutlineUserAdd,
    HiOutlineExclamationCircle,
    HiOutlineBuildingOffice as HiOutlineOfficeBuilding,
    HiOutlineChevronRight,
    HiOutlineCheckCircle,
    HiOutlineShoppingCart,
    HiOutlineHashtag,
    HiOutlineMapPin as HiOutlineLocationMarker,
    HiOutlineBeaker,
    HiOutlineBuildingStorefront,
    HiOutlineHomeModern,
    HiOutlineTruck,
    HiOutlineBriefcase,
    HiOutlineDocumentCheck,
    HiOutlineCake
} from 'react-icons/hi2';
import { useAuthStore } from '../stores/useAuthStore';
import { modulesAPI } from '../services/api';
import { OPTIONAL_MODULES, type BusinessModule } from '../constants/modules.constants';
import { Button, Input } from '../components/ui';

// Module icons mapping
const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    PHARMACY: HiOutlineBeaker,
    COMMERCIAL: HiOutlineShoppingCart,
    BOTTLE_STORE: HiOutlineBuildingStorefront,
    HOSPITALITY: HiOutlineHomeModern,
    RESTAURANT: HiOutlineCake,
    LOGISTICS: HiOutlineTruck,
};

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
    const [registerError, setRegisterError] = useState<string | null>(null);
    const [shakeForm, setShakeForm] = useState(false);
    const [modules, setModules] = useState<BusinessModule[]>([]);
    const [, setLoadingModules] = useState(true);

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



    const stepLabels = ['Empresa', 'Solução', 'Acesso'];

    return (
        <div className="min-h-screen flex w-full font-sans bg-white dark:bg-dark-950 overflow-hidden">
            {/* Left Side: Form Section */}
            <div className="w-full lg:w-[45%] xl:w-[40%] flex flex-col px-6 sm:px-12 lg:px-16 py-8 relative z-10 transition-all h-screen overflow-y-auto custom-scrollbar">
                <div className="w-full max-w-[420px] mx-auto animate-fade-in my-auto py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-lg bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
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
                                                ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-500/30'
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
                        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-900/30">
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
                                    <Input
                                        label="Razão Social"
                                        placeholder="Ex: Farmácia Sagrada Lda"
                                        leftIcon={<HiOutlineOfficeBuilding className="h-5 w-5" />}
                                        error={errors.companyName?.message}
                                        size="lg"
                                        {...register('companyName')}
                                    />

                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="NUIT"
                                            placeholder="900000000"
                                            leftIcon={<HiOutlineHashtag className="h-5 w-5" />}
                                            error={errors.companyNuit?.message}
                                            size="lg"
                                            {...register('companyNuit')}
                                        />
                                        <Input
                                            label="Telefone"
                                            placeholder="84 000 0000"
                                            leftIcon={<HiOutlinePhone className="h-5 w-5" />}
                                            error={errors.companyPhone?.message}
                                            size="lg"
                                            {...register('companyPhone')}
                                        />
                                    </div>
                                    <Input
                                        label="Endereço (Sede)"
                                        placeholder="Avenida, Cidade"
                                        leftIcon={<HiOutlineLocationMarker className="h-5 w-5" />}
                                        error={errors.companyAddress?.message}
                                        size="lg"
                                        {...register('companyAddress')}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    onClick={nextStep}
                                    className="w-full relative overflow-hidden group mt-6 shadow-xl hover:-translate-y-0.5 transition-all"
                                    size="lg"
                                    rightIcon={<HiOutlineChevronRight className="w-4 h-4 text-white/50" />}
                                >
                                    PRÓXIMO PASSO
                                </Button>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-5">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Solução Principal</h2>
                                    <p className="text-xs text-slate-500 mb-4">Que ecossistema Multicore ir impulsionar o seu negócio?</p>
                                </div>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {modules.map((mod) => {
                                        const Icon = moduleIcons[mod.code] || HiOutlineShoppingCart;
                                        const isActive = selectedModule === mod.code;
                                        return (
                                            <label
                                                key={mod.code}
                                                className={`group flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all duration-300
                                                    ${isActive ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-100 dark:border-dark-800 hover:border-primary-200'}
                                                `}
                                                onClick={() => setValue('moduleCode', mod.code)}
                                            >
                                                <div className={`p-3 rounded-lg mr-4 ${isActive ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30' : 'bg-slate-100 dark:bg-dark-800 text-slate-500'}`}>
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
                                    <Button type="button" variant="secondary" onClick={prevStep} size="lg" className="flex-1">Voltar</Button>
                                    <Button type="button" onClick={nextStep} size="lg" className="flex-[2] shadow-xl hover:-translate-y-0.5">Próximo</Button>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-5">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Acesso do Gestãor</h2>
                                    <p className="text-xs text-slate-500 mb-4">A primeira conta é sempre o Super Administrador (Master).</p>
                                </div>
                                <div className="space-y-4">
                                    <Input
                                        label="Nome do Administrador"
                                        placeholder="Rui Silva"
                                        leftIcon={<HiOutlineUser className="h-5 w-5" />}
                                        error={errors.name?.message}
                                        size="lg"
                                        {...register('name')}
                                    />
                                    <Input
                                        label="Email Login"
                                        type="email"
                                        placeholder="admin@multicore.co.mz"
                                        leftIcon={<HiOutlineMail className="h-5 w-5" />}
                                        error={errors.email?.message}
                                        size="lg"
                                        {...register('email')}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Senha Segura"
                                            type="password"
                                            placeholder="••••••••"
                                            leftIcon={<HiOutlineLockClosed className="h-5 w-5" />}
                                            error={errors.password?.message}
                                            size="lg"
                                            {...register('password')}
                                        />
                                        <Input
                                            label="Confirmar"
                                            type="password"
                                            placeholder="••••••••"
                                            leftIcon={<HiOutlineLockClosed className="h-5 w-5" />}
                                            error={errors.confirmPassword?.message}
                                            size="lg"
                                            {...register('confirmPassword')}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button type="button" variant="secondary" onClick={prevStep} disabled={isLoading} size="lg" className="flex-1 opacity-80 disabled:opacity-50">Voltar</Button>
                                    <Button type="submit" isLoading={isLoading} size="lg" className="flex-[2] shadow-xl hover:-translate-y-0.5 text-sm">
                                        FINALIZAR REGISTO
                                    </Button>
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
                    <div className="absolute inset-0 bg-primary-950/90 mix-blend-multiply"></div>
                    <div className="absolute inset-0 bg-slate-900/30"></div>
                </div>

                <div className="relative z-10 w-full max-w-2xl px-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
                        Inove mais Rápido.<br />
                        <span className="text-primary-400">Cresça sem Limites.</span>
                    </h2>
                    <p className="text-lg text-slate-300 mb-10 max-w-lg">
                        Adquira a plataforma tecnológica do futuro para o seu negócio. Registe-se e desfrute do Multicore ERP num ambiente SaaS poderoso e escalável.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center mb-4">
                                <HiOutlineDocumentCheck className="w-5 h-5 text-primary-300" />
                            </div>
                            <h3 className="text-white font-bold mb-2">Conformidade Fiscal</h3>
                            <p className="text-sm text-slate-400">Totalmente de acordo com as normas de tributação e certificação nacionais.</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg p-6 hover:bg-white/10 transition-colors">
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

