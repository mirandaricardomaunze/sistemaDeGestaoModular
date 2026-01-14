import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    HiOutlineCog,
    HiOutlineOfficeBuilding,
    HiOutlineShieldCheck,
    HiOutlineCloudDownload,
    HiOutlineSun,
    HiOutlineMoon,
    HiOutlineUser,
    HiOutlineLockClosed,
    HiOutlineUsers,
    HiOutlinePencilAlt,
    HiOutlineTrash,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
} from 'react-icons/hi';
import { Card, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { useStore } from '../stores/useStore';
import { useAuthStore, roleLabels } from '../stores/useAuthStore';
import type { BusinessType } from '../types';
import { authAPI, adminAPI } from '../services/api';
import toast from 'react-hot-toast';

// Company Schema
const companySchema = z.object({
    companyName: z.string().min(2, 'Nome é obrigatório'),
    tradeName: z.string().optional(),
    taxId: z.string().min(9, 'NUIT inválido'),
    phone: z.string().min(10, 'Telefone inválido'),
    email: z.string().email('Email inválido'),
    address: z.string().min(5, 'Endereço é obrigatório'),
    city: z.string().min(2, 'Cidade é obrigatória'),
    state: z.string().min(2, 'Estado é obrigatório'),
    zipCode: z.string().optional(),
    printerType: z.enum(['thermal', 'a4']),
    thermalPaperWidth: z.enum(['80mm', '58mm']),
    autoPrintReceipt: z.boolean(),
    bankAccounts: z.array(z.object({
        bankName: z.string().min(1, 'Banco é obrigatório'),
        accountNumber: z.string().min(1, 'Conta é obrigatória'),
        nib: z.string().optional(),
        holderName: z.string().optional(),
    })).default([]),
});

type CompanyFormData = z.infer<typeof companySchema>;

// Alert Config Schema
const alertConfigSchema = z.object({
    lowStockThreshold: z.coerce.number().min(1),
    expiryWarningDays: z.coerce.number().min(1),
    paymentDueDays: z.coerce.number().min(1),
    enableEmailAlerts: z.boolean(),
    enablePushNotifications: z.boolean(),
});

type AlertConfigFormData = z.infer<typeof alertConfigSchema>;

// Profile Schema
const profileSchema = z.object({
    name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
    email: z.string().email('Email inválido'),
    phone: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Password Schema
const passwordSchema = z.object({
    currentPassword: z.string().min(1, 'Senha actual é obrigatória'),
    newPassword: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

// User Schema
const userManageSchema = z.object({
    name: z.string().min(3, 'Nome é obrigatório'),
    email: z.string().email('Email inválido'),
    role: z.enum(['admin', 'manager', 'operator', 'cashier', 'stock_keeper', 'super_admin']),
    phone: z.string().optional(),
});

type UserManageFormData = z.infer<typeof userManageSchema>;

export default function Settings() {
    const { theme, toggleTheme, businessType, setBusinessType, alertConfig, updateAlertConfig, companySettings, updateCompanySettings } = useStore();
    const { user } = useAuthStore();
    const { t } = useTranslation();

    const [activeTab, setActiveTab] = useState<'profile' | 'company' | 'system' | 'alerts' | 'backup' | 'users' | 'superadmin'>('profile');
    const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
    const [backupDataToRestore, setBackupDataToRestore] = useState<any>(null);
    const [moduleValidationOpen, setModuleValidationOpen] = useState(false);
    const [attemptedModule, setAttemptedModule] = useState<string>('');

    // Users Management State
    const [users, setUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    // Super Admin State
    const [companies, setCompanies] = useState<any[]>([]);
    const [adminStats, setAdminStats] = useState<any>(null);
    const [isLoadingStats, setIsLoadingStats] = useState(false);
    const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

    // Company Form
    const {
        register: registerCompany,
        control: controlCompany,
        handleSubmit: handleSubmitCompany,
        reset: resetCompany,
        watch: watchCompany,
        formState: { errors: companyErrors, isDirty: isCompanyDirty },
    } = useForm<CompanyFormData>({
        resolver: zodResolver(companySchema) as never,
        defaultValues: companySettings,
    });

    const { fields: bankFields, append: appendBank, remove: removeBank } = useFieldArray({
        control: controlCompany,
        name: 'bankAccounts' as never,
    });

    // Reset company form when store data changes
    useEffect(() => {
        resetCompany(companySettings);
    }, [companySettings, resetCompany]);

    // Alert Config Form
    const {
        register: registerAlerts,
        handleSubmit: handleSubmitAlerts,
        reset: resetAlerts,
        watch: watchAlerts,
        setValue: setAlertValue,
        formState: { isDirty: isAlertsDirty },
    } = useForm<AlertConfigFormData>({
        resolver: zodResolver(alertConfigSchema) as never,
        defaultValues: alertConfig,
    });

    const enableEmailAlerts = watchAlerts('enableEmailAlerts');
    const enablePushNotifications = watchAlerts('enablePushNotifications');

    useEffect(() => {
        resetAlerts(alertConfig);
    }, [alertConfig, resetAlerts]);

    const onSubmitCompany = (data: CompanyFormData) => {
        updateCompanySettings({
            companyName: data.companyName,
            tradeName: data.tradeName || '',
            taxId: data.taxId,
            phone: data.phone,
            email: data.email,
            address: data.address,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            printerType: data.printerType,
            thermalPaperWidth: data.thermalPaperWidth,
            autoPrintReceipt: data.autoPrintReceipt,
            businessType: businessType, // Sync current businessType to company settings
        });
        toast.success('Dados da empresa salvos com sucesso!');
        resetCompany(data);
    };

    const onSubmitAlerts = (data: AlertConfigFormData) => {
        updateAlertConfig(data);
        toast.success('Configurações de alertas salvas!');
        resetAlerts(data);
    };

    const handleExportData = () => {
        const data = {
            version: '1.0',
            company: companySettings,
            alertConfig,
            businessType,
            exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${companySettings?.companyName?.replace(/\s+/g, '_') ?? 'empresa'}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Backup exportado com sucesso!');
    };

    // Module mappings
    const BUSINESS_TYPE_TO_MODULE: Record<string, string> = {
        'pharmacy': 'PHARMACY',
        'retail': 'COMMERCIAL',
        'bottlestore': 'BOTTLE_STORE',
        'hotel': 'HOTEL',
        'logistics': 'LOGISTICS',
        'supermarket': 'COMMERCIAL'
    };

    const getModuleName = (moduleCode: string): string => {
        const names: Record<string, string> = {
            'PHARMACY': 'Farmácia',
            'COMMERCIAL': 'Comércio',
            'BOTTLE_STORE': 'Garrafeira',
            'HOTEL': 'Hotel',
            'LOGISTICS': 'Logística',
            'RESTAURANT': 'Restaurante'
        };
        return names[moduleCode] || moduleCode;
    };

    const businessTypeOptions = [
        { value: 'retail', label: 'Comércio / Retalho', icon: '🏪', description: 'Loja de artigos diversos, vestuário, eletrónicos' },
        { value: 'pharmacy', label: 'Farmácia', icon: '💊', description: 'Medicamentos, controle de lotes e validades' },
        { value: 'supermarket', label: 'Supermercado', icon: '🛒', description: 'Mercearia, balança e alto volume de vendas' },
        { value: 'bottlestore', label: 'Bottle Store', icon: '🍺', description: 'Garrafeira, bebidas e gestão de vasilhame' },
        { value: 'hotel', label: 'Hotel / Residencial', icon: '🏨', description: 'Hospedagem, gestão de quartos e reservas' },
        { value: 'logistics', label: 'Logística / Armazém', icon: '🚚', description: 'Gestão de estoque multifocal e transferências' },
    ];

    const stateOptions = [
        { value: 'Maputo Cidade', label: 'Maputo Cidade' },
        { value: 'Maputo Província', label: 'Maputo Província' },
        { value: 'Gaza', label: 'Gaza' },
        { value: 'Inhambane', label: 'Inhambane' },
        { value: 'Sofala', label: 'Sofala' },
        { value: 'Manica', label: 'Manica' },
        { value: 'Tete', label: 'Tete' },
        { value: 'Zambézia', label: 'Zambézia' },
        { value: 'Nampula', label: 'Nampula' },
        { value: 'Niassa', label: 'Niassa' },
        { value: 'Cabo Delgado', label: 'Cabo Delgado' },
    ];

    const tabs = [
        { id: 'profile', label: 'Meu Perfil', icon: HiOutlineUser },
        { id: 'company', label: 'Empresa', icon: HiOutlineOfficeBuilding },
        { id: 'system', label: 'Sistema', icon: HiOutlineCog },
        { id: 'alerts', label: 'Alertas', icon: HiOutlineShieldCheck },
        { id: 'backup', label: 'Backup', icon: HiOutlineCloudDownload },
        { id: 'users', label: 'Utilizadores', icon: HiOutlineUsers, roles: ['admin', 'super_admin'] },
        { id: 'superadmin', label: 'Super Admin', icon: HiOutlineShieldCheck, roles: ['super_admin'] },
    ].filter(tab => !tab.roles || (user?.role && tab.roles.includes(user.role)));

    // Profile Form
    const {
        register: registerProfile,
        handleSubmit: handleSubmitProfile,
        reset: resetProfile,
        formState: { errors: profileErrors, isDirty: isProfileDirty },
    } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema) as never,
        defaultValues: {
            name: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
        },
    });

    // Password Form
    const {
        register: registerPassword,
        handleSubmit: handleSubmitPassword,
        reset: resetPassword,
        formState: { errors: passwordErrors },
    } = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema) as never,
    });

    // User Management Form
    const {
        register: registerUser,
        handleSubmit: handleSubmitUser,
        reset: resetUser,
        formState: { errors: userErrors, isSubmitting: isUserSubmitting },
    } = useForm<UserManageFormData>({
        resolver: zodResolver(userManageSchema) as never,
    });

    // Reset profile form when user changes
    useEffect(() => {
        if (user) {
            resetProfile({
                name: user.name,
                email: user.email,
                phone: user.phone || '',
            });
        }
    }, [user, resetProfile]);

    const onSubmitProfile = async (data: ProfileFormData) => {
        if (!user) return;

        try {
            const updatedUser = await authAPI.updateProfile(data);
            useAuthStore.setState({ user: { ...user, ...updatedUser } });
            toast.success('Perfil actualizado com sucesso!');
            resetProfile(data);
        } catch (error) {
            console.error('Profile update error:', error);
            toast.error('Erro ao atualizar perfil.');
        }
    };

    const onSubmitPassword = async (data: PasswordFormData) => {
        if (!user) return;

        try {
            await authAPI.changePassword(data.currentPassword, data.newPassword);
            toast.success('Senha alterada com sucesso!');
            resetPassword();
        } catch (error: any) {
            console.error('Password update error:', error);
            const msg = error.response?.data?.error || 'Erro ao alterar senha.';
            toast.error(msg);
        }
    };

    // User Management Functions
    const fetchUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const data = await authAPI.getUsers();
            setUsers(data);
        } catch (error) {
            console.error('Fetch users error:', error);
            toast.error('Erro ao carregar utilizadores.');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        }
    }, [activeTab]);

    const handleEditUser = (user: any) => {
        setSelectedUser(user);
        resetUser({
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone || '',
        });
        setIsUserModalOpen(true);
    };

    const onSubmitUser = async (data: UserManageFormData) => {
        try {
            if (selectedUser) {
                await authAPI.updateUserData(selectedUser.id, data);
                toast.success('Utilizador actualizado!');
            }
            setIsUserModalOpen(false);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao salvar utilizador.');
        }
    };

    const handleToggleUserStatus = async (user: any) => {
        try {
            await authAPI.toggleUserStatus(user.id, !user.isActive);
            toast.success(`Utilizador ${user.isActive ? 'desactivado' : 'activado'}!`);
            fetchUsers();
        } catch (error) {
            toast.error('Erro ao alterar status.');
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        try {
            await authAPI.deleteUser(selectedUser.id);
            toast.success('Utilizador removido com sucesso!');
            setIsDeleteModalOpen(false);
            fetchUsers();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Erro ao remover utilizador.');
        }
    };

    // Super Admin Functions
    const fetchAdminStats = async () => {
        setIsLoadingStats(true);
        try {
            const data = await adminAPI.getStats();
            setAdminStats(data);
        } catch (error) {
            console.error('Fetch admin stats error:', error);
            toast.error('Erro ao carregar estatísticas');
        } finally {
            setIsLoadingStats(false);
        }
    };

    const fetchCompanies = async () => {
        setIsLoadingCompanies(true);
        try {
            const data = await adminAPI.getCompanies();
            setCompanies(data);
        } catch (error) {
            console.error('Fetch companies error:', error);
            toast.error('Erro ao carregar empresas');
        } finally {
            setIsLoadingCompanies(false);
        }
    };

    const handleToggleCompanyStatus = async (companyId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        try {
            await adminAPI.toggleCompanyStatus(companyId, newStatus);
            toast.success(`Empresa ${newStatus === 'active' ? 'activada' : 'desactivada'} com sucesso!`);
            fetchCompanies();
            fetchAdminStats();
        } catch (error) {
            toast.error('Erro ao alterar status da empresa');
        }
    };

    useEffect(() => {
        if (activeTab === 'superadmin' && user?.role === 'super_admin') {
            fetchAdminStats();
            fetchCompanies();
        }
    }, [activeTab, user?.role]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t('settings.title')}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    {t('settings.systemSettings')}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-dark-700 pb-4 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap
              ${activeTab === tab.id
                                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700'
                            }
            `}
                    >
                        <tab.icon className="w-5 h-5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Profile Settings */}
            {activeTab === 'profile' && (
                <div className="space-y-6">
                    {/* User Info Card */}
                    <Card padding="lg" className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 border border-primary-200 dark:border-primary-800">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                                <span className="text-white font-bold text-2xl">
                                    {user?.name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'U'}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {user?.name || 'Utilizador'}
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">{user?.email}</p>
                                {user?.role && (
                                    <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary-200 dark:bg-primary-800 text-primary-700 dark:text-primary-300">
                                        {roleLabels[user.role]}
                                    </span>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* Update Profile Form */}
                    <Card padding="lg">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                            Actualizar Perfil
                        </h3>
                        <form onSubmit={handleSubmitProfile(onSubmitProfile as never)} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Nome Completo *"
                                    placeholder="Seu nome completo"
                                    {...registerProfile('name')}
                                    error={profileErrors.name?.message}
                                />
                                <Input
                                    label="Email *"
                                    type="email"
                                    placeholder="seu@email.com"
                                    {...registerProfile('email')}
                                    error={profileErrors.email?.message}
                                />
                            </div>
                            <Input
                                label="Telefone"
                                type="tel"
                                placeholder="+258 84 000 0000"
                                {...registerProfile('phone')}
                            />
                            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                                <Button type="submit" disabled={!isProfileDirty}>
                                    Salvar Alterações
                                </Button>
                            </div>
                        </form>
                    </Card>

                    {/* Change Password Form */}
                    <Card padding="lg">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <HiOutlineLockClosed className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Alterar Senha
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Mantenha sua conta segura com uma senha forte
                                </p>
                            </div>
                        </div>
                        <form onSubmit={handleSubmitPassword(onSubmitPassword as never)} className="space-y-4">
                            <Input
                                label="Senha Actual *"
                                type="password"
                                placeholder="••••••••"
                                {...registerPassword('currentPassword')}
                                error={passwordErrors.currentPassword?.message}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Nova Senha *"
                                    type="password"
                                    placeholder="••••••••"
                                    {...registerPassword('newPassword')}
                                    error={passwordErrors.newPassword?.message}
                                    helperText="Mínimo 6 caracteres"
                                />
                                <Input
                                    label="Confirmar Nova Senha *"
                                    type="password"
                                    placeholder="••••••••"
                                    {...registerPassword('confirmPassword')}
                                    error={passwordErrors.confirmPassword?.message}
                                />
                            </div>
                            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                                <Button type="submit">
                                    Alterar Senha
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Company Settings */}
            {activeTab === 'company' && (
                <Card padding="lg">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                        Dados da Empresa
                    </h2>
                    <form onSubmit={handleSubmitCompany(onSubmitCompany as never)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Razão Social *"
                                {...registerCompany('companyName')}
                                error={companyErrors.companyName?.message}
                            />
                            <Input
                                label="Nome Comercial"
                                {...registerCompany('tradeName')}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label="NUIT *"
                                {...registerCompany('taxId')}
                                error={companyErrors.taxId?.message}
                                placeholder="Ex: 400123456"
                            />
                            <Input
                                label="Telefone *"
                                {...registerCompany('phone')}
                                error={companyErrors.phone?.message}
                            />
                            <Input
                                label="Email *"
                                type="email"
                                {...registerCompany('email')}
                                error={companyErrors.email?.message}
                            />
                        </div>

                        <Input
                            label="Endereço *"
                            {...registerCompany('address')}
                            error={companyErrors.address?.message}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label="Cidade *"
                                {...registerCompany('city')}
                                error={companyErrors.city?.message}
                            />
                            <Select
                                label="Estado *"
                                options={stateOptions}
                                {...registerCompany('state')}
                                error={companyErrors.state?.message}
                            />
                            <Input
                                label="Código Postal"
                                {...registerCompany('zipCode')}
                                error={companyErrors.zipCode?.message}
                            />
                        </div>

                        <div className="border-t border-gray-200 dark:border-dark-700 pt-6">
                            <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
                                Configurações de Impressão
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Select
                                    label="Tipo de Impressora"
                                    options={[
                                        { value: 'thermal', label: 'Térmica (80mm/58mm)' },
                                        { value: 'a4', label: 'A4 Convencional' },
                                    ]}
                                    {...registerCompany('printerType')}
                                />
                                <Select
                                    label="Largura do Papel (Térmica)"
                                    options={[
                                        { value: '80mm', label: '80mm' },
                                        { value: '58mm', label: '58mm' },
                                    ]}
                                    {...registerCompany('thermalPaperWidth')}
                                    disabled={watchCompany('printerType') !== 'thermal'}
                                />
                                <div className="flex items-center gap-3 pt-7">
                                    <input
                                        type="checkbox"
                                        id="autoPrintReceipt"
                                        className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        {...registerCompany('autoPrintReceipt')}
                                    />
                                    <label htmlFor="autoPrintReceipt" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Imprimir recibo automaticamente
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 dark:border-dark-700 pt-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-md font-semibold text-gray-900 dark:text-white">
                                    Dados Bancários (Para Documentos)
                                </h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => appendBank({ bankName: '', accountNumber: '', nib: '', holderName: '' })}
                                >
                                    + Adicionar Banco
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {bankFields.map((field, index) => (
                                    <div key={field.id} className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg relative border border-gray-200 dark:border-dark-700">
                                        <button
                                            type="button"
                                            onClick={() => removeBank(index)}
                                            className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                                        >
                                            <HiOutlineTrash className="w-5 h-5" />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <Input
                                                label="Banco *"
                                                placeholder="Ex: BIM, Standard Bank"
                                                {...registerCompany(`bankAccounts.${index}.bankName` as never)}
                                            />
                                            <Input
                                                label="Nº da Conta *"
                                                placeholder="Ex: 123456789"
                                                {...registerCompany(`bankAccounts.${index}.accountNumber` as never)}
                                            />
                                            <Input
                                                label="NIB / IBAN"
                                                placeholder="Para transferências"
                                                {...registerCompany(`bankAccounts.${index}.nib` as never)}
                                            />
                                            <Input
                                                label="Titular"
                                                placeholder="Nome do titular"
                                                {...registerCompany(`bankAccounts.${index}.holderName` as never)}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {bankFields.length === 0 && (
                                    <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-dark-700 rounded-lg">
                                        <p className="text-sm text-gray-500">Nenhum banco configurado. Adicione um para exibir nas faturas A4.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                            <Button type="submit" disabled={!isCompanyDirty}>
                                Salvar Alterações
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* System Settings */}
            {activeTab === 'system' && (
                <div className="space-y-6">
                    {/* Theme */}
                    <Card padding="lg">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                            Aparência
                        </h2>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">Tema</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Escolha entre tema claro ou escuro
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={toggleTheme}
                                    className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                    ${theme === 'light'
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400'
                                        }
                  `}
                                >
                                    <HiOutlineSun className="w-5 h-5" />
                                    Claro
                                </button>
                                <button
                                    onClick={toggleTheme}
                                    className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                    ${theme === 'dark'
                                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                            : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400'
                                        }
                  `}
                                >
                                    <HiOutlineMoon className="w-5 h-5" />
                                    Escuro
                                </button>
                            </div>
                        </div>
                    </Card>

                    {/* Active Module Display */}
                    <Card padding="lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Módulo Activo
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Módulo de negócio configurado para esta empresa
                                </p>
                            </div>
                            {user?.activeModules && user.activeModules.length > 0 && (
                                <div className="px-4 py-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                                    <p className="text-sm font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider">
                                        {getModuleName(user.activeModules[0])}
                                    </p>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Business Type */}
                    <Card padding="lg">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Tipo de Negócio
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Selecione o tipo de negócio para personalizar o sistema
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 relative">
                            {businessTypeOptions.map((option) => {
                                const isCompanyInvalid = !companySettings.companyName || companySettings.companyName === 'Minha Empresa Lda' || !companySettings.taxId;
                                const isSelected = businessType === option.value;

                                return (
                                    <button
                                        key={option.value}
                                        onClick={async () => {
                                            if (isSelected) return; // Se já estiver ativo, não faz nada e não dá aviso

                                            // Verificar se o módulo correspondente está disponível
                                            const requiredModule = BUSINESS_TYPE_TO_MODULE[option.value];
                                            const hasRequiredModule = user?.activeModules?.includes(requiredModule);

                                            if (!hasRequiredModule) {
                                                setAttemptedModule(option.label);
                                                setModuleValidationOpen(true);
                                                return;
                                            }

                                            if (isCompanyInvalid) {
                                                setIsSetupModalOpen(true);
                                                return;
                                            }
                                            setBusinessType(option.value as BusinessType);
                                            await updateCompanySettings({ ...companySettings, businessType: option.value as BusinessType });
                                            toast.success(`Tipo de negócio alterado para ${option.label}`);
                                        }}
                                        className={`
                                            p-4 rounded-xl border-2 text-left transition-all group
                                            ${isSelected
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-lg'
                                                : 'border-gray-200 dark:border-dark-600 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-dark-700'
                                            }
                                            ${isCompanyInvalid && !isSelected ? 'opacity-60 saturate-50' : ''}
                                        `}
                                    >
                                        <div className="flex flex-col h-full">
                                            <span className="text-2xl mb-2 block group-hover:scale-110 transition-transform">{option.icon}</span>
                                            <p className={`
                                                font-semibold text-sm
                                                ${businessType === option.value
                                                    ? 'text-primary-600 dark:text-primary-400'
                                                    : 'text-gray-800 dark:text-gray-200'
                                                }
                                            `}>
                                                {option.label}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                                {option.description}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            )}

            {/* Alert Settings */}
            {activeTab === 'alerts' && (
                <Card padding="lg">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                        Configurações de Alertas
                    </h2>
                    <form onSubmit={handleSubmitAlerts(onSubmitAlerts as never)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label="Limite Estoque Baixo"
                                type="number"
                                {...registerAlerts('lowStockThreshold')}
                                helperText="Quantidade mínima antes do alerta"
                            />
                            <Input
                                label="Aviso de Validade (dias)"
                                type="number"
                                {...registerAlerts('expiryWarningDays')}
                                helperText="Dias antes do vencimento"
                            />
                            <Input
                                label="Vencimento Pagamento (dias)"
                                type="number"
                                {...registerAlerts('paymentDueDays')}
                                helperText="Dias antes do vencimento"
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        Alertas por Email
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Receber alertas críticos por email
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAlertValue('enableEmailAlerts', !enableEmailAlerts)}
                                    className={`
                    relative w-14 h-7 rounded-full transition-colors
                    ${enableEmailAlerts ? 'bg-primary-600' : 'bg-gray-300 dark:bg-dark-600'}
                  `}
                                >
                                    <span className={`
                    absolute top-1 w-5 h-5 bg-white rounded-full transition-transform
                    ${enableEmailAlerts ? 'left-8' : 'left-1'}
                  `} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        Notificações Push
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Receber notificações no navegador
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAlertValue('enablePushNotifications', !enablePushNotifications)}
                                    className={`
                    relative w-14 h-7 rounded-full transition-colors
                    ${enablePushNotifications ? 'bg-primary-600' : 'bg-gray-300 dark:bg-dark-600'}
                  `}
                                >
                                    <span className={`
                    absolute top-1 w-5 h-5 bg-white rounded-full transition-transform
                    ${enablePushNotifications ? 'left-8' : 'left-1'}
                  `} />
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                            <Button type="submit" disabled={!isAlertsDirty}>
                                Salvar Configurações
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* Backup Settings */}
            {activeTab === 'backup' && (
                <div className="space-y-6">
                    <Card padding="lg">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                            Backup e Restauração
                        </h2>

                        <div className="space-y-6">
                            {/* Export Section */}
                            <div className="p-6 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-xl border border-primary-200 dark:border-primary-800">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center">
                                        <HiOutlineCloudDownload className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">
                                            Exportar Backup Completo
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Faça o download de um backup com todos os dados do sistema:
                                        </p>
                                        <ul className="text-sm text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                                            <li>✓ Configurações da empresa</li>
                                            <li>✓ Produtos e categorias</li>
                                            <li>✓ Funcionários e presença</li>
                                            <li>✓ Vendas e transações</li>
                                            <li>✓ Alertas e configurações</li>
                                            <li>✓ Utilizadores registados</li>
                                        </ul>
                                        <Button onClick={handleExportData} className="mt-4">
                                            <HiOutlineCloudDownload className="w-4 h-4 mr-2" />
                                            Exportar Backup
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Import Section */}
                            <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
                                        <HiOutlineShieldCheck className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">
                                            Restaurar Dados
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            Restaure as configurações e dados a partir de um arquivo de backup.
                                        </p>
                                        <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                                ⚠️ Atenção: Este processo irá substituir todos os dados actuais!
                                            </p>
                                        </div>
                                        <label className="mt-4 inline-block">
                                            <input
                                                type="file"
                                                accept=".json"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onload = (event) => {
                                                            try {
                                                                const data = JSON.parse(event.target?.result as string);

                                                                // Validate backup structure
                                                                if (!data.version || !data.company) {
                                                                    toast.error('Arquivo de backup inválido!');
                                                                    return;
                                                                }

                                                                // Store data for confirmation
                                                                setBackupDataToRestore(data);
                                                                setRestoreConfirmOpen(true);
                                                            } catch (error) {
                                                                console.error('Backup parse error:', error);
                                                                toast.error('Erro ao ler arquivo de backup.');
                                                            }
                                                        };
                                                        reader.readAsText(file);
                                                    }
                                                }}
                                            />
                                            <Button variant="secondary">
                                                <HiOutlineCloudDownload className="w-4 h-4 mr-2" />
                                                Selecionar Arquivo de Backup
                                            </Button>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Backup Info */}
                        <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                                Informações do Backup
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400">Formato:</p>
                                    <p className="font-medium text-gray-900 dark:text-white">JSON</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400">Armazenamento:</p>
                                    <p className="font-medium text-gray-900 dark:text-white">Local (Browser)</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400">Tipo de negócio:</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{businessTypeOptions.find(b => b.value === businessType)?.label}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400">Empresa:</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{companySettings?.companyName ?? 'Empresa'}</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Tips Card */}
                    <Card padding="md" className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                            💡 Dicas de Backup
                        </h3>
                        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                            <li>• Faça backups regulares (recomendado: diariamente)</li>
                            <li>• Guarde os ficheiros de backup em local seguro</li>
                            <li>• Antes de restaurar, faça um backup do estado actual</li>
                            <li>• Verifique a data do backup antes de restaurar</li>
                        </ul>
                    </Card>
                </div>
            )}

            {/* Restore Confirmation Modal */}
            <ConfirmationModal
                isOpen={restoreConfirmOpen}
                onClose={() => setRestoreConfirmOpen(false)}
                onConfirm={() => {
                    if (backupDataToRestore) {
                        // Restore company settings
                        if (backupDataToRestore.company) {
                            updateCompanySettings(backupDataToRestore.company);
                        }
                        // Restore alert config
                        if (backupDataToRestore.alertConfig) {
                            updateAlertConfig(backupDataToRestore.alertConfig);
                        }
                        // Restore business type
                        if (backupDataToRestore.businessType) {
                            setBusinessType(backupDataToRestore.businessType);
                        }

                        toast.success('Backup restaurado com sucesso!');
                        setRestoreConfirmOpen(false);
                        setBackupDataToRestore(null);
                    }
                }}
                title="Confirmar Restauração"
                message="Tem certeza que deseja restaurar este backup? Todos os dados actuais serão substituídos."
                confirmText="Restaurar"
                variant="danger"
            />
            {/* Company Setup Required Modal */}
            <ConfirmationModal
                isOpen={isSetupModalOpen}
                onClose={() => setIsSetupModalOpen(false)}
                onConfirm={() => {
                    setIsSetupModalOpen(false);
                    setActiveTab('company');
                }}
                title="Configuração da Empresa Necessária"
                message="Para selecionar um módulo de negócio, primeiro deve registar as informações básicas da sua empresa (Nome e NUIT) na aba 'Empresa'."
                confirmText="Registar Empresa"
                cancelText="Cancelar"
            />

            {/* Super Admin Panel */}
            {activeTab === 'superadmin' && user?.role === 'super_admin' && (
                <div className="space-y-6">
                    {/* Global Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {isLoadingStats ? (
                            <div className="col-span-4 flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            </div>
                        ) : adminStats && (
                            <>
                                <Card padding="lg" className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Empresas</p>
                                            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                                                {adminStats.companies.total}
                                            </p>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                                {adminStats.companies.active} activas
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                                            <HiOutlineOfficeBuilding className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </Card>

                                <Card padding="lg" className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-green-600 dark:text-green-400">Utilizadores</p>
                                            <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-1">
                                                {adminStats.users.total}
                                            </p>
                                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                {adminStats.users.active} activos
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                                            <HiOutlineUsers className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </Card>

                                <Card padding="lg" className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Vendas Totais</p>
                                            <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                                                {adminStats.sales.total}
                                            </p>
                                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                                {new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(adminStats.sales.revenue)}
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
                                            <HiOutlineCheckCircle className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </Card>

                                <Card padding="lg" className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Actividade (7d)</p>
                                            <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                                                {adminStats.recentActivity.sales}
                                            </p>
                                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                                {adminStats.recentActivity.newUsers} novos utilizadores
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
                                            <HiOutlineCog className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </Card>
                            </>
                        )}
                    </div>

                    {/* Module Usage */}
                    {adminStats?.modules && adminStats.modules.length > 0 && (
                        <Card padding="lg">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Uso de Módulos
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {adminStats.modules.map((mod: any) => (
                                    <div key={mod.moduleCode} className="p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{mod.moduleName}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {mod.companiesUsing} {mod.companiesUsing === 1 ? 'empresa' : 'empresas'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Companies Management */}
                    <Card padding="lg">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Gestão de Empresas
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Gerencie todas as empresas registadas no sistema
                                </p>
                            </div>
                        </div>

                        {isLoadingCompanies ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            </div>
                        ) : companies.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 dark:bg-dark-700 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600">
                                <HiOutlineOfficeBuilding className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-500 dark:text-gray-400">Nenhuma empresa encontrada.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto -mx-6">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-dark-700 text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="px-6 py-3">Empresa</th>
                                            <th className="px-6 py-3">NUIT</th>
                                            <th className="px-6 py-3">Módulos</th>
                                            <th className="px-6 py-3">Utilizadores</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3">Criada em</th>
                                            <th className="px-6 py-3 text-right">Acções</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                                        {companies.map((company) => (
                                            <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-white">{company.name}</p>
                                                        {company.email && (
                                                            <p className="text-sm text-gray-500 dark:text-gray-400">{company.email}</p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                    {company.nuit}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {company.activeModules?.map((mod: any) => (
                                                            <span key={mod.code} className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                                                                {mod.code}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                    {company.userCount}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => handleToggleCompanyStatus(company.id, company.status)}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${company.status === 'active'
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200'
                                                            }`}
                                                    >
                                                        {company.status === 'active' ? (
                                                            <><HiOutlineCheckCircle className="w-3.5 h-3.5" /> Activa</>
                                                        ) : (
                                                            <><HiOutlineXCircle className="w-3.5 h-3.5" /> Inactiva</>
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(company.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                                                        title="Ver detalhes"
                                                    >
                                                        <HiOutlineCog className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* User Management */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    <Card padding="lg">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    Gestão de Utilizadores
                                </h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Gerencie o acesso dos membros da sua equipa
                                </p>
                            </div>
                        </div>

                        {isLoadingUsers ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 dark:bg-dark-700 rounded-xl border-2 border-dashed border-gray-200 dark:border-dark-600">
                                <HiOutlineUsers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-500 dark:text-gray-400">Nenhum utilizador encontrado.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto -mx-6">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-dark-700 text-gray-500 dark:text-gray-400 text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="px-6 py-3">Nome / Email</th>
                                            <th className="px-6 py-3">Papel</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3">Último Acesso</th>
                                            <th className="px-6 py-3 text-right">Acções</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                                        {users.map((userData) => (
                                            <tr key={userData.id} className="hover:bg-gray-50 dark:hover:bg-dark-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold shrink-0">
                                                            {userData.name[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-white leading-none mb-1">{userData.name}</p>
                                                            <p className="text-sm text-gray-500 dark:text-gray-400">{userData.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300">
                                                        {roleLabels[userData.role as keyof typeof roleLabels] || userData.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => handleToggleUserStatus(userData)}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${userData.isActive
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                                                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200'
                                                            }`}>
                                                        {userData.isActive ? (
                                                            <><HiOutlineCheckCircle className="w-3.5 h-3.5" /> Activo</>
                                                        ) : (
                                                            <><HiOutlineXCircle className="w-3.5 h-3.5" /> Inactivo</>
                                                        )}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                    {userData.lastLogin
                                                        ? new Date(userData.lastLogin).toLocaleDateString()
                                                        : 'Nunca'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEditUser(userData)}
                                                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                                                            title="Editar"
                                                        >
                                                            <HiOutlinePencilAlt className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedUser(userData);
                                                                setIsDeleteModalOpen(true);
                                                            }}
                                                            disabled={userData.id === user?.id}
                                                            className={`p-2 rounded-lg transition-colors ${userData.id === user?.id
                                                                ? 'text-gray-200 dark:text-dark-600 cursor-not-allowed'
                                                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                                }`}
                                                            title={userData.id === user?.id ? 'Não pode apagar a sua conta' : 'Apagar'}
                                                        >
                                                            <HiOutlineTrash className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* Edit User Modal Content */}
            {isUserModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl border border-gray-200 dark:border-dark-700 w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-dark-700">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Editar Utilizador</h3>
                        </div>
                        <form onSubmit={handleSubmitUser(onSubmitUser)}>
                            <div className="p-6 space-y-4">
                                <Input
                                    label="Nome Completo *"
                                    {...registerUser('name')}
                                    error={userErrors.name?.message}
                                />
                                <Input
                                    label="Email *"
                                    type="email"
                                    {...registerUser('email')}
                                    error={userErrors.email?.message}
                                />
                                <Select
                                    label="Papel / Cargo *"
                                    options={[
                                        { value: 'admin', label: 'Administrador' },
                                        { value: 'manager', label: 'Gerente' },
                                        { value: 'operator', label: 'Operador' },
                                        { value: 'cashier', label: 'Caixa' },
                                        { value: 'stock_keeper', label: 'Gestor de Stock' },
                                    ]}
                                    {...registerUser('role')}
                                    error={userErrors.role?.message}
                                />
                                <Input
                                    label="Telefone"
                                    {...registerUser('phone')}
                                    error={userErrors.phone?.message}
                                />
                            </div>
                            <div className="p-6 bg-gray-50 dark:bg-dark-700/50 flex justify-end gap-3">
                                <Button type="button" variant="secondary" onClick={() => setIsUserModalOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isUserSubmitting}>
                                    Salvar Alterações
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete User Confirmation Modal */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteUser}
                title="Remover Utilizador"
                message={`Tem certeza que deseja remover o utilizador ${selectedUser?.name}? Esta ação não pode ser desfeita.`}
                confirmText="Remover"
                variant="danger"
            />

            {/* Module Validation Modal */}
            <ConfirmationModal
                isOpen={moduleValidationOpen}
                onClose={() => setModuleValidationOpen(false)}
                onConfirm={() => setModuleValidationOpen(false)}
                title="Módulo Não Disponível"
                message={`O módulo "${attemptedModule}" não foi criado para esta empresa. Contacte o administrador do sistema para adicionar este módulo.`}
                confirmText="Entendi"
                variant="warning"
            />
        </div>
    );
}
