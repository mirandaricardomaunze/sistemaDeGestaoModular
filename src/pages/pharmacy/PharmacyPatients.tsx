import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, Badge, LoadingSpinner, Pagination, Textarea } from '../../components/ui';
import {
    HiOutlineUser, HiOutlineMagnifyingGlass, HiOutlineHeart, HiOutlineClipboardDocumentList,
    HiOutlinePencil, HiOutlineXMark as HiOutlineX, HiOutlineCheck, HiOutlinePhone
} from 'react-icons/hi2';
import { pharmacyAPI } from '../../services/api';
import { useCustomers } from '../../hooks/useData';
import toast from 'react-hot-toast';
import { formatDate, formatCurrency, cn } from '../../utils/helpers';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const COMMON_ALLERGIES = ['Penicilina', 'Amoxicilina', 'Aspirina', 'Ibuprofeno', 'Sulfonamidas', 'Látex', 'Contraste iodado', 'Morfina'];
const COMMON_CONDITIONS = ['Hipertensão', 'Diabetes Tipo 2', 'Diabetes Tipo 1', 'Asma', 'DPOC', 'Insuficiência Cardíaca', 'IRC', 'Epilepsia', 'Hipotiroidismo', 'Hipertiroidismo'];

export default function PharmacyPatients() {
    const queryClient = useQueryClient();
    const { customers, isLoading: loadingCustomers } = useCustomers();
    const [search, setSearch] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [editMode, setEditMode] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
    const [profileForm, setProfileForm] = useState<any>({});
    const [historyPage, setHistoryPage] = useState(1);
    const [allergyInput, setAllergyInput] = useState('');
    const [conditionInput, setConditionInput] = useState('');

    const filtered = (customers || []).filter((c: any) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) ||
        c.code?.toLowerCase().includes(search.toLowerCase())
    );

    const { data: profile, isLoading: loadingProfile } = useQuery({
        queryKey: ['pharmacy', 'patient-profile', selectedPatient?.id],
        queryFn: () => pharmacyAPI.getPatientProfile(selectedPatient.id),
        enabled: !!selectedPatient?.id
    });

    const { data: historyData, isLoading: loadingHistory } = useQuery({
        queryKey: ['pharmacy', 'patient-history', selectedPatient?.id, historyPage],
        queryFn: () => pharmacyAPI.getPatientMedicationHistory(selectedPatient.id, { page: historyPage, limit: 10 }),
        enabled: !!selectedPatient?.id && activeTab === 'history'
    });

    const updateMutation = useMutation({
        mutationFn: () => pharmacyAPI.updatePatientProfile(selectedPatient.id, profileForm),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pharmacy', 'patient-profile', selectedPatient.id] });
            setEditMode(false);
            toast.success('Perfil actualizado com sucesso');
        },
        onError: () => toast.error('Erro ao actualizar perfil')
    });

    const startEdit = () => {
        setProfileForm({
            bloodType: profile?.bloodType || '',
            allergies: [...(profile?.allergies || [])],
            chronicConditions: [...(profile?.chronicConditions || [])],
            emergencyContact: profile?.emergencyContact || '',
            patientNotes: profile?.patientNotes || ''
        });
        setEditMode(true);
    };

    const addAllergy = (val: string) => {
        const v = val.trim();
        if (v && !profileForm.allergies.includes(v)) {
            setProfileForm((f: any) => ({ ...f, allergies: [...f.allergies, v] }));
        }
        setAllergyInput('');
    };

    const addCondition = (val: string) => {
        const v = val.trim();
        if (v && !profileForm.chronicConditions.includes(v)) {
            setProfileForm((f: any) => ({ ...f, chronicConditions: [...f.chronicConditions, v] }));
        }
        setConditionInput('');
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pacientes</h1>
                <p className="text-gray-500 dark:text-gray-400">Perfis clínicos, alergias e histórico de medicação</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Patient List */}
                <Card padding="md">
                    <Input
                        placeholder="Pesquisar paciente..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        leftIcon={<HiOutlineMagnifyingGlass className="w-4 h-4 text-gray-400" />}
                        className="mb-4"
                    />
                    {loadingCustomers ? <LoadingSpinner /> : (
                        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                            {filtered.map((c: any) => (
                                <button
                                    key={c.id}
                                    onClick={() => { setSelectedPatient(c); setEditMode(false); setActiveTab('profile'); }}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl border-2 transition-all duration-300 relative overflow-hidden group",
                                        selectedPatient?.id === c.id 
                                            ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/10 shadow-lg shadow-emerald-500/10" 
                                            : "border-gray-100 dark:border-dark-700 hover:border-emerald-200 dark:hover:border-emerald-900/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/5"
                                    )}
                                >
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110",
                                            selectedPatient?.id === c.id 
                                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                                                : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                        )}>
                                            <HiOutlineUser className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={cn(
                                                "font-black text-sm truncate tracking-tight",
                                                selectedPatient?.id === c.id ? "text-emerald-900 dark:text-emerald-100" : "text-gray-900 dark:text-white"
                                            )}>{c.name}</p>
                                            <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1 uppercase tracking-wider">
                                                <HiOutlinePhone className="w-3.5 h-3.5" /> {c.phone || ''}
                                            </p>
                                        </div>
                                    </div>
                                    {selectedPatient?.id === c.id && (
                                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500" />
                                    )}
                                </button>
                            ))}
                            {filtered.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">Nenhum paciente encontrado</p>}
                        </div>
                    )}
                </Card>

                {/* Patient Detail */}
                <div className="lg:col-span-2">
                    {!selectedPatient ? (
                        <Card padding="md" className="flex items-center justify-center h-64">
                            <div className="text-center text-gray-400">
                                <HiOutlineUser className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                <p>Seleccione um paciente para ver o perfil</p>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <Button
                                    variant={activeTab === 'profile' ? 'primary' : 'outline'}
                                    onClick={() => setActiveTab('profile')}
                                    size="sm"
                                    className={cn("rounded-lg font-medium transition-colors", activeTab === 'profile' ? "shadow-lg shadow-teal-500/20" : "")}
                                    leftIcon={<HiOutlineHeart className="w-4 h-4" />}
                                >
                                    Perfil Clínico
                                </Button>
                                <Button
                                    variant={activeTab === 'history' ? 'primary' : 'outline'}
                                    onClick={() => setActiveTab('history')}
                                    size="sm"
                                    className={cn("rounded-lg font-medium transition-colors", activeTab === 'history' ? "shadow-lg shadow-teal-500/20" : "")}
                                    leftIcon={<HiOutlineClipboardDocumentList className="w-4 h-4" />}
                                >
                                    Historial de Medicação
                                </Button>
                            </div>

                            {activeTab === 'profile' && (
                                <Card padding="md">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h2 className="text-lg font-bold">{selectedPatient.name}</h2>
                                            <p className="text-sm text-gray-500">{selectedPatient.phone}</p>
                                        </div>
                                        {!editMode ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={startEdit}
                                                className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all border border-indigo-100/50 dark:border-indigo-500/20 shadow-sm font-black text-[10px] uppercase tracking-widest"
                                                leftIcon={<HiOutlinePencil className="w-4 h-4" />}
                                            >
                                                Editar
                                            </Button>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => updateMutation.mutate()}
                                                    isLoading={updateMutation.isPending}
                                                    className="p-2 px-4 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 font-black text-[10px] uppercase tracking-widest"
                                                    leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                                                >
                                                    Guardar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditMode(false)}
                                                    className="p-2 rounded-lg bg-red-50/50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all border border-red-100/50 dark:border-red-500/20 shadow-sm font-black text-[10px] uppercase tracking-widest"
                                                    leftIcon={<HiOutlineX className="w-4 h-4" />}
                                                >
                                                    Cancelar
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    {loadingProfile ? <LoadingSpinner /> : (
                                        <div className="space-y-6">
                                            {/* Blood Type */}
                                            <div>
                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Grupo Sanguíneo</p>
                                                {editMode ? (
                                                    <div className="flex gap-2 flex-wrap">
                                                        {BLOOD_TYPES.map(bt => (
                                                            <Button
                                                                key={bt}
                                                                variant={profileForm.bloodType === bt ? 'danger' : 'outline'}
                                                                onClick={() => setProfileForm((f: any) => ({ ...f, bloodType: bt }))}
                                                                size="sm"
                                                                className="rounded-lg font-semibold"
                                                            >
                                                                {bt}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <Badge variant={profile?.bloodType ? 'danger' : 'gray'} className="text-base px-3 py-1 font-bold">
                                                        {profile?.bloodType || 'Não definido'}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Allergies */}
                                            <div>
                                                <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">⚠️ Alergias Conhecidas</p>
                                                {editMode ? (
                                                    <div className="space-y-2">
                                                        <div className="flex flex-wrap gap-2 mb-2">
                                                            {COMMON_ALLERGIES.map(a => (
                                                                <Button
                                                                    key={a}
                                                                    variant={profileForm.allergies.includes(a) ? 'danger' : 'outline'}
                                                                    onClick={() => addAllergy(a)}
                                                                    size="xs"
                                                                    className="rounded"
                                                                >
                                                                    {a}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Input placeholder="Outra alergia..." value={allergyInput} onChange={e => setAllergyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAllergy(allergyInput)} className="flex-1" />
                                                            <Button size="sm" onClick={() => addAllergy(allergyInput)}>Adicionar</Button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {profileForm.allergies.map((a: string) => (
                                                                <span key={a} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                                                                    {a}
                                                                    <button onClick={() => setProfileForm((f: any) => ({ ...f, allergies: f.allergies.filter((x: string) => x !== a) }))}><HiOutlineX className="w-3 h-3" /></button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        {(profile?.allergies || []).length === 0 ? <span className="text-gray-400 text-sm">Nenhuma alergia registada</span> :
                                                            profile.allergies.map((a: string) => <Badge key={a} variant="danger" className="text-sm">{a}</Badge>)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Chronic Conditions */}
                                            <div>
                                                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">Condições Crónicas</p>
                                                {editMode ? (
                                                    <div className="space-y-2">
                                                        <div className="flex flex-wrap gap-2 mb-2">
                                                            {COMMON_CONDITIONS.map(c => (
                                                                <Button
                                                                    key={c}
                                                                    variant={profileForm.chronicConditions.includes(c) ? 'warning' : 'outline'}
                                                                    onClick={() => addCondition(c)}
                                                                    size="xs"
                                                                    className="rounded"
                                                                >
                                                                    {c}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Input placeholder="Outra condição..." value={conditionInput} onChange={e => setConditionInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCondition(conditionInput)} className="flex-1" />
                                                            <Button size="sm" onClick={() => addCondition(conditionInput)}>Adicionar</Button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 mt-2">
                                                            {profileForm.chronicConditions.map((c: string) => (
                                                                <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                                                                    {c}
                                                                    <button onClick={() => setProfileForm((f: any) => ({ ...f, chronicConditions: f.chronicConditions.filter((x: string) => x !== c) }))}><HiOutlineX className="w-3 h-3" /></button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        {(profile?.chronicConditions || []).length === 0 ? <span className="text-gray-400 text-sm">Nenhuma condição registada</span> :
                                                            profile.chronicConditions.map((c: string) => <Badge key={c} variant="warning" className="text-sm">{c}</Badge>)}
                                                    </div>
                                                )}
                                            {/* Note: the div and condition end below after emergency contact */}

                                            {/* Emergency Contact & Notes */}
                                            {editMode ? (
                                                <div className="grid grid-cols-1 gap-4">
                                                    <Input label="Contacto de Emergência" value={profileForm.emergencyContact} onChange={e => setProfileForm((f: any) => ({ ...f, emergencyContact: e.target.value }))} placeholder="Nome e telefone..." />
                                                    <div>
                                                        <Textarea 
                                                            label="Observações Clínicas"
                                                            rows={3}
                                                            value={profileForm.patientNotes}
                                                            onChange={e => setProfileForm((f: any) => ({ ...f, patientNotes: e.target.value }))}
                                                            placeholder="Notas sobre o paciente..."
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Contacto de Emergência</p>
                                                        <p className="text-sm font-medium">{profile?.emergencyContact || ''}</p>
                                                    </div>
                                                    {profile?.patientNotes && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Observações</p>
                                                            <p className="text-sm">{profile.patientNotes}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    )}
                                </Card>
                            )}

                            {activeTab === 'history' && (
                                <Card padding="md">
                                    <h3 className="font-bold mb-4">Historial Completo de Medicação</h3>
                                    {loadingHistory ? <LoadingSpinner /> : (
                                        <div className="space-y-3">
                                            {(historyData?.data || []).length === 0 ? (
                                                <p className="text-center text-gray-400 py-8">Nenhuma compra registada</p>
                                            ) : (
                                                historyData.data.map((sale: any) => (
                                                    <div key={sale.id} className="border border-gray-200 dark:border-dark-700 rounded-lg p-4">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div>
                                                                <p className="font-semibold text-sm">{sale.saleNumber} - {formatDate(sale.createdAt)}</p>
                                                                {sale.prescription && (
                                                                    <p className="text-xs text-blue-600">
                                                        <strong>Receita:</strong>{' '}
                                                        {sale.prescription.prescriptionNumber || sale.prescription.prescriptionNo || ''} - Dr. {sale.prescription.prescriberName ?? ''}
                                                    </p>
                                                                )}
                                                            </div>
                                                            <span className="font-bold text-teal-600">{formatCurrency(Number(sale.total))}</span>
                                                        </div>
                                                        <div className="space-y-1">
                                                            {sale.items.map((item: any) => (
                                                                <div key={item.id} className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                                                    <span>{item.quantity}x {item.productName}</span>
                                                                    <span>{formatCurrency(Number(item.unitPrice))}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                            {historyData && historyData.pagination.total > 0 && (
                                                <Pagination
                                                    currentPage={historyPage}
                                                    totalItems={historyData.pagination.total}
                                                    itemsPerPage={10}
                                                    onPageChange={setHistoryPage}
                                                    showItemsPerPage={false}
                                                    className="mt-4"
                                                />
                                            )}
                                        </div>
                                    )}
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
