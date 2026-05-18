import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    HiOutlineBuildingOffice,
    HiOutlineUsers,
    HiOutlineCircleStack,
    HiOutlineShieldCheck,
    HiOutlineArrowPath,
    HiOutlineChartBar,
    HiOutlineCog6Tooth,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlinePause,
    HiOutlineMagnifyingGlass,
    HiOutlineServerStack,
    HiOutlineCpuChip,
} from 'react-icons/hi2';
import { adminAPI } from '../../services/api';
import type { AdminCompanyStatus } from '../../services/api/admin.api';

type ApiError = Error & { response?: { status?: number; data?: { message?: string; error?: string } } };
import { Card, Pagination, Button, Input, Select } from '../../components/ui';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useUser } from '../../stores/useAuthStore';

type Tab = 'overview' | 'companies' | 'users' | 'activity' | 'system';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
    companies: {
        total: number;
        active: number;
        inactive: number;
        suspended: number;
        trial?: number;
        blocked?: number;
    };
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

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    lastLoginAt: string | null;
    company: { id: string; name: string; status: string } | null;
}

interface Activity {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    timestamp: string;
    ipAddress: string | null;
    user: { name: string; email: string; company: { name: string } | null } | null;
}

interface SystemHealth {
    status: string;
    timestamp: string;
    database: { size: string; version: string; topTables: Array<{ table: string; rows: number }> };
    process: { uptime: number; memoryMb: number; nodeVersion: string };
}

interface Paginated<T> {
    data: T[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
    active:    { bg: 'bg-green-100 dark:bg-green-900/20',  text: 'text-green-700 dark:text-green-400',  icon: HiOutlineCheckCircle, label: 'Ativa' },
    trial:     { bg: 'bg-blue-100 dark:bg-blue-900/20',    text: 'text-blue-600 dark:text-blue-400',    icon: HiOutlinePause,       label: 'Trial' },
    blocked:   { bg: 'bg-red-100 dark:bg-red-900/20',      text: 'text-red-700 dark:text-red-400',      icon: HiOutlineXCircle,     label: 'Bloqueada' },
    cancelled: { bg: 'bg-gray-100 dark:bg-gray-800',       text: 'text-gray-600 dark:text-gray-400',    icon: HiOutlineXCircle,     label: 'Cancelada' },
};

const StatusBadge = ({ status }: { status: string }) => {
    const b = STATUS_BADGE[status] || STATUS_BADGE.inactive;
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${b.bg} ${b.text}`}>
            <b.icon className="w-3.5 h-3.5" />
            {b.label}
        </span>
    );
};

const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
};

const ACTION_LABELS: Record<string, string> = {
    LOGIN: 'Login', LOGOUT: 'Logout', CREATE: 'Criação',
    UPDATE: 'Atualização', DELETE: 'Exclusão',
    REGISTER_WITH_COMPANY: 'Registro de Empresa',
    COMPANY_STATUS_CHANGE: 'Alteração de Status',
    PASSWORD_CHANGE: 'Alteração de Senha',
};

// ── Main Component ────────────────────────────────────────────────────────────

const SuperAdminDashboard: React.FC = () => {
    const navigate = useNavigate();
    const currentUser = useUser();
    const [tab, setTab] = useState<Tab>('overview');

    // data states
    const [stats, setStats] = useState<Stats | null>(null);
    const [companies, setCompanies] = useState<Paginated<Company> | null>(null);
    const [users, setUsers] = useState<Paginated<User> | null>(null);
    const [activity, setActivity] = useState<Paginated<Activity> | null>(null);
    const [health, setHealth] = useState<SystemHealth | null>(null);

    // loading / error per-tab
    const [loading, setLoading] = useState<Record<Tab, boolean>>({ overview: true, companies: false, users: false, activity: false, system: false });
    const [error, setError] = useState<string | null>(null);

    // filters
    const [companySearch, setCompanySearch] = useState('');
    const [companyStatus, setCompanyStatus] = useState('');
    const [companyPage, setCompanyPage] = useState(1);
    const [userSearch, setUserSearch] = useState('');
    const [userPage, setUserPage] = useState(1);
    const [activityPage, setActivityPage] = useState(1);

    // toggling state
    const [togglingId, setTogglingId] = useState<string | null>(null);

    // ── Loaders ───────────────────────────────────────────────────────────────

    const loadOverview = useCallback(async () => {
        setLoading(l => ({ ...l, overview: true }));
        try {
            const data = await adminAPI.getStats();
            setStats(data);
            setError(null);
        } catch (e) {
            const err = e as ApiError;
            setError(err.response?.status === 403
                ? 'Acesso negado. Apenas super administradores.'
                : 'Erro ao carregar dados. Tente novamente.');
        } finally {
            setLoading(l => ({ ...l, overview: false }));
        }
    }, []);

    const loadCompanies = useCallback(async () => {
        setLoading(l => ({ ...l, companies: true }));
        try {
            const data = await adminAPI.getCompanies({ page: companyPage, limit: 15, search: companySearch || undefined, status: companyStatus || undefined });
            setCompanies(data);
        } finally {
            setLoading(l => ({ ...l, companies: false }));
        }
    }, [companyPage, companySearch, companyStatus]);

    const loadUsers = useCallback(async () => {
        setLoading(l => ({ ...l, users: true }));
        try {
            const data = await adminAPI.getAllUsers({ page: userPage, limit: 20, search: userSearch || undefined });
            setUsers(data);
        } finally {
            setLoading(l => ({ ...l, users: false }));
        }
    }, [userPage, userSearch]);

    const loadActivity = useCallback(async () => {
        setLoading(l => ({ ...l, activity: true }));
        try {
            const data = await adminAPI.getActivity({ page: activityPage, limit: 30 });
            setActivity(data);
        } finally {
            setLoading(l => ({ ...l, activity: false }));
        }
    }, [activityPage]);

    const loadSystem = useCallback(async () => {
        setLoading(l => ({ ...l, system: true }));
        try {
            const data = await adminAPI.getSystemHealth();
            setHealth(data);
        } finally {
            setLoading(l => ({ ...l, system: false }));
        }
    }, []);

    useEffect(() => { loadOverview(); }, [loadOverview]);
    useEffect(() => { if (tab === 'companies') loadCompanies(); }, [tab, loadCompanies]);
    useEffect(() => { if (tab === 'users') loadUsers(); }, [tab, loadUsers]);
    useEffect(() => { if (tab === 'activity') loadActivity(); }, [tab, loadActivity]);
    useEffect(() => { if (tab === 'system') loadSystem(); }, [tab, loadSystem]);

    // ── Actions ───────────────────────────────────────────────────────────────

    const handleCompanyStatus = async (id: string, current: string) => {
        const next = current === 'active' ? 'blocked' : 'active';
        setTogglingId(id);
        try {
            await adminAPI.toggleCompanyStatus(id, next as AdminCompanyStatus);
            await loadCompanies();
        } finally {
            setTogglingId(null);
        }
    };

    const handleUserStatus = async (user: User) => {
        if (user.id === currentUser?.id) {
            toast.error('Não pode alterar o estado da sua própria conta');
            return;
        }
        if (user.role === 'super_admin' && user.isActive) {
            toast.error('Não é permitido desativar outro super administrador');
            return;
        }
        const action = user.isActive ? 'desativar' : 'ativar';
        if (!window.confirm(`Tem a certeza que pretende ${action} o utilizador "${user.name}"?`)) return;

        setTogglingId(user.id);
        try {
            await adminAPI.toggleUserStatus(user.id, !user.isActive);
            toast.success(`Utilizador ${user.isActive ? 'desativado' : 'ativado'} com sucesso`);
            await loadUsers();
        } catch (e) {
            const err = e as ApiError;
            toast.error(err.response?.data?.message || 'Erro ao alterar estado do utilizador');
        } finally {
            setTogglingId(null);
        }
    };

    // ── Early returns ─────────────────────────────────────────────────────────

    if (loading.overview && !stats) {
        return (
            <div className="p-6 flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
                    <p className="text-gray-500">Carregando painel...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 flex items-center justify-center h-96">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                        <HiOutlineShieldCheck className="w-8 h-8 text-red-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{error}</h2>
                    <Button onClick={() => navigate('/')} variant="premium" className="mt-4">
                        Voltar ao Início
                    </Button>
                </div>
            </div>
        );
    }

    // ── Tabs config ───────────────────────────────────────────────────────────

    const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
        { id: 'overview',   label: 'Visão Geral',  icon: HiOutlineChartBar },
        { id: 'companies',  label: 'Empresas',     icon: HiOutlineBuildingOffice },
        { id: 'users',      label: 'Utilizadores', icon: HiOutlineUsers },
        { id: 'activity',   label: 'Auditoria',    icon: HiOutlineCircleStack },
        { id: 'system',     label: 'Sistema',      icon: HiOutlineCog6Tooth },
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Painel Super Admin</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Acesso global ao sistema</p>
                </div>
                <Button
                    onClick={() => {
                        if (tab === 'overview') loadOverview();
                        else if (tab === 'companies') loadCompanies();
                        else if (tab === 'users') loadUsers();
                        else if (tab === 'activity') loadActivity();
                        else loadSystem();
                    }}
                    variant="premium"
                >
                    <HiOutlineArrowPath className="w-4 h-4" />
                    Atualizar
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200 dark:border-dark-600">
                {TABS.map(t => (
                    <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                            tab === t.id
                                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                    >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                    </div>
                ))}
            </div>

            {/* ── OVERVIEW ── */}
            {tab === 'overview' && stats && (
                <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                        {[
                            { label: 'Empresas', value: stats.companies.total, sub: `${stats.companies.active} ativas`, icon: HiOutlineBuildingOffice, color: 'blue' },
                            { label: 'Utilizadores', value: stats.users.total, sub: `${stats.users.active} ativos`, icon: HiOutlineUsers, color: 'emerald' },
                            { label: 'Vendas Totais', value: stats.sales.total, sub: `${stats.recentActivity.sales} esta semana`, icon: HiOutlineCircleStack, color: 'purple' },
                            { label: 'Receita Total', value: `${stats.sales.revenue.toLocaleString('pt-MZ')} MT`, sub: 'todas as empresas', icon: HiOutlineChartBar, color: 'amber' },
                            { label: 'BD em Disco', value: stats.system.dbSize, sub: 'tamanho atual', icon: HiOutlineServerStack, color: 'indigo' },
                        ].map((c, i) => (
                            <div key={i} className={`rounded-xl border p-4 bg-${c.color}-100/40 dark:bg-${c.color}-950/20 border-${c.color}-200/50 dark:border-${c.color}-800/30 transition-all hover:scale-[1.02] shadow-sm`}>
                                <div className={`inline-flex p-2 rounded-lg bg-${c.color}-200/60 dark:bg-${c.color}-900/30 text-${c.color}-700 dark:text-${c.color}-400 mb-3 shadow-inner`}>
                                    <c.icon className="w-5 h-5" />
                                </div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-black">{c.label}</p>
                                <p className={`text-2xl font-black text-${c.color}-900 dark:text-white mt-0.5`}>{c.value}</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-bold italic">{c.sub}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Companies status breakdown */}
                        <Card padding="md" color="slate">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Estado das Empresas</h3>
                            <div className="space-y-3">
                                {[
                                    { label: 'Ativas', value: stats.companies.active, total: stats.companies.total, color: 'bg-green-500' },
                                    { label: 'Trial', value: stats.companies.trial ?? 0, total: stats.companies.total, color: 'bg-blue-400' },
                                    { label: 'Bloqueadas', value: stats.companies.blocked ?? 0, total: stats.companies.total, color: 'bg-red-500' },
                                ].map(row => (
                                    <div key={row.label}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-600 dark:text-gray-400">{row.label}</span>
                                            <span className="font-semibold text-gray-900 dark:text-white">{row.value}</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${row.color} transition-all duration-500`}
                                                style={{ width: `${row.total ? (row.value / row.total) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        {/* Module usage */}
                        <Card padding="md" color="slate">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Módulos Mais Utilizados</h3>
                            <div className="space-y-2">
                                {stats.modules.slice(0, 6).map((m, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[60%]">{m.moduleName}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 h-1.5 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary-500 rounded-full"
                                                    style={{ width: `${stats.companies.total ? (m.companiesUsing / stats.companies.total) * 100 : 0}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-900 dark:text-white w-6 text-right">{m.companiesUsing}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ── COMPANIES ── */}
            {tab === 'companies' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <Input
                                placeholder="Pesquisar empresa..."
                                value={companySearch}
                                onChange={e => { setCompanySearch(e.target.value); setCompanyPage(1); }}
                                leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5 text-gray-400" />}
                            />
                        </div>
                        <Select
                            value={companyStatus}
                            onChange={e => { setCompanyStatus(e.target.value); setCompanyPage(1); }}
                            options={[
                                { value: '', label: 'Todos os estados' },
                                { value: 'active', label: 'Ativas' },
                                { value: 'trial', label: 'Trial' },
                                { value: 'blocked', label: 'Bloqueadas' },
                                { value: 'cancelled', label: 'Canceladas' },
                            ]}
                        />
                    </div>

                    {loading.companies ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-dark-600">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-dark-800 text-xs uppercase text-gray-500 dark:text-gray-400">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Empresa</th>
                                            <th className="px-4 py-3 text-left">Estado</th>
                                            <th className="px-4 py-3 text-center">Utilizadores</th>
                                            <th className="px-4 py-3 text-center">Módulos</th>
                                            <th className="px-4 py-3 text-left">Criada</th>
                                            <th className="px-4 py-3 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                        {(companies?.data || []).map(c => (
                                            <tr key={c.id} className="bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm flex-shrink-0">
                                                            {c.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                                                            {c.tradeName && <p className="text-xs text-gray-400">{c.tradeName}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{c.userCount}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span title={c.activeModules.map(m => m.name).join(', ')} className="cursor-default text-gray-600 dark:text-gray-400">
                                                        {c.moduleCount}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                                                    {format(new Date(c.createdAt), 'dd/MM/yyyy')}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        size="xs"
                                                        variant={c.status === 'active' ? 'danger' : 'success'}
                                                        disabled={togglingId === c.id}
                                                        onClick={() => handleCompanyStatus(c.id, c.status)}
                                                    >
                                                        {togglingId === c.id ? '...' : c.status === 'active' ? 'Bloquear' : 'Reativar'}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {companies?.pagination && companies.pagination.totalPages > 1 && (
                                <div className="px-4 py-3 bg-gray-50/50 dark:bg-dark-900/50 border-t border-gray-100 dark:border-dark-700 rounded-b-xl">
                                    <Pagination
                                        currentPage={companyPage}
                                        totalItems={companies.pagination.total}
                                        itemsPerPage={15}
                                        onPageChange={setCompanyPage}
                                        showItemsPerPage={false}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ── USERS ── */}
            {tab === 'users' && (
                <div className="space-y-4">
                    <div className="max-w-sm">
                        <Input
                            placeholder="Pesquisar utilizador..."
                            value={userSearch}
                            onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                            leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5 text-gray-400" />}
                        />
                    </div>

                    {loading.users ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-dark-600">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-dark-800 text-xs uppercase text-gray-500 dark:text-gray-400">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Utilizador</th>
                                            <th className="px-4 py-3 text-left">Empresa</th>
                                            <th className="px-4 py-3 text-left">Perfil</th>
                                            <th className="px-4 py-3 text-center">Estado</th>
                                            <th className="px-4 py-3 text-left">Último Login</th>
                                            <th className="px-4 py-3 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                        {(users?.data || []).map(u => (
                                            <tr key={u.id} className="bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-900 dark:text-white">{u.name}</p>
                                                    <p className="text-xs text-gray-400">{u.email}</p>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.company?.name || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">{u.role}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${u.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-dark-700 dark:text-gray-400'}`}>
                                                        {u.isActive ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                                                    {u.lastLoginAt ? formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true, locale: ptBR }) : 'Nunca'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {(() => {
                                                        const isSelf = u.id === currentUser?.id;
                                                        const isProtectedSuper = u.role === 'super_admin' && u.isActive;
                                                        const blocked = isSelf || isProtectedSuper;
                                                        const title = isSelf
                                                            ? 'Não pode alterar a sua própria conta'
                                                            : isProtectedSuper
                                                                ? 'Não é permitido desativar outro super administrador'
                                                                : '';
                                                        return (
                                                            <Button
                                                                size="xs"
                                                                variant={u.isActive ? 'danger' : 'success'}
                                                                disabled={togglingId === u.id || blocked}
                                                                title={title}
                                                                onClick={() => handleUserStatus(u)}
                                                            >
                                                                {togglingId === u.id ? '...' : u.isActive ? 'Desativar' : 'Ativar'}
                                                            </Button>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {users?.pagination && users.pagination.totalPages > 1 && (
                                <div className="px-4 py-3 bg-gray-50/50 dark:bg-dark-900/50 border-t border-gray-100 dark:border-dark-700 rounded-b-xl">
                                    <Pagination
                                        currentPage={userPage}
                                        totalItems={users.pagination.total}
                                        itemsPerPage={20}
                                        onPageChange={setUserPage}
                                        showItemsPerPage={false}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ── ACTIVITY ── */}
            {tab === 'activity' && (
                <div className="space-y-4">
                    {loading.activity ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-dark-600">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-dark-800 text-xs uppercase text-gray-500 dark:text-gray-400">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Ação</th>
                                            <th className="px-4 py-3 text-left">Entidade</th>
                                            <th className="px-4 py-3 text-left">Utilizador</th>
                                            <th className="px-4 py-3 text-left">Empresa</th>
                                            <th className="px-4 py-3 text-left">IP</th>
                                            <th className="px-4 py-3 text-left">Quando</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                                        {(activity?.data || []).map(a => (
                                            <tr key={a.id} className="bg-white dark:bg-dark-800 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 text-xs rounded-full font-medium">
                                                        {ACTION_LABELS[a.action] || a.action}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs">{a.entity}{a.entityId ? ` #${a.entityId.slice(0, 8)}` : ''}</td>
                                                <td className="px-4 py-3 text-gray-900 dark:text-white">{a.user?.name || '—'}</td>
                                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{a.user?.company?.name || '—'}</td>
                                                <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono text-xs">{a.ipAddress || '—'}</td>
                                                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                                                    {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true, locale: ptBR })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {activity?.pagination && activity.pagination.totalPages > 1 && (
                                <div className="px-4 py-3 bg-gray-50/50 dark:bg-dark-900/50 border-t border-gray-100 dark:border-dark-700 rounded-b-xl">
                                    <Pagination
                                        currentPage={activityPage}
                                        totalItems={activity.pagination.total}
                                        itemsPerPage={30}
                                        onPageChange={setActivityPage}
                                        showItemsPerPage={false}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ── SYSTEM ── */}
            {tab === 'system' && (
                <div className="space-y-6">
                    {loading.system ? (
                        <div className="flex justify-center py-16">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                        </div>
                    ) : health ? (
                        <>
                            {/* Status Banner */}
                            <div className={`flex items-center gap-3 p-4 rounded-xl border ${health.status === 'healthy' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                                <HiOutlineCheckCircle className={`w-6 h-6 ${health.status === 'healthy' ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`} />
                                <div>
                                    <p className={`font-semibold ${health.status === 'healthy' ? 'text-green-800 dark:text-green-300' : 'text-red-700'}`}>
                                        {health.status === 'healthy' ? 'Sistema Operacional' : 'Problema Detetado'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Verificado em {format(new Date(health.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Process Info */}
                                <Card padding="md" color="slate">
                                    <div className="flex items-center gap-2 mb-4">
                                        <HiOutlineCpuChip className="w-5 h-5 text-primary-500" />
                                        <h3 className="font-semibold text-gray-900 dark:text-white">Processo Node.js</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Versão Node', value: health.process.nodeVersion },
                                            { label: 'Uptime', value: formatUptime(health.process.uptime) },
                                            { label: 'Memória Heap', value: `${health.process.memoryMb} MB` },
                                        ].map(row => (
                                            <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-dark-700 last:border-0">
                                                <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                {/* DB Info */}
                                <Card padding="md" color="slate">
                                    <div className="flex items-center gap-2 mb-4">
                                        <HiOutlineServerStack className="w-5 h-5 text-primary-500" />
                                        <h3 className="font-semibold text-gray-900 dark:text-white">Base de Dados</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Tamanho', value: health.database.size },
                                            { label: 'Versão', value: health.database.version.split(' ').slice(0, 2).join(' ') },
                                        ].map(row => (
                                            <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-dark-700 last:border-0">
                                                <span className="text-sm text-gray-500 dark:text-gray-400">{row.label}</span>
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </div>

                            {/* Top Tables */}
                            <Card padding="md" color="slate">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Tabelas com Mais Registos</h3>
                                <div className="space-y-2">
                                    {health.database.topTables.map((t, i) => {
                                        const max = health.database.topTables[0]?.rows || 1;
                                        return (
                                            <div key={i} className="flex items-center gap-3">
                                                <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                                                <span className="text-sm text-gray-700 dark:text-gray-300 w-40 font-mono truncate">{t.table}</span>
                                                <div className="flex-1 h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(t.rows / max) * 100}%` }} />
                                                </div>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right">{t.rows.toLocaleString()}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        </>
                    ) : (
                        <p className="text-center text-gray-500 py-12">Não foi possível carregar dados do sistema.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;
