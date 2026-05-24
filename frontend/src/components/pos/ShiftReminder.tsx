import { useEffect, useMemo, useState } from 'react';
import { HiOutlineClock, HiOutlineExclamationTriangle, HiOutlineXMark } from 'react-icons/hi2';
import { Button } from '../ui/Button';
import { cn, formatCurrency } from '../../utils/helpers';

type ShiftAlertSeverity = 'warning' | 'danger' | 'critical';

interface ShiftAlertState {
    severity: ShiftAlertSeverity;
    openedMinutes: number;
}

export interface ShiftReminderSession {
    id: string;
    openedAt: string;
    status: 'open' | 'closed' | 'suspended' | string;
    totalSales?: number | string | null;
    openedBy?: { name?: string | null } | null;
}

export interface ShiftReminderSummary {
    totalSales?: number | string | null;
}

interface ShiftReminderProps {
    shift: ShiftReminderSession | null | undefined;
    summary?: ShiftReminderSummary | null;
    isInteractionBlocked?: boolean;
    onCloseShift: () => void;
    onViewHistory: () => void;
}

const WARNING_MINUTES = 8 * 60;
const DANGER_MINUTES = 12 * 60;
const CRITICAL_MINUTES = 16 * 60;

const SNOOZE_MINUTES: Record<ShiftAlertSeverity, number> = {
    warning: 60,
    danger: 30,
    critical: 15,
};

function getAlertState(openedAt: string, now: Date): ShiftAlertState | null {
    const openedTime = new Date(openedAt).getTime();
    if (Number.isNaN(openedTime)) return null;

    const openedMinutes = Math.max(0, Math.floor((now.getTime() - openedTime) / 60000));
    if (openedMinutes >= CRITICAL_MINUTES) return { severity: 'critical', openedMinutes };
    if (openedMinutes >= DANGER_MINUTES) return { severity: 'danger', openedMinutes };
    if (openedMinutes >= WARNING_MINUTES) return { severity: 'warning', openedMinutes };
    return null;
}

function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours <= 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
}

function getSnoozeKey(shiftId: string, severity: ShiftAlertSeverity): string {
    return `shift_alert_snooze:${shiftId}:${severity}`;
}

function readSnoozeUntil(shiftId: string, severity: ShiftAlertSeverity): number {
    try {
        return Number(localStorage.getItem(getSnoozeKey(shiftId, severity)) || 0);
    } catch {
        return 0;
    }
}

function writeSnooze(shiftId: string, severity: ShiftAlertSeverity): number {
    const until = Date.now() + SNOOZE_MINUTES[severity] * 60_000;
    try {
        localStorage.setItem(getSnoozeKey(shiftId, severity), String(until));
    } catch {
        return until;
    }
    return until;
}

const severityStyle: Record<ShiftAlertSeverity, {
    title: string;
    badge: string;
    shell: string;
    icon: string;
    button: string;
}> = {
    warning: {
        title: 'Turno aberto ha muito tempo',
        badge: 'Aviso',
        shell: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
        icon: 'text-amber-600 dark:text-amber-300',
        button: 'bg-amber-600 hover:bg-amber-500 text-white',
    },
    danger: {
        title: 'Turno possivelmente esquecido',
        badge: 'Atencao',
        shell: 'border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100',
        icon: 'text-orange-600 dark:text-orange-300',
        button: 'bg-orange-600 hover:bg-orange-500 text-white',
    },
    critical: {
        title: 'Fecho de turno urgente',
        badge: 'Critico',
        shell: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100',
        icon: 'text-rose-600 dark:text-rose-300',
        button: 'bg-rose-600 hover:bg-rose-500 text-white',
    },
};

export function ShiftReminder({
    shift,
    summary,
    isInteractionBlocked = false,
    onCloseShift,
    onViewHistory,
}: ShiftReminderProps) {
    const [now, setNow] = useState(() => new Date());
    const [snoozedUntil, setSnoozedUntil] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const alert = useMemo(() => (
        shift?.status === 'open' ? getAlertState(shift.openedAt, now) : null
    ), [shift?.openedAt, shift?.status, now]);
    const alertSeverity = alert?.severity;

    useEffect(() => {
        if (!shift?.id || !alertSeverity) {
            setSnoozedUntil(0);
            return;
        }
        setSnoozedUntil(readSnoozeUntil(shift.id, alertSeverity));
    }, [shift?.id, alertSeverity]);

    if (!shift || !alert) return null;

    const style = severityStyle[alert.severity];
    const openedAt = new Date(shift.openedAt);
    const openedAtText = Number.isNaN(openedAt.getTime())
        ? 'hora desconhecida'
        : openedAt.toLocaleString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    const duration = formatDuration(alert.openedMinutes);
    const totalSales = Number(summary?.totalSales ?? shift.totalSales ?? 0);
    const canShowPopup = !isInteractionBlocked && Date.now() >= snoozedUntil;

    const handleSnooze = () => {
        setSnoozedUntil(writeSnooze(shift.id, alert.severity));
    };

    return (
        <>
            <div className={cn(
                'mb-2 flex flex-col gap-3 rounded-xl border px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between',
                style.shell,
            )}>
                <div className="flex items-start gap-3">
                    <HiOutlineClock className={cn('mt-0.5 h-5 w-5 shrink-0', style.icon)} />
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-widest">{style.badge}</span>
                            <span className="text-sm font-black">{style.title}</span>
                        </div>
                        <p className="mt-1 text-xs font-semibold opacity-80">
                            Aberto desde {openedAtText} ({duration}). Vendas no turno: {formatCurrency(totalSales)}.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={onViewHistory}>
                        Ver historico
                    </Button>
                    <Button size="sm" className={style.button} onClick={onCloseShift}>
                        Fechar turno
                    </Button>
                </div>
            </div>

            {canShowPopup && (
                <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleSnooze} />
                    <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#111214]">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className={cn('rounded-xl p-3', style.shell)}>
                                    <HiOutlineExclamationTriangle className={cn('h-6 w-6', style.icon)} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                        Controlo de caixa
                                    </p>
                                    <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white">
                                        {style.title}
                                    </h2>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleSnooze}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                                aria-label="Adiar aviso"
                            >
                                <HiOutlineXMark className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-black/30 dark:text-slate-200">
                            <p className="font-semibold">
                                Este turno esta aberto ha {duration}. Turnos muito longos aumentam o risco de divergencia no fecho de caixa, vendas no periodo errado e confusao de responsabilidade.
                            </p>
                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Abertura</p>
                                    <p className="font-bold">{openedAtText}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operador</p>
                                    <p className="truncate font-bold">{shift.openedBy?.name || 'Nao informado'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendas</p>
                                    <p className="font-bold">{formatCurrency(totalSales)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <Button variant="ghost" onClick={handleSnooze}>
                                Continuar por agora
                            </Button>
                            <Button variant="ghost" onClick={onViewHistory}>
                                Ver historico
                            </Button>
                            <Button className={style.button} onClick={onCloseShift}>
                                Fechar turno
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
