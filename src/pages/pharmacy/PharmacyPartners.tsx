import { useState, useMemo } from 'react';
import { Card, Button, Input, Modal, Badge, Pagination, Select } from '../../components/ui';
import {
    HiOutlinePlus, HiOutlineMagnifyingGlass, HiOutlinePencil, HiOutlineTrash,
    HiOutlineShieldCheck, HiOutlineEnvelope, HiOutlinePhone,
    HiOutlineTruck, HiOutlineCurrencyDollar, HiOutlineCheck,
    HiOutlineBuildingOffice
} from 'react-icons/hi2';
import { cn, formatCurrency, formatDate } from '../../utils/helpers';
import { usePharmacyPartners, type Partner } from '../../hooks/usePharmacyPartners';
import { usePharmacySuppliers } from '../../hooks/usePharmacySuppliers';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pharmacyAPI } from '../../services/api';
import toast from 'react-hot-toast';

type Tab = 'insurers' | 'suppliers' | 'billing';

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
    pending: { label: 'Pendente', variant: 'warning' },
    sent: { label: 'Enviada', variant: 'info' },
    partial: { label: 'Parcial', variant: 'warning' },
    paid: { label: 'Pago', variant: 'success' },
    overdue: { label: 'Vencida', variant: 'danger' },
    cancelled: { label: 'Cancelada', variant: 'default' },
};

export default function PharmacyPartners() {
    const [tab, setTab] = useState<Tab>('insurers');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Parceiros & Fornecedores</h1>
                <p className="text-gray-500 dark:text-gray-400">Seguradoras, convénios, fornecedores e faturação</p>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1 w-fit">
                {([
                    { id: 'insurers', label: 'Seguradoras', icon: HiOutlineShieldCheck },
                    { id: 'suppliers', label: 'Fornecedores', icon: HiOutlineTruck },
                    { id: 'billing', label: 'Faturação', icon: HiOutlineCurrencyDollar },
                ] as { id: Tab; label: string; icon: any }[]).map(t => {
                    const Icon = t.icon;
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                tab === t.id
                                    ? 'bg-white dark:bg-dark-800 text-primary-600 dark:text-primary-400 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            )}>
                            <Icon className={cn("w-4 h-4", tab === t.id ? "text-primary-600 dark:text-primary-400" : "text-gray-400")} />{t.label}
                        </button>
                    );
                })}
            </div>

            {tab === 'insurers' && <InsurersTab />}
            {tab === 'suppliers' && <SuppliersTab />}
            {tab === 'billing' && <BillingTab />}
        </div>
    );
}

// ──-Seguradoras/Convénios ────────────────────────────────────────────────────
function InsurersTab() {
    const { partners, isLoading, addPartner, updatePartner, deletePartner } = usePharmacyPartners();
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

    const filteredPartners = useMemo(() =>
        partners.filter(p => p.name.toLowerCase().includes(search.toLowerCase())), [partners, search]);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data = {
            name: fd.get('name') as string,
            category: fd.get('category') as string,
            coveragePercentage: Number(fd.get('coverage')),
            email: fd.get('email') as string || undefined,
            phone: fd.get('phone') as string || undefined,
            address: fd.get('address') as string || undefined,
            nuit: fd.get('nuit') as string || undefined,
        };
        try {
            if (editingPartner) await updatePartner(editingPartner.id, data);
            else await addPartner(data);
            setIsModalOpen(false); setEditingPartner(null);
        } catch { }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Input placeholder="Pesquisar seguradora..." value={search} onChange={e => setSearch(e.target.value)}
                    leftIcon={<HiOutlineMagnifyingGlass className="w-4 h-4 text-primary-600 dark:text-primary-400" />} className="max-w-xs" />
                <Button onClick={() => setIsModalOpen(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>Nova Seguradora</Button>
            </div>

            {isLoading && partners.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <Card key={i} className="h-36 animate-pulse">{null}</Card>)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPartners.map(partner => (
                        <Card key={partner.id} padding="md" className={cn('border-l-4 hover:shadow-md transition-shadow', partner.isActive ? 'border-l-primary-500' : 'border-l-gray-300')}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                                        <HiOutlineShieldCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white text-sm">{partner.name}</p>
                                        <p className="text-xs text-gray-500">{partner.category}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => { setEditingPartner(partner); setIsModalOpen(true); }} 
                                        className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all border border-indigo-100/50 dark:border-indigo-500/20 shadow-sm"
                                    >
                                        <HiOutlinePencil className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => { if (confirm('Remover parceiro?')) deletePartner(partner.id); }} 
                                        className="p-2 rounded-lg bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border border-red-100/50 dark:border-red-500/20 shadow-sm"
                                    >
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                            {partner.phone && <p className="text-xs text-gray-500 flex items-center gap-1 mb-1 font-bold"><HiOutlinePhone className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />{partner.phone}</p>}
                            {partner.email && <p className="text-xs text-gray-500 flex items-center gap-1 mb-3 font-bold"><HiOutlineEnvelope className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />{partner.email}</p>}
                            <div className="pt-3 border-t border-gray-100 dark:border-dark-700 flex items-center justify-between">
                                <span className="text-xs text-gray-500">Cobertura</span>
                                <Badge variant="success" className="font-bold text-sm">{partner.coveragePercentage}%</Badge>
                            </div>
                        </Card>
                    ))}
                    {filteredPartners.length === 0 && !isLoading && (
                        <div className="col-span-full py-12 text-center text-gray-400">Nenhuma seguradora cadastrada.</div>
                    )}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingPartner(null); }} title={editingPartner ? 'Editar Seguradora' : 'Nova Seguradora'} size="md">
                <form onSubmit={handleSave} className="space-y-4">
                    <Input label="Nome *" name="name" defaultValue={editingPartner?.name} required />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Categoria" name="category" defaultValue={editingPartner?.category} placeholder="Seguro Privado" />
                        <Input label="Cobertura (%)" name="coverage" type="number" defaultValue={editingPartner?.coveragePercentage} min="0" max="100" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Telefone" name="phone" defaultValue={editingPartner?.phone} />
                        <Input label="Email" name="email" type="email" defaultValue={editingPartner?.email} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="NUIT" name="nuit" defaultValue={editingPartner?.nuit} />
                        <Input label="Endereço" name="address" defaultValue={editingPartner?.address} />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                        <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Guardar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

// ──-Fornecedores ────────────────────────────────────────────────────────────
function SuppliersTab() {
    const { suppliers, isLoading, pagination, page, setPage, search, setSearch, addSupplier, updateSupplier, deleteSupplier } = usePharmacySuppliers();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<any>(null);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data = {
            name: fd.get('name') as string,
            phone: fd.get('phone') as string,
            email: fd.get('email') as string || undefined,
            address: fd.get('address') as string || undefined,
            nuit: fd.get('nuit') as string || undefined,
            contactPerson: fd.get('contactPerson') as string || undefined,
        };
        try {
            if (editing) await updateSupplier(editing.id, data);
            else await addSupplier(data);
            setIsModalOpen(false); setEditing(null);
        } catch { }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Input placeholder="Pesquisar fornecedor..." value={search} onChange={e => setSearch(e.target.value)}
                    leftIcon={<HiOutlineMagnifyingGlass className="w-4 h-4 text-primary-600 dark:text-primary-400" />} className="max-w-xs" />
                <Button onClick={() => setIsModalOpen(true)} leftIcon={<HiOutlinePlus className="w-4 h-4 text-white" />}>Novo Fornecedor</Button>
            </div>

            <Card padding="none">
                {isLoading ? (
                    <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-700 border-b dark:border-dark-600">
                                <tr>
                                    {['Fornecedor', 'Contacto', 'Responsável', 'NUIT', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-dark-700">
                                {suppliers.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Nenhum fornecedor registado</td></tr>
                                ) : suppliers.map((s: any) => (
                                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                                    <HiOutlineTruck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <span className="font-medium">{s.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            <div>{s.phone}</div>
                                            {s.email && <div className="text-xs">{s.email}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{s.contactPerson || ''}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.nuit || ''}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => { setEditing(s); setIsModalOpen(true); }} 
                                                    className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all border border-indigo-100/50 dark:border-indigo-500/20 shadow-sm"
                                                >
                                                    <HiOutlinePencil className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => { if (confirm('Remover fornecedor?')) deleteSupplier(s.id); }} 
                                                    className="p-2 rounded-lg bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border border-red-100/50 dark:border-red-500/20 shadow-sm"
                                                >
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {pagination && pagination.total > 0 && (
                    <div className="px-4 pb-2">
                        <Pagination currentPage={page} totalItems={pagination.total} itemsPerPage={20} onPageChange={setPage} />
                    </div>
                )}
            </Card>

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditing(null); }} title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'} size="md">
                <form onSubmit={handleSave} className="space-y-4">
                    <Input label="Nome *" name="name" defaultValue={editing?.name} required />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Telefone *" name="phone" defaultValue={editing?.phone} required />
                        <Input label="Email" name="email" type="email" defaultValue={editing?.email} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="NUIT" name="nuit" defaultValue={editing?.nuit} />
                        <Input label="Responsável" name="contactPerson" defaultValue={editing?.contactPerson} />
                    </div>
                    <Input label="Endereço" name="address" defaultValue={editing?.address} />
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                        <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Guardar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

// ──-Faturação a Parceiros ────────────────────────────────────────────────────
function BillingTab() {
    const queryClient = useQueryClient();
    const [showGenerate, setShowGenerate] = useState(false);
    const [showPayment, setShowPayment] = useState<any>(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [generateForm, setGenerateForm] = useState({ partnerId: '', periodStart: '', periodEnd: '', dueDate: '' });

    const { data: invoicesData, isLoading } = useQuery({
        queryKey: ['pharmacy', 'partner-invoices', statusFilter, page],
        queryFn: () => pharmacyAPI.getPartnerInvoices({ status: statusFilter || undefined, page, limit: 20 }),
    });

    const { data: partnersRaw } = useQuery({
        queryKey: ['pharmacy', 'partners'],
        queryFn: () => pharmacyAPI.getPartners({ isActive: true }),
    });
    const partners = Array.isArray(partnersRaw) ? partnersRaw : [];

    const generateMutation = useMutation({
        mutationFn: () => pharmacyAPI.generatePartnerInvoice(generateForm),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'partner-invoices'] });
            setShowGenerate(false);
            setGenerateForm({ partnerId: '', periodStart: '', periodEnd: '', dueDate: '' });
            toast.success('Fatura gerada com sucesso');
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || 'Erro ao gerar fatura'),
    });

    const paymentMutation = useMutation({
        mutationFn: () => pharmacyAPI.registerPartnerPayment(showPayment.id, Number(paymentAmount)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'partner-invoices'] });
            setShowPayment(null); setPaymentAmount('');
            toast.success('Pagamento registado');
        },
        onError: () => toast.error('Erro ao registar pagamento'),
    });

    const invoices = invoicesData?.data || [];
    const totalPending = invoices.filter((i: any) => i.status === 'pending' || i.status === 'partial').reduce((s: number, i: any) => s + (Number(i.totalAmount) - Number(i.paidAmount)), 0);
    const totalOverdue = invoices.filter((i: any) => i.status === 'overdue').reduce((s: number, i: any) => s + Number(i.totalAmount), 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                    {['', 'pending', 'sent', 'partial', 'paid', 'overdue'].map(s => (
                        <Button 
                            key={s} 
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            variant={statusFilter === s ? 'primary' : 'ghost'}
                            size="sm"
                            className={cn(
                                'font-medium transition-colors',
                                statusFilter !== s && 'bg-white dark:bg-dark-800 border border-gray-200 text-gray-600 hover:bg-gray-50'
                            )}
                        >
                            {s === '' ? 'Todas' : STATUS_MAP[s]?.label}
                        </Button>
                    ))}
                </div>
                <Button onClick={() => setShowGenerate(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>Gerar Fatura</Button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
                <Card padding="md" className="text-center">
                    <p className="text-xs text-gray-500 mb-1">A Receber</p>
                    <p className="text-xl font-black text-amber-600">{formatCurrency(totalPending)}</p>
                </Card>
                <Card padding="md" className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Vencidas</p>
                    <p className="text-xl font-black text-red-600">{formatCurrency(totalOverdue)}</p>
                </Card>
                <Card padding="md" className="text-center">
                    <p className="text-xs text-gray-500 mb-1">Total Faturas</p>
                    <p className="text-xl font-black">{invoicesData?.pagination?.total || 0}</p>
                </Card>
            </div>

            {showGenerate && (
                <Card padding="md" className="border-2 border-primary-200 dark:border-primary-800">
                    <h3 className="font-bold mb-4">Gerar Fatura para Seguradora</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="col-span-2 md:col-span-1">
                            <Select
                                label="Parceiro *"
                                value={generateForm.partnerId}
                                onChange={e => setGenerateForm(f => ({ ...f, partnerId: e.target.value }))}
                                options={[
                                    { value: '', label: 'Seleccionar...' },
                                    ...partners.map((p: any) => ({
                                        value: p.id,
                                        label: `${p.name} (${p.coveragePercentage}%)`
                                    }))
                                ]}
                            />
                        </div>
                        <Input label="Período de Início" type="date" value={generateForm.periodStart} onChange={e => setGenerateForm(f => ({ ...f, periodStart: e.target.value }))} />
                        <Input label="Período de Fim" type="date" value={generateForm.periodEnd} onChange={e => setGenerateForm(f => ({ ...f, periodEnd: e.target.value }))} />
                        <Input label="Vencimento" type="date" value={generateForm.dueDate} onChange={e => setGenerateForm(f => ({ ...f, dueDate: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => generateMutation.mutate()} isLoading={generateMutation.isPending}>Gerar Fatura</Button>
                        <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancelar</Button>
                    </div>
                </Card>
            )}

            <Card padding="none">
                {isLoading ? <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-dark-700 border-b dark:border-dark-600">
                                <tr>
                                    {['Fatura', 'Parceiro', 'Período', 'Total', 'Pago', 'Em Falta', 'Vencimento', 'Estado', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-dark-700">
                                {invoices.length === 0 ? (
                                    <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Nenhuma fatura encontrada</td></tr>
                                ) : invoices.map((inv: any) => {
                                    const remaining = Number(inv.totalAmount) - Number(inv.paidAmount);
                                    return (
                                        <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-dark-700">
                                            <td className="px-4 py-3 font-mono text-xs font-bold">{inv.invoiceNumber}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <HiOutlineBuildingOffice className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                    <span className="font-medium">{inv.partner?.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500">{formatDate(inv.periodStart)} a {formatDate(inv.periodEnd)}</td>
                                            <td className="px-4 py-3 font-semibold">{formatCurrency(Number(inv.totalAmount))}</td>
                                            <td className="px-4 py-3 text-green-600">{formatCurrency(Number(inv.paidAmount))}</td>
                                            <td className="px-4 py-3 font-bold text-amber-600">{formatCurrency(remaining)}</td>
                                            <td className="px-4 py-3 text-xs">{inv.dueDate ? formatDate(inv.dueDate) : ''}</td>
                                            <td className="px-4 py-3">
                                                <Badge variant={STATUS_MAP[inv.status]?.variant || 'default'}>{STATUS_MAP[inv.status]?.label}</Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                                    <Button size="sm" variant="outline" onClick={() => { setShowPayment(inv); setPaymentAmount(remaining.toFixed(2)); }}>
                                                        Pagar
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                {invoicesData?.pagination?.total > 0 && (
                    <div className="px-4 pb-2">
                        <Pagination currentPage={page} totalItems={invoicesData.pagination.total} itemsPerPage={20} onPageChange={setPage} />
                    </div>
                )}
            </Card>

            {showPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <Card className="w-full max-w-md p-6">
                        <h3 className="font-bold text-lg mb-1">Registar Pagamento</h3>
                        <p className="text-sm text-gray-500 mb-4">{showPayment.partner?.name} a {showPayment.invoiceNumber}</p>
                        <div className="flex justify-between text-sm mb-4 p-3 bg-gray-50 dark:bg-dark-700 rounded-lg">
                            <span>Total:</span><span className="font-bold">{formatCurrency(Number(showPayment.totalAmount))}</span>
                        </div>
                        <Input label="Valor (MT)" type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} min={0} className="mb-4" />
                        <div className="flex gap-2">
                            <Button onClick={() => paymentMutation.mutate()} isLoading={paymentMutation.isPending} leftIcon={<HiOutlineCheck className="w-4 h-4" />}>Confirmar</Button>
                            <Button variant="outline" onClick={() => setShowPayment(null)}>Cancelar</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
