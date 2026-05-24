/**
 * NotificationSettings (admin)
 *
 * Matrix: roles × modules. Each cell controls whether that role sees alerts
 * of that module in the NotificationCenter, in the daily email digest, and
 * what minimum priority qualifies.
 *
 * See [[audit-alerts]] skill.
 */

import { useEffect, useMemo, useState } from 'react';
import { HiOutlineBell, HiOutlineEnvelope, HiOutlineArrowPath, HiOutlineCheckCircle, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { Card, Button, Select, PageHeader, Skeleton, ConfirmationModal } from '../components/ui';
import api from '../services/api/client';
import { logger } from '../utils/logger';
import { useAuthStore } from '../stores/useAuthStore';
import toast from 'react-hot-toast';

interface NotificationPreference {
    id: string;
    role: string;
    module: string;
    alertType: string | null;
    inCenter: boolean;
    inEmail: boolean;
    minPriority: 'low' | 'medium' | 'high' | 'critical';
}

interface PrefsResponse {
    data: NotificationPreference[];
    roles: string[];
    modules: string[];
    priorities: ('low' | 'medium' | 'high' | 'critical')[];
}

const ROLE_LABEL: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    manager: 'Gestor',
    operator: 'Operador',
    cashier: 'Caixa',
    stock_keeper: 'Stock Keeper',
};

const MODULE_LABEL: Record<string, string> = {
    audit: 'Auditoria',
    invoices: 'Facturas',
    inventory: 'Inventário',
    pharmacy: 'Farmácia',
    hospitality: 'Hotelaria',
    crm: 'CRM',
    pos: 'POS',
    general: 'Geral',
};

const PRIORITY_LABEL = { low: 'Baixa+', medium: 'Média+', high: 'Alta+', critical: 'Crítica' };

export default function NotificationSettings() {
    const { user } = useAuthStore();
    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
    const [roles, setRoles] = useState<string[]>([]);
    const [modules, setModules] = useState<string[]>([]);
    const [dirty, setDirty] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);

    const loadPrefs = async () => {
        setLoading(true);
        try {
            const { data } = await api.get<PrefsResponse>('/notification-preferences');
            setPrefs(data.data);
            setRoles(data.roles);
            setModules(data.modules);
            setDirty(false);
        } catch (err) {
            logger.error('Failed to load prefs', err);
            toast.error('Erro ao carregar preferências');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadPrefs(); }, []);

    // Quick lookup by (role, module). The matrix renders one cell per pair.
    const prefByCell = useMemo(() => {
        const map = new Map<string, NotificationPreference>();
        for (const p of prefs) {
            if (p.alertType === null) map.set(`${p.role}|${p.module}`, p);
        }
        return map;
    }, [prefs]);

    const upsertCell = (role: string, module: string, patch: Partial<NotificationPreference>) => {
        if (!isAdmin) return;
        setDirty(true);
        setPrefs(prev => {
            const idx = prev.findIndex(p => p.role === role && p.module === module && p.alertType === null);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...patch };
                return next;
            }
            return [...prev, {
                id: `new-${role}-${module}`,
                role,
                module,
                alertType: null,
                inCenter: true,
                inEmail: false,
                minPriority: 'low',
                ...patch,
            }];
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = prefs.map(p => ({
                role: p.role,
                module: p.module,
                alertType: p.alertType,
                inCenter: p.inCenter,
                inEmail: p.inEmail,
                minPriority: p.minPriority,
            }));
            await api.put('/notification-preferences', payload);
            toast.success('Preferências guardadas');
            await loadPrefs();
        } catch (err) {
            logger.error('Failed to save prefs', err);
            toast.error('Erro ao guardar preferências');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        setShowResetModal(false);
        setSaving(true);
        try {
            await api.post('/notification-preferences/reset');
            toast.success('Defaults repostos');
            await loadPrefs();
        } catch (err) {
            logger.error('Reset failed', err);
            toast.error('Erro ao repor defaults');
        } finally {
            setSaving(false);
        }
    };

    const handleForceScan = async () => {
        setScanning(true);
        try {
            const { data } = await api.post<{ created: number; resolved: number; durationMs: number }>('/alerts/generate/audit');
            toast.success(`Scan completo — ${data.created} novos, ${data.resolved} resolvidos em ${data.durationMs}ms`);
        } catch (err) {
            logger.error('Scan failed', err);
            toast.error('Erro ao correr scan de auditoria');
        } finally {
            setScanning(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Notificações"
                subtitle="Configurar quem recebe alertas no sino e por email, por papel"
                icon={<HiOutlineBell />}
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleForceScan}
                            disabled={scanning}
                            leftIcon={<HiOutlineArrowPath className={scanning ? 'animate-spin' : ''} />}
                        >
                            {scanning ? 'A correr scan…' : 'Forçar scan de auditoria'}
                        </Button>
                        {isAdmin && (
                            <>
                                <Button variant="ghost" size="sm" onClick={() => setShowResetModal(true)} disabled={saving}>
                                    Repor defaults
                                </Button>
                                <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
                                    {saving ? 'A guardar…' : 'Guardar alterações'}
                                </Button>
                            </>
                        )}
                    </div>
                }
            />

            <ConfirmationModal
                isOpen={showResetModal}
                onClose={() => setShowResetModal(false)}
                onConfirm={handleReset}
                title="Repor preferências"
                message="Repor todas as preferências de notificação para os valores por defeito? Esta acção não pode ser desfeita."
                confirmText="Repor"
                cancelText="Cancelar"
                variant="warning"
                isLoading={saving}
            />

            {!isAdmin && (
                <Card padding="md" className="bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-500/20">
                    <div className="flex items-start gap-3">
                        <HiOutlineExclamationTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Modo só-leitura</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                Só administradores podem alterar preferências de notificação. Contacte um admin se precisar de ajustes.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            <Card padding="md">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-dark-700">
                                <th className="text-left py-3 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Papel</th>
                                {modules.map(m => (
                                    <th key={m} className="text-center py-3 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        {MODULE_LABEL[m] || m}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-dark-700">
                            {roles.map(role => (
                                <tr key={role}>
                                    <td className="py-4 px-3 font-bold text-sm text-slate-900 dark:text-white">
                                        {ROLE_LABEL[role] || role}
                                    </td>
                                    {modules.map(module => {
                                        const cell = prefByCell.get(`${role}|${module}`);
                                        const inCenter = cell?.inCenter ?? true;
                                        const inEmail = cell?.inEmail ?? false;
                                        const minPriority = cell?.minPriority ?? 'low';
                                        return (
                                            <td key={module} className="py-3 px-2">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            disabled={!isAdmin}
                                                            onClick={() => upsertCell(role, module, { inCenter: !inCenter })}
                                                            title="Sino"
                                                            className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                                                                inCenter
                                                                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                                                                    : 'bg-slate-100 text-slate-400 dark:bg-dark-700'
                                                            } ${isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'}`}
                                                        >
                                                            <HiOutlineBell className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={!isAdmin}
                                                            onClick={() => upsertCell(role, module, { inEmail: !inEmail })}
                                                            title="Email digest"
                                                            className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                                                                inEmail
                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                                    : 'bg-slate-100 text-slate-400 dark:bg-dark-700'
                                                            } ${isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'}`}
                                                        >
                                                            <HiOutlineEnvelope className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <Select
                                                        size="xs"
                                                        disabled={!isAdmin}
                                                        value={minPriority}
                                                        onChange={(e) => upsertCell(role, module, { minPriority: e.target.value as 'low' | 'medium' | 'high' | 'critical' })}
                                                        options={[
                                                            { value: 'low', label: PRIORITY_LABEL.low },
                                                            { value: 'medium', label: PRIORITY_LABEL.medium },
                                                            { value: 'high', label: PRIORITY_LABEL.high },
                                                            { value: 'critical', label: PRIORITY_LABEL.critical },
                                                        ]}
                                                        className="text-[10px] !h-7 w-20"
                                                    />
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-dark-700 flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                        <HiOutlineBell className="w-4 h-4 text-primary-600" />
                        <span>Sino (NotificationCenter)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <HiOutlineEnvelope className="w-4 h-4 text-emerald-600" />
                        <span>Email digest diário 07:00</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <HiOutlineCheckCircle className="w-4 h-4 text-slate-400" />
                        <span>Prioridade mínima para notificar</span>
                    </div>
                </div>
            </Card>
        </div>
    );
}
