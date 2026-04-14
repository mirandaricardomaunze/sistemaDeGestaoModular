import React, { useState, useMemo } from 'react';
import { 
    HiOutlineFolderOpen, 
    HiOutlineMagnifyingGlass, 
    HiOutlineExclamationTriangle,
    HiOutlineShieldCheck,
    HiOutlineIdentification,
    HiOutlineClock,
    HiOutlineEye
} from 'react-icons/hi2';
import { Card, Button, Input, Select, Badge, DataTable, LoadingSpinner } from '../../ui';
import { useDrivers } from '../../../hooks/useLogistics';
import { cn } from '../../../utils/helpers';
import { format, differenceInDays, isPast } from 'date-fns';

export const LogisticsDocumentCenter: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'expired' | 'expiring' | 'valid'>('all');
    
    const { data: staff, isLoading } = useDrivers({ limit: 100 });

    const getDocumentStatus = (expiryDate?: string) => {
        if (!expiryDate) return 'missing';
        const date = new Date(expiryDate);
        if (isPast(date)) return 'expired';
        const days = differenceInDays(date, new Date());
        if (days <= 15) return 'expiring';
        return 'valid';
    };

    const staffWithDocStatus = useMemo(() => {
        if (!staff?.data) return [];
        
        return staff.data.map(person => {
            const licenseStatus = getDocumentStatus(person.licenseExpiry);
            const medicalStatus = getDocumentStatus(person.medicalExamExpiry);
            
            let overallStatus: 'valid' | 'expiring' | 'expired' = 'valid';
            if (licenseStatus === 'expired' || medicalStatus === 'expired') overallStatus = 'expired';
            else if (licenseStatus === 'expiring' || medicalStatus === 'expiring') overallStatus = 'expiring';
            
            return {
                ...person,
                licenseStatus,
                medicalStatus,
                overallStatus
            };
        }).filter(person => {
            const matchesSearch = person.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                person.code.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || person.overallStatus === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [staff, searchTerm, statusFilter]);

    if (isLoading) return <LoadingSpinner size="lg" className="h-64" />;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Controls */}
            <Card variant="glass" className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <Input
                            placeholder="Pesquisar por colaborador..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select
                        options={[
                            { value: 'all', label: 'Todos os Estados' },
                            { value: 'expired', label: 'Documentos Expirados' },
                            { value: 'expiring', label: 'A Expirar (15 dias)' },
                            { value: 'valid', label: 'Documentação em Dia' }
                        ]}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                    />
                    <div className="flex items-center justify-end gap-2">
                        <Badge variant="danger">{staffWithDocStatus.filter(s => s.overallStatus === 'expired').length} Críticos</Badge>
                        <Badge variant="warning">{staffWithDocStatus.filter(s => s.overallStatus === 'expiring').length} Alertas</Badge>
                    </div>
                </div>
            </Card>

            {/* Document Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staffWithDocStatus.map((person) => (
                    <Card key={person.id} variant="glass" className={cn(
                        "relative group transition-all border-t-4",
                        person.overallStatus === 'expired' ? "border-t-red-500" : 
                        person.overallStatus === 'expiring' ? "border-t-orange-500" : "border-t-green-500"
                    )}>
                        <div className="p-5 space-y-5">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-dark-700 flex items-center justify-center">
                                        <HiOutlineIdentification className="w-6 h-6 text-gray-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-sm truncate">{person.name}</h4>
                                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{person.category}</p>
                                    </div>
                                </div>
                                <Badge variant={person.overallStatus === 'valid' ? 'success' : person.overallStatus === 'expiring' ? 'warning' : 'danger'}>
                                    {person.overallStatus.toUpperCase()}
                                </Badge>
                            </div>

                            <div className="space-y-3">
                                <DocumentRow 
                                    label="Carta de Condução"
                                    date={person.licenseExpiry}
                                    status={person.licenseStatus as any}
                                />
                                <DocumentRow 
                                    label="Exame Médico"
                                    date={person.medicalExamExpiry}
                                    status={person.medicalStatus as any}
                                />
                                <DocumentRow 
                                    label="Treino de Segurança"
                                    date={person.safetyTrainingDate}
                                    status="valid" // Just for visual consistency
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" size="sm" className="flex-1 text-xs" leftIcon={<HiOutlineEye />}>
                                    Ver Detalhes
                                </Button>
                                <Button variant="ghost" size="sm" className="text-primary-500">
                                    Actualizar
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

function DocumentRow({ label, date, status }: { label: string, date?: string, status: 'valid' | 'expiring' | 'expired' | 'missing' }) {
    const colors = {
        valid: 'text-green-500 bg-green-500/10',
        expiring: 'text-orange-500 bg-orange-500/10',
        expired: 'text-red-500 bg-red-500/10',
        missing: 'text-gray-400 bg-gray-100 dark:bg-dark-700'
    };

    return (
        <div className="flex items-center justify-between p-2 rounded-xl border border-gray-50 dark:border-dark-700/50">
            <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-lg", colors[status])}>
                    {status === 'valid' ? <HiOutlineShieldCheck className="w-4 h-4" /> : 
                     status === 'expired' ? <HiOutlineExclamationTriangle className="w-4 h-4" /> :
                     <HiOutlineClock className="w-4 h-4" />}
                </div>
                <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{label}</span>
            </div>
            <span className={cn("text-[10px] font-mono font-bold", status === 'expired' ? "text-red-500" : "text-gray-500")}>
                {date ? format(new Date(date), "dd/MM/yyyy") : 'N/D'}
            </span>
        </div>
    );
}
