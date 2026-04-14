import React, { useState, useMemo } from 'react';
import {
    HiOutlineDocumentCheck,
    HiOutlineExclamationTriangle,
    HiOutlineMagnifyingGlass,
    HiOutlineArrowPath,
    HiOutlineEye,
    HiOutlineCloudArrowUp,
    HiOutlineShieldCheck,
    HiOutlineExclamationCircle
} from 'react-icons/hi2';
import { Card, Button, Input, Badge, Select, LoadingSpinner } from '../../ui';
import { useEmployees } from '../../../hooks/useData';
import { cn } from '../../../utils/helpers';
import { isBefore, addDays } from 'date-fns';

type ComplianceStatus = 'valid' | 'expiring' | 'expired' | 'missing';

// Derive compliance status from real employee fields only
function getComplianceStatus(employee: any): ComplianceStatus {
    if (!employee.contractExpiry) return 'missing'; // No contract expiry set = requires attention

    const expiry = new Date(employee.contractExpiry);
    const today = new Date();
    const in30Days = addDays(today, 30);

    if (isBefore(expiry, today)) return 'expired';
    if (isBefore(expiry, in30Days)) return 'expiring';
    return 'valid';
}

const STATUS_LABELS: Record<ComplianceStatus, string> = {
    valid: 'REGULAR',
    expiring: 'A EXPIRAR',
    expired: 'IRREGULAR',
    missing: 'SEM DADOS',
};

const STATUS_BADGE: Record<ComplianceStatus, 'success' | 'warning' | 'danger' | 'gray'> = {
    valid: 'success',
    expiring: 'warning',
    expired: 'danger',
    missing: 'gray',
};

export const PharmacyDocumentCenter: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [complianceFilter, setComplianceFilter] = useState<'all' | ComplianceStatus>('all');

    const { employees: staff, isLoading, refetch } = useEmployees({ limit: 200 });

    const stats = useMemo(() => {
        if (!staff) return { valid: 0, expiring: 0, expired: 0, missing: 0 };
        return staff.reduce(
            (acc: Record<ComplianceStatus, number>, s: any) => {
                acc[getComplianceStatus(s)]++;
                return acc;
            },
            { valid: 0, expiring: 0, expired: 0, missing: 0 }
        );
    }, [staff]);

    const filteredStaff = useMemo(() =>
        (staff ?? []).filter(s => {
            const matchesSearch =
                s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.code.toLowerCase().includes(searchTerm.toLowerCase());
            const status = getComplianceStatus(s);
            const matchesCompliance = complianceFilter === 'all' || status === complianceFilter;
            return matchesSearch && matchesCompliance;
        }),
        [staff, searchTerm, complianceFilter]
    );

    if (isLoading) return <LoadingSpinner size="lg" className="h-64" />;

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            {/* Compliance Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card variant="glass" className="p-4 border-l-4 border-l-green-500 bg-green-50/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600">
                            <HiOutlineShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-500">Regularizados</p>
                            <h4 className="text-xl font-black text-green-600">{stats.valid}</h4>
                        </div>
                    </div>
                </Card>
                <Card variant="glass" className="p-4 border-l-4 border-l-amber-500 bg-amber-50/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                            <HiOutlineExclamationTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-500">A Expirar (30d)</p>
                            <h4 className="text-xl font-black text-amber-600">{stats.expiring}</h4>
                        </div>
                    </div>
                </Card>
                <Card variant="glass" className="p-4 border-l-4 border-l-red-500 bg-red-50/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600">
                            <HiOutlineExclamationCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-500">Irregulares</p>
                            <h4 className="text-xl font-black text-red-600">{stats.expired}</h4>
                        </div>
                    </div>
                </Card>
                <Card variant="glass" className="p-4 border-l-4 border-l-gray-400 bg-gray-50/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500">
                            <HiOutlineDocumentCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-500">Sem Dados</p>
                            <h4 className="text-xl font-black text-gray-500">{stats.missing}</h4>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <Card variant="glass" className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <Input
                        placeholder="Procurar colaborador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5 text-gray-400" />}
                        className="h-11 bg-white/50"
                    />
                    <div className="w-full md:w-72">
                        <Select
                            options={[
                                { value: 'all', label: 'Todos os Estados' },
                                { value: 'valid', label: 'Totalmente Regular' },
                                { value: 'expiring', label: 'A Expirar brevemente' },
                                { value: 'expired', label: 'Documentação Irregular' },
                                { value: 'missing', label: 'Sem Dados de Contrato' },
                            ]}
                            value={complianceFilter}
                            onChange={(e) => setComplianceFilter(e.target.value as any)}
                        />
                    </div>
                    <Button
                        variant="ghost"
                        leftIcon={<HiOutlineArrowPath className="w-5 h-5" />}
                        onClick={() => refetch()}
                        className="h-11 font-black text-[10px] uppercase tracking-widest text-gray-500"
                    >
                        Actualizar
                    </Button>
                </div>
            </Card>

            {/* Grid of Compliance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStaff.map((person) => {
                    const status = getComplianceStatus(person);
                    const daysLeft = person.contractExpiry
                        ? Math.ceil((new Date(person.contractExpiry).getTime() - Date.now()) / (1000 * 3600 * 24))
                        : null;

                    return (
                        <Card
                            key={person.id}
                            variant="glass"
                            className={cn(
                                'group overflow-hidden border-t-2 transition-all duration-300 shadow-md hover:shadow-xl',
                                status === 'expired' ? 'border-t-red-500 bg-red-50/5'
                                    : status === 'expiring' ? 'border-t-amber-500 bg-amber-50/5'
                                    : status === 'missing' ? 'border-t-gray-400'
                                    : 'border-t-green-500'
                            )}
                        >
                            <div className="p-5 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center font-black text-primary-600 italic">
                                            {person.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 dark:text-white uppercase text-xs truncate max-w-[120px]">
                                                {person.name}
                                            </h4>
                                            <p className="text-[10px] text-gray-500 font-medium">
                                                {person.department || 'Operacional'} • {person.code}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge variant={STATUS_BADGE[status]} size="sm" className="font-black text-[9px] tracking-tight">
                                        {STATUS_LABELS[status]}
                                    </Badge>
                                </div>

                                <div className="space-y-2 pt-2">
                                    {/* Contract Expiry — real field */}
                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/50 dark:bg-dark-900/40 border border-transparent hover:border-primary-500/20 hover:bg-white dark:hover:bg-dark-700 transition-all">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-white dark:bg-dark-800 shadow-sm">
                                                <HiOutlineDocumentCheck className="w-3.5 h-3.5 text-primary-500" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase text-gray-500 tracking-tight">Contrato</span>
                                        </div>
                                        <span className={cn(
                                            'text-[10px] font-mono font-black italic',
                                            status === 'expired' ? 'text-red-500'
                                                : status === 'expiring' ? 'text-amber-600'
                                                : status === 'missing' ? 'text-gray-400'
                                                : 'text-green-600'
                                        )}>
                                            {person.contractExpiry
                                                ? new Date(person.contractExpiry).toLocaleDateString('pt-MZ')
                                                : 'Não definido'}
                                        </span>
                                    </div>

                                    {/* Days remaining indicator */}
                                    {daysLeft !== null && (
                                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/50 dark:bg-dark-900/40">
                                            <span className="text-[10px] font-black uppercase text-gray-500 tracking-tight">Dias Restantes</span>
                                            <span className={cn(
                                                'text-[10px] font-mono font-black',
                                                daysLeft < 0 ? 'text-red-500' : daysLeft < 30 ? 'text-amber-600' : 'text-green-600'
                                            )}>
                                                {daysLeft < 0 ? `Expirado há ${Math.abs(daysLeft)}d` : `${daysLeft} dias`}
                                            </span>
                                        </div>
                                    )}

                                    {/* NUIT */}
                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/50 dark:bg-dark-900/40 border border-transparent">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-white dark:bg-dark-800 shadow-sm">
                                                <HiOutlineDocumentCheck className="w-3.5 h-3.5 text-primary-500" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase text-gray-500 tracking-tight">NUIT</span>
                                        </div>
                                        <span className={cn('text-[10px] font-mono font-black italic', person.nuit ? 'text-green-600' : 'text-gray-400')}>
                                            {person.nuit || 'Não registado'}
                                        </span>
                                    </div>

                                    {/* INSS */}
                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/50 dark:bg-dark-900/40 border border-transparent">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-white dark:bg-dark-800 shadow-sm">
                                                <HiOutlineDocumentCheck className="w-3.5 h-3.5 text-primary-500" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase text-gray-500 tracking-tight">Nº INSS</span>
                                        </div>
                                        <span className={cn('text-[10px] font-mono font-black italic', person.socialSecurityNumber ? 'text-green-600' : 'text-gray-400')}>
                                            {person.socialSecurityNumber || 'Não registado'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-dark-700/50">
                                    <Button variant="ghost" size="sm" className="flex-1 text-[10px] font-black uppercase tracking-widest h-9" leftIcon={<HiOutlineEye className="w-4 h-4" />}>
                                        Documentos
                                    </Button>
                                    <Button variant="ghost" size="sm" className="flex-1 text-[10px] font-black uppercase tracking-widest h-9 text-primary-600" leftIcon={<HiOutlineCloudArrowUp className="w-4 h-4" />}>
                                        Novo Doc.
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
                {filteredStaff.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-gray-50 dark:bg-dark-800/20 rounded-3xl border border-dashed border-gray-200">
                        <HiOutlineDocumentCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 font-black uppercase text-xs tracking-widest">Nenhum registo de conformidade encontrado</p>
                    </div>
                )}
            </div>
        </div>
    );
};
