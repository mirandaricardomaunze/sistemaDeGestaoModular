import { logger } from '../../utils/logger';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineOfficeBuilding,
    HiOutlineUsers,
    HiOutlineDatabase,
    HiOutlineShieldCheck,
    HiOutlineRefresh
} from 'react-icons/hi';
import { adminAPI } from '../../services/api';
import { Card } from '../../components/ui';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Stats {
    companies: { total: number; active: number; inactive: number };
    users: { total: number; active: number; inactive: number };
    sales: { total: number; revenue: number };
    modules: Array<{ moduleCode: string; moduleName: string; companiesUsing: number }>;
    recentActivity: { sales: number; newUsers: number };
    system: { dbSize: string };
}

interface Company {
    id: string;
    name: string;
    tradeName: string | null;
    status: string;
    createdAt: string;
    userCount: number;
    moduleCount: number;
    activeModules: Array<{ code: string; name: string }>;
}

interface Activity {
    id: string;
    action: string;
    entity: string;
    timestamp: string;
    user: {
        name: string;
        email: string;
        company: { name: string } | null;
    } | null;
}

const SuperAdminDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<Stats | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const loadData = async () => {
        setIsLoading(true);
        setHasError(false);
        try {
            const [statsData, companiesData, activitiesData] = await Promise.all([
                adminAPI.getStats(),
                adminAPI.getCompanies(),
                adminAPI.getActivity(10)
            ]);

            setStats(statsData);
            setCompanies(companiesData.slice(0, 5)); // Top 5 most recent
            setActivities(activitiesData.slice(0, 10)); // Last 10 activities
        } catch (error: any) {
            logger.error('Error loading admin data:', error);

            // Check if it's a permission error (403)
            if (error.response?.status === 403) {
                setHasError(true);
                setErrorMessage('Acesso negado. Apenas super administradores podem aceder a este painel.');
            } else {
                setHasError(true);
                setErrorMessage('Erro ao carregar dados do painel. Tente novamente mais tarde.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const statCards = stats ? [
        { label: 'Total de Empresas', value: stats.companies.total.toString(), subtitle: `${stats.companies.active} ativas`, icon: HiOutlineOfficeBuilding,
          cardBg: 'bg-blue-50/60 dark:bg-blue-950/30', cardBorder: 'border border-blue-200/70 dark:border-blue-800/40',
          iconBg: 'bg-blue-100 dark:bg-blue-900/40', iconColor: 'text-blue-600 dark:text-blue-400', accent: 'bg-blue-500' },
        { label: 'Usuários Ativos', value: stats.users.active.toString(), subtitle: `${stats.users.total} total`, icon: HiOutlineUsers,
          cardBg: 'bg-emerald-50/60 dark:bg-emerald-950/30', cardBorder: 'border border-emerald-200/70 dark:border-emerald-800/40',
          iconBg: 'bg-emerald-100 dark:bg-emerald-900/40', iconColor: 'text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500' },
        { label: 'Vendas Totais', value: stats.sales.total.toString(), subtitle: `${stats.recentActivity.sales} últimos 7 dias`, icon: HiOutlineDatabase,
          cardBg: 'bg-purple-50/60 dark:bg-purple-950/30', cardBorder: 'border border-purple-200/70 dark:border-purple-800/40',
          iconBg: 'bg-purple-100 dark:bg-purple-900/40', iconColor: 'text-purple-600 dark:text-purple-400', accent: 'bg-purple-500' },
        { label: 'Novos Usuários', value: stats.recentActivity.newUsers.toString(), subtitle: 'Últimos 7 dias', icon: HiOutlineShieldCheck,
          cardBg: 'bg-amber-50/60 dark:bg-amber-950/30', cardBorder: 'border border-amber-200/70 dark:border-amber-800/40',
          iconBg: 'bg-amber-100 dark:bg-amber-900/40', iconColor: 'text-amber-600 dark:text-amber-400', accent: 'bg-amber-500' },
        { label: 'Tamanho do Banco', value: stats.system.dbSize, subtitle: 'Ocupação em disco', icon: HiOutlineDatabase,
          cardBg: 'bg-indigo-50/60 dark:bg-indigo-950/30', cardBorder: 'border border-indigo-200/70 dark:border-indigo-800/40',
          iconBg: 'bg-indigo-100 dark:bg-indigo-900/40', iconColor: 'text-indigo-600 dark:text-indigo-400', accent: 'bg-indigo-500' },
    ] : [];

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { bg: string; text: string; label: string }> = {
            active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativa' },
            inactive: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Inativa' },
            suspended: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspensa' }
        };
        const badge = badges[status] || badges.active;
        return (
            <span className={`px-3 py-1 ${badge.bg} ${badge.text} text-xs font-medium rounded-full`}>
                {badge.label}
            </span>
        );
    };

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            'LOGIN': 'login',
            'LOGOUT': 'Logout',
            'REGISTER_WITH_COMPANY': 'Registro de Empresa',
            'COMPANY_STATUS_CHANGE': 'Alteração de Status',
            'PASSWORD_CHANGE': 'Alteração de Senha',
            'CREATE': 'Criação',
            'UPDATE': 'Atualização',
            'DELETE': 'Exclusão'
        };
        return labels[action] || action;
    };

    if (isLoading) {
        return (
            <div className="p-6 flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-gray-400">Carregando dados...</p>
                </div>
            </div>
        );
    }

    if (hasError) {
        return (
            <div className="p-6 flex items-center justify-center h-96">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                        <HiOutlineShieldCheck className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {errorMessage}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                        Se acredita que isto é um erro, contacte o administrador do sistema.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Painel do Super Administrador</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Acesso Global ao Sistema</p>
                </div>
                <button
                    onClick={loadData}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <HiOutlineRefresh className="w-5 h-5" />
                    Atualizar
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {statCards.map((stat, index) => (
                    <div key={index} className={`relative group overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300 ${stat.cardBg} ${stat.cardBorder}`}>
                        <div className="p-5 flex items-center gap-4">
                            <div className={`p-3 rounded-xl flex-shrink-0 shadow-sm transition-transform group-hover:scale-110 duration-300 ${stat.iconBg} ${stat.iconColor}`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest">{stat.label}</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{stat.value}</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium italic">{stat.subtitle}</p>
                            </div>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-0.5 transition-all duration-500 group-hover:w-full w-8 ${stat.accent}`} />
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Companies */}
                <Card padding="md" color="slate">
                    <h2 className="text-lg font-semibold mb-4 dark:text-white">Empresas Recentes</h2>
                    <div className="space-y-4">
                        {companies.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                Nenhuma empresa registrada
                            </p>
                        ) : (
                            companies.map((company) => (
                                <div key={company.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                                            {company.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium dark:text-white">{company.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {company.userCount} usuários • {company.moduleCount} módulos
                                            </p>
                                        </div>
                                    </div>
                                    {getStatusBadge(company.status)}
                                </div>
                            ))
                        )}
                    </div>
                </Card>

                {/* Activity Logs */}
                <Card padding="md" color="slate">
                    <h2 className="text-lg font-semibold mb-4 dark:text-white">Logs de Auditoria Global</h2>
                    <div className="space-y-4">
                        {activities.length === 0 ? (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                Nenhuma atividade recente
                            </p>
                        ) : (
                            activities.map((activity) => (
                                <div key={activity.id} className="text-sm border-l-4 border-primary-500 pl-4 py-2">
                                    <p className="font-medium dark:text-white">
                                        {getActionLabel(activity.action)} - {activity.entity}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {activity.user?.name || 'Sistema'} • {activity.user?.company?.name || 'N/A'}
                                        <br />
                                        {formatDistanceToNow(new Date(activity.timestamp), {
                                            addSuffix: true,
                                            locale: ptBR
                                        })}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* Module Usage Stats */}
            {stats && stats.modules.length > 0 && (
                <Card padding="md" color="slate">
                    <h2 className="text-lg font-semibold mb-4 dark:text-white">Uso de Módulos</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {stats.modules.map((module, index) => (
                            <div key={index} className="p-4 bg-gray-50 dark:bg-dark-700 rounded-lg text-center">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{module.moduleName}</p>
                                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-2">
                                    {module.companiesUsing}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">empresas</p>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default SuperAdminDashboard;

