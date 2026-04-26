import React, { useState, useMemo } from 'react';
import {
    HiOutlineDocumentCheck,
    HiOutlineExclamationTriangle,
    HiOutlineMagnifyingGlass,
    HiOutlineArrowPath,
    HiOutlineEye,
    HiOutlineCloudArrowUp,
    HiOutlineShieldCheck,
    HiOutlineExclamationCircle,
    HiOutlineXMark,
    HiOutlineCheckCircle,
    HiOutlinePencilSquare,
    HiOutlineIdentification,
    HiOutlineClipboardDocumentList,
} from 'react-icons/hi2';
import { Card, Button, Input, Badge, Select, LoadingSpinner, Modal } from '../../ui';
import { useEmployees } from '../../../hooks/useData';
import { cn } from '../../../utils/helpers';
import { isBefore, addDays, format } from 'date-fns';
import toast from 'react-hot-toast';
import type { Employee } from '../../../types';

// ──-Types ──────────────────────────────────────────────────────────────────-

type ComplianceStatus = 'valid' | 'expiring' | 'expired' | 'missing';

interface ComplianceDoc {
    number?: string;
    expiry?: string;
    issueDate?: string;
    institution?: string;
}

interface EmployeeCompliance {
    carteiraProfissional?: ComplianceDoc;
    atestadoMedico?: ComplianceDoc;
    registoCriminal?: ComplianceDoc;
    alvara?: ComplianceDoc;
}

// ──-Helpers ────────────────────────────────────────────────────────────────-

function parseCompliance(notes: string | undefined): EmployeeCompliance {
    if (!notes) return {};
    try {
        const parsed = JSON.parse(notes);
        return parsed?.compliance ?? {};
    } catch {
        return {};
    }
}

function serializeCompliance(notes: string | undefined, compliance: EmployeeCompliance): string {
    let existing: Record<string, unknown> = {};
    try {
        existing = notes ? JSON.parse(notes) : {};
    } catch {
        existing = {};
    }
    return JSON.stringify({ ...existing, compliance });
}

function getDocStatus(expiry?: string): ComplianceStatus {
    if (!expiry) return 'missing';
    const exp = new Date(expiry);
    const today = new Date();
    if (isBefore(exp, today)) return 'expired';
    if (isBefore(exp, addDays(today, 30))) return 'expiring';
    return 'valid';
}

function getComplianceStatus(employee: any): ComplianceStatus {
    if (!employee.contractExpiry) return 'missing';
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

const STATUS_COLORS: Record<ComplianceStatus, string> = {
    valid: 'text-green-600',
    expiring: 'text-amber-600',
    expired: 'text-red-500',
    missing: 'text-gray-400',
};

// ──-Documents View Modal ────────────────────────────────────────────────────-

interface DocumentsModalProps {
    employee: Employee;
    isOpen: boolean;
    onClose: () => void;
    onEdit: () => void;
}

const DocumentsModal: React.FC<DocumentsModalProps> = ({ employee, isOpen, onClose, onEdit }) => {
    const compliance = parseCompliance(employee?.notes);

    const docs = [
        {
            label: 'Bilhete de Identidade',
            icon: HiOutlineIdentification,
            value: employee?.documentNumber,
            expiry: undefined,
            type: 'static' as const,
        },
        {
            label: 'NUIT Pessoal',
            icon: HiOutlineDocumentCheck,
            value: employee?.nuit,
            expiry: undefined,
            type: 'static' as const,
        },
        {
            label: 'Número INSS',
            icon: HiOutlineShieldCheck,
            value: employee?.socialSecurityNumber,
            expiry: undefined,
            type: 'static' as const,
        },
        {
            label: 'Contrato de Trabalho',
            icon: HiOutlineClipboardDocumentList,
            value: employee?.contractType === 'indefinite' ? 'Sem prazo' : employee?.contractType === 'fixed_term' ? 'Prazo certo' : undefined,
            expiry: employee?.contractExpiry,
            type: 'expiry' as const,
        },
        {
            label: 'Carteira Profissional',
            icon: HiOutlineDocumentCheck,
            value: compliance.carteiraProfissional?.number,
            expiry: compliance.carteiraProfissional?.expiry,
            institution: compliance.carteiraProfissional?.institution,
            type: 'expiry' as const,
        },
        {
            label: 'Atestado Médico',
            icon: HiOutlineDocumentCheck,
            value: compliance.atestadoMedico?.number,
            expiry: compliance.atestadoMedico?.expiry,
            type: 'expiry' as const,
        },
        {
            label: 'Registo Criminal',
            icon: HiOutlineDocumentCheck,
            value: compliance.registoCriminal?.number,
            expiry: compliance.registoCriminal?.issueDate
                ? `Emitido: ${format(new Date(compliance.registoCriminal.issueDate), 'dd/MM/yyyy')}`
                : undefined,
            expiry_raw: compliance.registoCriminal?.expiry,
            type: 'expiry' as const,
        },
        {
            label: 'Alvar / Licença',
            icon: HiOutlineShieldCheck,
            value: compliance.alvara?.number,
            expiry: compliance.alvara?.expiry,
            institution: compliance.alvara?.institution,
            type: 'expiry' as const,
        },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Documentos - ${employee?.name}`} size="lg">
            <div className="space-y-3">
                {docs.map((doc, idx) => {
                    const status: ComplianceStatus =
                        doc.type === 'expiry'
                            ? doc.expiry
                                ? getDocStatus(doc.expiry)
                                : doc.value
                                ? 'valid'
                                : 'missing'
                            : doc.value
                            ? 'valid'
                            : 'missing';

                    return (
                        <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-dark-800/50 border border-gray-100 dark:border-dark-700"
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={cn(
                                        'p-2 rounded-lg',
                                        status === 'valid'
                                            ? 'bg-green-50 dark:bg-green-900/20 text-green-600'
                                            : status === 'expiring'
                                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                                            : status === 'expired'
                                            ? 'bg-red-50 dark:bg-red-900/20 text-red-500'
                                            : 'bg-gray-100 dark:bg-dark-700 text-gray-400'
                                    )}
                                >
                                    {status === 'valid' ? (
                                        <HiOutlineCheckCircle className="w-4 h-4" />
                                    ) : status === 'missing' ? (
                                        <HiOutlineXMark className="w-4 h-4" />
                                    ) : (
                                        <HiOutlineExclamationTriangle className="w-4 h-4" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                                        {doc.label}
                                    </p>
                                    {doc.value && (
                                        <p className="text-[10px] font-mono text-gray-500 mt-0.5">
                                            {doc.value}
                                            {(doc as any).institution && ` • ${(doc as any).institution}`}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right space-y-1">
                                <Badge variant={STATUS_BADGE[status]} size="sm" className="font-black text-[9px]">
                                    {STATUS_LABELS[status]}
                                </Badge>
                                {doc.expiry != null && (
                                    <p className={cn('text-[10px] font-mono block', STATUS_COLORS[status])}>
                                        {doc.type === 'expiry'
                                            ? `Expira: ${format(new Date(doc.expiry as string), 'dd/MM/yyyy')}`
                                            : String((doc as any).expiry)}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}

                <div className="flex justify-between gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                    <Button
                        variant="primary"
                        size="sm"
                        className="rounded-lg font-black text-[10px] uppercase tracking-widest"
                        leftIcon={<HiOutlinePencilSquare className="w-4 h-4" />}
                        onClick={() => { onClose(); onEdit(); }}
                    >
                        Actualizar Documentos
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onClose} className="rounded-lg font-black text-[10px] uppercase tracking-widest">
                        Fechar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// ──-New / Edit Document Modal ────────────────────────────────────────────────

interface EditDocumentsModalProps {
    employee: Employee;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, data: Partial<Employee>) => Promise<unknown>;
}

const EditDocumentsModal: React.FC<EditDocumentsModalProps> = ({ employee, isOpen, onClose, onSave }) => {
    const compliance = parseCompliance(employee?.notes);

    const [nuit, setNuit] = useState(employee?.nuit ?? '');
    const [inss, setInss] = useState(employee?.socialSecurityNumber ?? '');
    const [contractExpiry, setContractExpiry] = useState(employee?.contractExpiry?.slice(0, 10) ?? '');
    const [contractType, setContractType] = useState(employee?.contractType ?? '');

    const [carteiraNum, setCarteiraNum] = useState(compliance.carteiraProfissional?.number ?? '');
    const [carteiraExpiry, setCarteiraExpiry] = useState(compliance.carteiraProfissional?.expiry?.slice(0, 10) ?? '');
    const [carteiraInst, setCarteiraInst] = useState(compliance.carteiraProfissional?.institution ?? '');

    const [atestadoExpiry, setAtestadoExpiry] = useState(compliance.atestadoMedico?.expiry?.slice(0, 10) ?? '');

    const [registoNum, setRegistoNum] = useState(compliance.registoCriminal?.number ?? '');
    const [registoDate, setRegistoDate] = useState(compliance.registoCriminal?.issueDate?.slice(0, 10) ?? '');

    const [alvaraNum, setAlvaraNum] = useState(compliance.alvara?.number ?? '');
    const [alvaraExpiry, setAlvaraExpiry] = useState(compliance.alvara?.expiry?.slice(0, 10) ?? '');
    const [alvaraInst, setAlvaraInst] = useState(compliance.alvara?.institution ?? '');

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const newCompliance: EmployeeCompliance = {
                carteiraProfissional: carteiraNum || carteiraExpiry
                    ? { number: carteiraNum || undefined, expiry: carteiraExpiry || undefined, institution: carteiraInst || undefined }
                    : undefined,
                atestadoMedico: atestadoExpiry
                    ? { expiry: atestadoExpiry }
                    : undefined,
                registoCriminal: registoNum || registoDate
                    ? { number: registoNum || undefined, issueDate: registoDate || undefined }
                    : undefined,
                alvara: alvaraNum || alvaraExpiry
                    ? { number: alvaraNum || undefined, expiry: alvaraExpiry || undefined, institution: alvaraInst || undefined }
                    : undefined,
            };

            const updatedNotes = serializeCompliance(employee.notes, newCompliance);

            await onSave(employee.id, {
                nuit: nuit || undefined,
                socialSecurityNumber: inss || undefined,
                contractExpiry: contractExpiry || undefined,
                contractType: (contractType as any) || undefined,
                notes: updatedNotes,
            });

            toast.success('Documentos actualizados com sucesso!');
            onClose();
        } catch {
            toast.error('Erro ao guardar documentos');
        } finally {
            setIsSaving(false);
        }
    };

    const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
        <div className="space-y-3">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-primary-600 border-b border-gray-100 dark:border-dark-700 pb-2">
                {title}
            </h5>
            {children}
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Actualizar Documentos - ${employee?.name}`} size="xl">
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                {/* Identificação Fiscal */}
                <Section title="Identificação Fiscal e Segurança Social">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="NUIT Pessoal"
                            placeholder="123456789"
                            value={nuit}
                            onChange={(e) => setNuit(e.target.value)}
                        />
                        <Input
                            label="Número INSS"
                            placeholder="MZ/INSS/..."
                            value={inss}
                            onChange={(e) => setInss(e.target.value)}
                        />
                    </div>
                </Section>

                {/* Contrato */}
                <Section title="Contrato de Trabalho">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            label="Tipo de Contrato"
                            options={[
                                { value: '', label: 'Seleccionar...' },
                                { value: 'indefinite', label: 'Por prazo indeterminado' },
                                { value: 'fixed_term', label: 'A prazo certo' },
                            ]}
                            value={contractType}
                            onChange={(e) => setContractType(e.target.value)}
                        />
                        <Input
                            label="Validade do Contrato"
                            type="date"
                            value={contractExpiry}
                            onChange={(e) => setContractExpiry(e.target.value)}
                        />
                    </div>
                </Section>

                {/* Carteira Profissional */}
                <Section title="Carteira Profissional (Ordem dos Farmacêuticos)">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            label="Número"
                            placeholder="OF-XXXX"
                            value={carteiraNum}
                            onChange={(e) => setCarteiraNum(e.target.value)}
                        />
                        <Input
                            label="Validade"
                            type="date"
                            value={carteiraExpiry}
                            onChange={(e) => setCarteiraExpiry(e.target.value)}
                        />
                        <Input
                            label="Instituição Emissora"
                            placeholder="Ordem dos Farmacêuticos de Moçambique"
                            value={carteiraInst}
                            onChange={(e) => setCarteiraInst(e.target.value)}
                        />
                    </div>
                </Section>

                {/* Atestado Médico */}
                <Section title="Atestado Médico de Aptidão">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Validade do Atestado"
                            type="date"
                            value={atestadoExpiry}
                            onChange={(e) => setAtestadoExpiry(e.target.value)}
                        />
                    </div>
                </Section>

                {/* Registo Criminal */}
                <Section title="Registo Criminal">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Número do Registo"
                            placeholder="RC-XXXX"
                            value={registoNum}
                            onChange={(e) => setRegistoNum(e.target.value)}
                        />
                        <Input
                            label="Data de Emissão"
                            type="date"
                            value={registoDate}
                            onChange={(e) => setRegistoDate(e.target.value)}
                        />
                    </div>
                </Section>

                {/* Alvar */}
                <Section title="Alvar / Licença Operacional">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                            label="Número do Alvará"
                            placeholder="ALV-XXXX"
                            value={alvaraNum}
                            onChange={(e) => setAlvaraNum(e.target.value)}
                        />
                        <Input
                            label="Validade"
                            type="date"
                            value={alvaraExpiry}
                            onChange={(e) => setAlvaraExpiry(e.target.value)}
                        />
                        <Input
                            label="Entidade Emissora"
                            placeholder="MISAU / Município"
                            value={alvaraInst}
                            onChange={(e) => setAlvaraInst(e.target.value)}
                        />
                    </div>
                </Section>
            </div>

            <div className="flex justify-between gap-3 pt-4 border-t border-gray-100 dark:border-dark-700 mt-4">
                <Button
                    variant="primary"
                    className="rounded-lg font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary-500/20"
                    leftIcon={isSaving ? undefined : <HiOutlineCheckCircle className="w-4 h-4" />}
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? 'A guardar"¦' : 'Guardar Documentos'}
                </Button>
                <Button variant="ghost" onClick={onClose} className="rounded-lg font-black text-[10px] uppercase tracking-widest">
                    Cancelar
                </Button>
            </div>
        </Modal>
    );
};

// ──-Main Component ──────────────────────────────────────────────────────────-

export const PharmacyDocumentCenter: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [complianceFilter, setComplianceFilter] = useState<'all' | ComplianceStatus>('all');
    const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
    const [editEmployee, setEditEmployee] = useState<Employee | null>(null);

    const { employees: staff, isLoading, refetch, updateEmployee } = useEmployees({ limit: 200 });

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
                    const compliance = parseCompliance(person.notes);
                    const docsCount = [
                        person.nuit,
                        person.socialSecurityNumber,
                        person.contractExpiry,
                        compliance.carteiraProfissional?.number,
                        compliance.atestadoMedico?.expiry,
                        compliance.registoCriminal?.number || compliance.registoCriminal?.issueDate,
                    ].filter(Boolean).length;

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
                                        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center font-black text-primary-600 italic">
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
                                    {/* Contract Expiry */}
                                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50/50 dark:bg-dark-900/40 border border-transparent hover:border-primary-500/20 hover:bg-white dark:hover:bg-dark-700 transition-all">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-white dark:bg-dark-800 shadow-sm">
                                                <HiOutlineDocumentCheck className="w-3.5 h-3.5 text-primary-500" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase text-gray-500 tracking-tight">Contrato</span>
                                        </div>
                                        <span className={cn('text-[10px] font-mono font-black italic', STATUS_COLORS[status])}>
                                            {person.contractExpiry
                                                ? new Date(person.contractExpiry).toLocaleDateString('pt-MZ')
                                                : 'Não definido'}
                                        </span>
                                    </div>

                                    {/* Days remaining */}
                                    {daysLeft !== null && (
                                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50/50 dark:bg-dark-900/40">
                                            <span className="text-[10px] font-black uppercase text-gray-500 tracking-tight">Dias Restantes</span>
                                            <span className={cn('text-[10px] font-mono font-black', daysLeft < 0 ? 'text-red-500' : daysLeft < 30 ? 'text-amber-600' : 'text-green-600')}>
                                                {daysLeft < 0 ? `Expirado h ${Math.abs(daysLeft)}d` : `${daysLeft} dias`}
                                            </span>
                                        </div>
                                    )}

                                    {/* NUIT */}
                                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50/50 dark:bg-dark-900/40">
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
                                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50/50 dark:bg-dark-900/40">
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

                                    {/* Docs count */}
                                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50/50 dark:bg-dark-900/40">
                                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-tight">Documentos Registados</span>
                                        <span className={cn('text-[10px] font-mono font-black', docsCount >= 4 ? 'text-green-600' : docsCount >= 2 ? 'text-amber-600' : 'text-red-500')}>
                                            {docsCount}/6 documentos
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-dark-700/50">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 text-[10px] font-black uppercase tracking-widest h-9"
                                        leftIcon={<HiOutlineEye className="w-4 h-4" />}
                                        onClick={() => setViewEmployee(person)}
                                    >
                                        Documentos
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 text-[10px] font-black uppercase tracking-widest h-9 text-primary-600"
                                        leftIcon={<HiOutlineCloudArrowUp className="w-4 h-4" />}
                                        onClick={() => setEditEmployee(person)}
                                    >
                                        Novo Doc.
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    );
                })}

                {filteredStaff.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-gray-50 dark:bg-dark-800/20 rounded-lg border border-dashed border-gray-200">
                        <HiOutlineDocumentCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 font-black uppercase text-xs tracking-widest">Nenhum registo de conformidade encontrado</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {viewEmployee && (
                <DocumentsModal
                    employee={viewEmployee}
                    isOpen={!!viewEmployee}
                    onClose={() => setViewEmployee(null)}
                    onEdit={() => setEditEmployee(viewEmployee)}
                />
            )}

            {editEmployee && (
                <EditDocumentsModal
                    employee={editEmployee}
                    isOpen={!!editEmployee}
                    onClose={() => setEditEmployee(null)}
                    onSave={async (id, data) => {
                        await updateEmployee(id, data);
                        refetch();
                    }}
                />
            )}
        </div>
    );
};
