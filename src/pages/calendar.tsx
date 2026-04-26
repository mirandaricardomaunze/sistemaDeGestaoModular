import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
    HiOutlineCalendar,
    HiOutlinePlus,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlinePencilSquare,
    HiOutlineTrash,
    HiOutlineClock,
    HiOutlineListBullet,
    HiOutlineViewColumns,
    HiOutlineXMark,
    HiOutlineCheck,
    HiOutlineBell,
} from 'react-icons/hi2';
import { calendarAPI, type CalendarEvent, type CreateCalendarEventDto } from '../services/api/calendar.api';
import { cn } from '../utils/helpers';
import { useAuthStore } from '../stores/useAuthStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const MODULE_COLORS: Record<string, string> = {
    sales: 'bg-blue-500',
    logistics: 'bg-amber-500',
    hospitality: 'bg-purple-500',
    restaurant: 'bg-rose-500',
    pharmacy: 'bg-teal-500',
    commercial: 'bg-indigo-500',
    fiscal: 'bg-orange-500',
    hr: 'bg-green-500',
    crm: 'bg-cyan-500',
    calendar: 'bg-slate-500',
};

const EVENT_COLORS = [
    { value: '#3b82f6', label: 'Azul' },
    { value: '#10b981', label: 'Verde' },
    { value: '#f59e0b', label: 'Amarelo' },
    { value: '#ef4444', label: 'Vermelho' },
    { value: '#8b5cf6', label: 'Roxo' },
    { value: '#ec4899', label: 'Rosa' },
    { value: '#06b6d4', label: 'Ciano' },
    { value: '#64748b', label: 'Cinza' },
];

const MODULE_OPTIONS = [
    { value: '', label: 'Geral' },
    { value: 'sales', label: 'Vendas' },
    { value: 'logistics', label: 'Logística' },
    { value: 'hospitality', label: 'Hotelaria' },
    { value: 'restaurant', label: 'Restaurante' },
    { value: 'pharmacy', label: 'Farmácia' },
    { value: 'commercial', label: 'Comercial' },
    { value: 'fiscal', label: 'Fiscal' },
    { value: 'hr', label: 'Recursos Humanos' },
    { value: 'crm', label: 'CRM' },
];

// ── Module detection from URL ─────────────────────────────────────────────────

const PATH_TO_MODULE: Record<string, string> = {
    hospitality: 'hospitality',
    hotel: 'hospitality',
    logistics: 'logistics',
    commercial: 'commercial',
    restaurant: 'restaurant',
    pharmacy: 'pharmacy',
    'bottle-store': 'commercial',
    bottlestore: 'commercial',
    fiscal: 'fiscal',
    employees: 'hr',
    crm: 'crm',
    customers: 'crm',
    sales: 'sales',
    financial: 'sales',
};

function detectModuleFromPath(pathname: string): string {
    const segment = pathname.split('/').filter(Boolean)[0] || '';
    return PATH_TO_MODULE[segment] || '';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleString('pt-MZ', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function toLocalDatetimeValue(dateStr: string) {
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Event dot/pill colors ─────────────────────────────────────────────────────

function getEventStyle(event: CalendarEvent) {
    if (event.color) return { backgroundColor: event.color };
    const mod = event.module || 'calendar';
    return {};
}

function getEventBgClass(event: CalendarEvent) {
    if (event.color) return '';
    return MODULE_COLORS[event.module || 'calendar'] || 'bg-slate-500';
}

// ── Event Form ────────────────────────────────────────────────────────────────

interface EventFormProps {
    initial?: Partial<CreateCalendarEventDto & { id: string; isCompleted: boolean }>;
    defaultDate?: Date;
    currentModule?: string;
    onSave: (data: CreateCalendarEventDto & { isCompleted?: boolean }) => void;
    onClose: () => void;
    loading?: boolean;
}

function EventForm({ initial, defaultDate, currentModule, onSave, onClose, loading }: EventFormProps) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const defaultStart = defaultDate
        ? `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}T09:00`
        : toLocalDatetimeValue(new Date().toISOString());
    const defaultEnd = defaultDate
        ? `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}T10:00`
        : toLocalDatetimeValue(new Date(Date.now() + 3600000).toISOString());

    const [form, setForm] = useState({
        title: initial?.title || '',
        description: initial?.description || '',
        startAt: initial?.startAt ? toLocalDatetimeValue(initial.startAt) : defaultStart,
        endAt: initial?.endAt ? toLocalDatetimeValue(initial.endAt) : defaultEnd,
        allDay: initial?.allDay || false,
        module: initial?.module || currentModule || '',
        color: initial?.color || '',
        recurrence: initial?.recurrence || '',
        notifyBefore: initial?.notifyBefore?.toString() || '',
        isCompleted: initial?.isCompleted || false,
    });

    const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) return toast.error('Título é obrigatório');
        if (!form.startAt || !form.endAt) return toast.error('Datas são obrigatórias');
        onSave({
            title: form.title.trim(),
            description: form.description || undefined,
            startAt: new Date(form.startAt).toISOString(),
            endAt: new Date(form.endAt).toISOString(),
            allDay: form.allDay,
            module: form.module || undefined,
            color: form.color || undefined,
            recurrence: form.recurrence || undefined,
            notifyBefore: form.notifyBefore ? Number(form.notifyBefore) : undefined,
            isCompleted: form.isCompleted,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <form
                className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4"
                onClick={e => e.stopPropagation()}
                onSubmit={handleSubmit}
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {initial?.id ? 'Editar Evento' : 'Novo Evento'}
                    </h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <HiOutlineXMark className="w-5 h-5" />
                    </button>
                </div>

                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título *</label>
                    <input
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.title}
                        onChange={e => set('title', e.target.value)}
                        placeholder="Nome do evento"
                        required
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                    <textarea
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={2}
                        value={form.description}
                        onChange={e => set('description', e.target.value)}
                        placeholder="Descrição opcional"
                    />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Início *</label>
                        <input
                            type={form.allDay ? 'date' : 'datetime-local'}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={form.allDay ? form.startAt.substring(0, 10) : form.startAt}
                            onChange={e => set('startAt', e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fim *</label>
                        <input
                            type={form.allDay ? 'date' : 'datetime-local'}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={form.allDay ? form.endAt.substring(0, 10) : form.endAt}
                            onChange={e => set('endAt', e.target.value)}
                            required
                        />
                    </div>
                </div>

                {/* All day + Module badge row */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <input
                            id="allDay"
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={form.allDay}
                            onChange={e => set('allDay', e.target.checked)}
                        />
                        <label htmlFor="allDay" className="text-sm text-gray-700 dark:text-gray-300">Dia inteiro</label>
                    </div>
                    {form.module && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                            {MODULE_OPTIONS.find(m => m.value === form.module)?.label || form.module}
                        </span>
                    )}
                </div>

                {/* Color + Notify row */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cor</label>
                        <div className="flex gap-2 flex-wrap">
                            {EVENT_COLORS.map(c => (
                                <button
                                    key={c.value}
                                    type="button"
                                    title={c.label}
                                    className={cn('w-6 h-6 rounded-full border-2 transition-all', form.color === c.value ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent')}
                                    style={{ backgroundColor: c.value }}
                                    onClick={() => set('color', form.color === c.value ? '' : c.value)}
                                />
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            <HiOutlineBell className="inline w-4 h-4 mr-1" />Lembrete (min)
                        </label>
                        <select
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={form.notifyBefore}
                            onChange={e => set('notifyBefore', e.target.value)}
                        >
                            <option value="">Sem lembrete</option>
                            <option value="5">5 minutos antes</option>
                            <option value="15">15 minutos antes</option>
                            <option value="30">30 minutos antes</option>
                            <option value="60">1 hora antes</option>
                            <option value="1440">1 dia antes</option>
                        </select>
                    </div>
                </div>

                {/* Recurrence */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recorrência</label>
                    <select
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={form.recurrence}
                        onChange={e => set('recurrence', e.target.value)}
                    >
                        <option value="">Não se repete</option>
                        <option value="daily">Diariamente</option>
                        <option value="weekly">Semanalmente</option>
                        <option value="monthly">Mensalmente</option>
                    </select>
                </div>

                {/* Completed (edit only) */}
                {initial?.id && (
                    <div className="flex items-center gap-2">
                        <input
                            id="isCompleted"
                            type="checkbox"
                            className="rounded border-gray-300"
                            checked={form.isCompleted}
                            onChange={e => set('isCompleted', e.target.checked)}
                        />
                        <label htmlFor="isCompleted" className="text-sm text-gray-700 dark:text-gray-300">Marcar como concluído</label>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
                    >
                        {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {initial?.id ? 'Guardar' : 'Criar Evento'}
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── Event Detail Popup ────────────────────────────────────────────────────────

function EventDetail({
    event,
    onEdit,
    onDelete,
    onClose,
}: { event: CalendarEvent; onEdit: () => void; onDelete: () => void; onClose: () => void }) {
    const { user } = useAuthStore();
    const isOwner = user?.id === event.createdById;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-3"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span
                            className={cn('w-3 h-3 rounded-full flex-shrink-0 mt-1', getEventBgClass(event))}
                            style={getEventStyle(event)}
                        />
                        <h3 className={cn('font-semibold text-gray-900 dark:text-white', event.isCompleted && 'line-through opacity-60')}>
                            {event.title}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                        <HiOutlineXMark className="w-5 h-5" />
                    </button>
                </div>

                {event.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{event.description}</p>
                )}

                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <HiOutlineClock className="w-4 h-4" />
                    <span>
                        {event.allDay
                            ? new Date(event.startAt).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' })
                            : `${formatDateTime(event.startAt)} → ${formatTime(event.endAt)}`
                        }
                    </span>
                </div>

                {event.module && (
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        {MODULE_OPTIONS.find(m => m.value === event.module)?.label || event.module}
                    </span>
                )}

                {event.recurrence && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Repete: {event.recurrence === 'daily' ? 'Diariamente' : event.recurrence === 'weekly' ? 'Semanalmente' : 'Mensalmente'}
                    </p>
                )}

                {event.attendees.length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Participantes</p>
                        <div className="flex flex-wrap gap-1">
                            {event.attendees.map(a => (
                                <span key={a.id} className={cn(
                                    'text-xs px-2 py-0.5 rounded-full',
                                    a.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                        a.status === 'declined' ? 'bg-red-100 text-red-700' :
                                            'bg-gray-100 text-gray-600'
                                )}>
                                    {a.user.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <p className="text-xs text-gray-400">Criado por {event.createdBy.name}</p>

                {isOwner && (
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={onEdit}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                            <HiOutlinePencilSquare className="w-4 h-4" /> Editar
                        </button>
                        <button
                            onClick={onDelete}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100"
                        >
                            <HiOutlineTrash className="w-4 h-4" /> Eliminar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({
    year,
    month,
    events,
    onDayClick,
    onEventClick,
}: {
    year: number;
    month: number;
    events: CalendarEvent[];
    onDayClick: (date: Date) => void;
    onEventClick: (event: CalendarEvent) => void;
}) {
    const today = new Date();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);

    const getEventsForDay = (day: number) => {
        const date = new Date(year, month, day);
        return events.filter(e => isSameDay(new Date(e.startAt), date));
    };

    return (
        <div className="flex flex-col">
            {/* Weekday headers — sticky below page header */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky top-0 z-10">
                {WEEKDAYS.map(d => (
                    <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
                {cells.map((day, i) => {
                    if (!day) return <div key={i} className="min-h-28 border-b border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50" />;

                    const date = new Date(year, month, day);
                    const isToday = isSameDay(date, today);
                    const dayEvents = getEventsForDay(day);

                    return (
                        <div
                            key={i}
                            className="min-h-28 border-b border-r border-gray-100 dark:border-gray-800 p-1 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                            onClick={() => onDayClick(date)}
                        >
                            <div className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium mb-1 mx-auto',
                                isToday ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            )}>
                                {day}
                            </div>
                            <div className="space-y-0.5">
                                {dayEvents.slice(0, 3).map(ev => (
                                    <div
                                        key={ev.id}
                                        className={cn(
                                            'text-xs px-1.5 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80',
                                            getEventBgClass(ev),
                                            ev.isCompleted && 'opacity-50 line-through'
                                        )}
                                        style={getEventStyle(ev)}
                                        onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                                        title={ev.title}
                                    >
                                        {!ev.allDay && <span className="opacity-80 mr-1">{formatTime(ev.startAt)}</span>}
                                        {ev.title}
                                    </div>
                                ))}
                                {dayEvents.length > 3 && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 px-1">+{dayEvents.length - 3} mais</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── List View ────────────────────────────────────────────────────────────────

function ListView({ events, onEventClick }: { events: CalendarEvent[]; onEventClick: (e: CalendarEvent) => void }) {
    const grouped: Record<string, CalendarEvent[]> = {};
    events.forEach(ev => {
        const key = new Date(ev.startAt).toLocaleDateString('pt-MZ', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(ev);
    });

    if (Object.keys(grouped).length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 gap-3 py-20">
                <HiOutlineCalendar className="w-12 h-12" />
                <p>Nenhum evento neste período</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto p-4 space-y-6">
            {Object.entries(grouped).map(([date, evs]) => (
                <div key={date}>
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 capitalize">{date}</h3>
                    <div className="space-y-2">
                        {evs.map(ev => (
                            <div
                                key={ev.id}
                                className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-colors"
                                onClick={() => onEventClick(ev)}
                            >
                                <span
                                    className={cn('w-3 h-3 rounded-full flex-shrink-0 mt-1.5', getEventBgClass(ev))}
                                    style={getEventStyle(ev)}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className={cn('text-sm font-medium text-gray-900 dark:text-white truncate', ev.isCompleted && 'line-through opacity-60')}>
                                        {ev.title}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {ev.allDay ? 'Dia inteiro' : `${formatTime(ev.startAt)} – ${formatTime(ev.endAt)}`}
                                        {ev.module && ` · ${MODULE_OPTIONS.find(m => m.value === ev.module)?.label || ev.module}`}
                                    </p>
                                    {ev.description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{ev.description}</p>}
                                </div>
                                {ev.isCompleted && <HiOutlineCheck className="w-4 h-4 text-green-500 flex-shrink-0" />}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'list';

export default function CalendarPage() {
    const queryClient = useQueryClient();
    const location = useLocation();
    const currentModule = detectModuleFromPath(location.pathname);
    const today = new Date();

    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [currentDate, setCurrentDate] = useState(today);
    const [showForm, setShowForm] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
    const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
    const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Fetch events for current month (+1 buffer on each side), filtered by current module
    const startOfRange = new Date(year, month - 1, 1).toISOString();
    const endOfRange = new Date(year, month + 2, 0).toISOString();

    const { data: events = [], isLoading } = useQuery({
        queryKey: ['calendar-events', year, month, currentModule],
        queryFn: () => calendarAPI.getEvents({
            start: startOfRange,
            end: endOfRange,
            module: currentModule || undefined,
        }),
    });

    const createMutation = useMutation({
        mutationFn: calendarAPI.createEvent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
            setShowForm(false);
            toast.success('Evento criado');
        },
        onError: () => toast.error('Erro ao criar evento'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => calendarAPI.updateEvent(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
            setEditingEvent(null);
            setDetailEvent(null);
            toast.success('Evento actualizado');
        },
        onError: () => toast.error('Erro ao actualizar evento'),
    });

    const deleteMutation = useMutation({
        mutationFn: calendarAPI.deleteEvent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
            setDetailEvent(null);
            toast.success('Evento eliminado');
        },
        onError: () => toast.error('Erro ao eliminar evento'),
    });

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToday = () => setCurrentDate(today);

    const handleDayClick = useCallback((date: Date) => {
        setDefaultDate(date);
        setEditingEvent(null);
        setShowForm(true);
    }, []);

    const handleEventClick = useCallback((event: CalendarEvent) => {
        setDetailEvent(event);
    }, []);

    const handleSave = (data: any) => {
        if (editingEvent) {
            updateMutation.mutate({ id: editingEvent.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleEdit = () => {
        if (detailEvent) {
            setEditingEvent(detailEvent);
            setDetailEvent(null);
            setShowForm(true);
        }
    };

    const handleDelete = () => {
        if (detailEvent && window.confirm(`Eliminar "${detailEvent.title}"?`)) {
            deleteMutation.mutate(detailEvent.id);
        }
    };

    // Filter events for list view (current month only)
    const listEvents = viewMode === 'list'
        ? events.filter(e => {
            const d = new Date(e.startAt);
            return d.getFullYear() === year && d.getMonth() === month;
        }).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        : events;

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineCalendar className="w-6 h-6 text-blue-600" />
                        Calendário
                    </h1>

                    {/* Navigation */}
                    <div className="flex items-center gap-1">
                        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <HiOutlineChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={goToday} className="px-3 py-1 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
                            Hoje
                        </button>
                        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
                            <HiOutlineChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                        {MONTH_NAMES[month]} {year}
                    </h2>
                </div>

                <div className="flex items-center gap-3">
                    {/* Active module badge */}
                    {currentModule && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                            {MODULE_OPTIONS.find(m => m.value === currentModule)?.label || currentModule}
                        </span>
                    )}

                    {/* View toggle */}
                    <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <button
                            onClick={() => setViewMode('month')}
                            className={cn('px-3 py-1.5 text-sm flex items-center gap-1', viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800')}
                        >
                            <HiOutlineViewColumns className="w-4 h-4" /> Mês
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn('px-3 py-1.5 text-sm flex items-center gap-1', viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800')}
                        >
                            <HiOutlineListBullet className="w-4 h-4" /> Lista
                        </button>
                    </div>

                    {/* New event */}
                    <button
                        onClick={() => { setDefaultDate(undefined); setEditingEvent(null); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <HiOutlinePlus className="w-4 h-4" />
                        Novo Evento
                    </button>
                </div>
            </div>

            {/* Calendar Body — scrollable */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <span className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                ) : viewMode === 'month'
                    ? <MonthView year={year} month={month} events={events} onDayClick={handleDayClick} onEventClick={handleEventClick} />
                    : <ListView events={listEvents} onEventClick={handleEventClick} />
                }
            </div>

            {/* Event Form Modal */}
            {showForm && (
                <EventForm
                    initial={editingEvent ? {
                        id: editingEvent.id,
                        title: editingEvent.title,
                        description: editingEvent.description || '',
                        startAt: editingEvent.startAt,
                        endAt: editingEvent.endAt,
                        allDay: editingEvent.allDay,
                        module: editingEvent.module || '',
                        color: editingEvent.color || '',
                        recurrence: editingEvent.recurrence || '',
                        notifyBefore: editingEvent.notifyBefore || undefined,
                        isCompleted: editingEvent.isCompleted,
                    } : undefined}
                    defaultDate={defaultDate}
                    currentModule={currentModule}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditingEvent(null); }}
                    loading={createMutation.isPending || updateMutation.isPending}
                />
            )}

            {/* Event Detail Modal */}
            {detailEvent && !showForm && (
                <EventDetail
                    event={detailEvent}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onClose={() => setDetailEvent(null)}
                />
            )}
        </div>
    );
}
