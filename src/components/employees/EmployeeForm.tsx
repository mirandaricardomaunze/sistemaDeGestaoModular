import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineAcademicCap, HiOutlineCreditCard, HiOutlineDocumentText, HiOutlineUser, HiOutlineBriefcase } from 'react-icons/hi2';
import { useEmployees } from '../../hooks/useData';
import { Button, Modal, Input, Select, Card } from '../ui';
import { roleLabels } from '../../utils/constants';
import type { Employee, EmployeeRole, AcademicQualification } from '../../types';
import toast from 'react-hot-toast';

// Esquema para Qualificações Acadêmicas
const qualificationSchema = z.object({
    id: z.string().optional(),
    level: z.string().min(1, 'Nível é obrigatório'),
    courseName: z.string().min(1, 'Curso é obrigatório'),
    institution: z.string().min(1, 'Instituição é obrigatória'),
    startYear: z.coerce.number().min(1900, 'Ano inválido'),
    endYear: z.coerce.number().optional().or(z.literal('')),
    isCompleted: z.boolean().default(false),
    certificateNumber: z.string().optional(),
});

// Validation Schema
const employeeSchema = z.object({
    code: z.string().min(1, 'Código é obrigatório'),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    phone: z.string().min(9, 'Telefone inválido'),
    role: z.string().min(1, 'Cargo é obrigatório'),
    department: z.string().min(1, 'Departamento é obrigatório'),
    hireDate: z.string().min(1, 'Data de admissão é obrigatória'),
    baseSalary: z.coerce.number().min(0, 'Salário não pode ser negativo'),
    address: z.string().optional(),
    documentNumber: z.string().optional(), // BI
    emergencyContact: z.string().optional(),
    // Contract
    socialSecurityNumber: z.string().length(9, 'INSS deve ter 9 dígitos').regex(/^\d+$/, 'Apenas números').optional().or(z.literal('')),
    nuit: z.string().length(9, 'NUIT deve ter 9 dígitos').regex(/^\d+$/, 'Apenas números').optional().or(z.literal('')),
    subsidyTransport: z.coerce.number().optional(),
    subsidyFood: z.coerce.number().optional(),
    // Bank (Flattened to match backend)
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankNib: z.string().optional(),
    qualifications: z.array(qualificationSchema).optional(),
    skills: z.array(z.string()).optional().default([]),
    // Personal
    birthDate: z.string().optional(),
    // Contract type
    contractType: z.string().optional(),
    contractExpiry: z.string().optional(),
    // Performance & Hierarchy
    commissionRate: z.coerce.number().optional().default(0),
    reportsToId: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface EmployeeFormProps {
    isOpen: boolean;
    onClose: () => void;
    employee?: Employee | null;
}

const educationLevelOptions = [
    { value: 'ensino_fundamental', label: 'Ensino Fundamental' },
    { value: 'ensino_medio', label: 'Ensino Médio' },
    { value: 'tecnico', label: 'Técnico' },
    { value: 'graduacao', label: 'Graduação' },
    { value: 'pos_graduacao', label: 'Pós-Graduação' },
    { value: 'mestrado', label: 'Mestrado' },
    { value: 'doutorado', label: 'Doutorado' },
];

/* ── Section Header ── */
function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
    return (
        <div className="flex items-center gap-2.5 pt-2 pb-1">
            <div className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20">
                <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                {title}
            </h3>
            <div className="flex-1 h-px bg-gradient-to-r from-gray-200 dark:from-dark-600 to-transparent" />
        </div>
    );
}

export default function EmployeeForm({ isOpen, onClose, employee }: EmployeeFormProps) {
    const { addEmployee, updateEmployee } = useEmployees();
    const isEditing = !!employee;

    const {
        register,
        handleSubmit,
        reset,
        control,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<EmployeeFormData>({
        resolver: zodResolver(employeeSchema) as never,
        defaultValues: {
            code: '', name: '', email: '', phone: '',
            role: 'operator', department: '', hireDate: '',
            baseSalary: 0, address: '', documentNumber: '',
            emergencyContact: '', socialSecurityNumber: '',
            nuit: '', subsidyTransport: 0, subsidyFood: 0,
            bankName: '', bankAccountNumber: '', bankNib: '',
            qualifications: [],
            skills: [],
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'qualifications' });

    // Reset form when employee changes
    useEffect(() => {
        if (employee) {
            reset({
                code: employee.code,
                name: employee.name,
                email: employee.email,
                phone: employee.phone,
                role: employee.role,
                department: employee.department || '',
                hireDate: employee.hireDate?.split('T')[0] || '',
                baseSalary: employee.baseSalary ?? employee.salary ?? 0,
                address: employee.address || '',
                documentNumber: employee.documentNumber || '',
                emergencyContact: employee.emergencyContact || '',
                qualifications: employee.qualifications || [],
                socialSecurityNumber: employee.socialSecurityNumber || '',
                nuit: employee.nuit || '',
                subsidyTransport: employee.subsidyTransport || 0,
                subsidyFood: employee.subsidyFood || 0,
                bankName: employee.bankName || '',
                bankAccountNumber: employee.bankAccountNumber || '',
                bankNib: employee.bankNib || '',
                birthDate: employee.birthDate?.split('T')[0] || '',
                contractType: employee.contractType || 'indefinite',
                contractExpiry: employee.contractExpiry?.split('T')[0] || '',
                commissionRate: employee.commissionRate || 0,
                reportsToId: employee.reportsToId || '',
                skills: employee.skills || [],
            });
        } else {
            reset({
                code: `EMP-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
                name: '', email: '', phone: '',
                role: 'operator', department: '',
                hireDate: new Date().toISOString().split('T')[0],
                baseSalary: 0, address: '', documentNumber: '',
                emergencyContact: '', qualifications: [],
                birthDate: '', contractType: 'indefinite',
                contractExpiry: '', commissionRate: 0,
                reportsToId: '', bankName: '',
                bankAccountNumber: '', bankNib: '',
                socialSecurityNumber: '', nuit: '',
                subsidyTransport: 0, subsidyFood: 0,
                skills: [],
            });
        }
    }, [employee, reset]);

    const addQualification = () => {
        append({
            level: 'graduacao', courseName: '', institution: '',
            startYear: new Date().getFullYear() - 4,
            endYear: undefined, isCompleted: false, certificateNumber: '',
        });
    };

    const onSubmit = async (data: EmployeeFormData) => {
        try {
            const qualifications = data.qualifications?.map((q) => ({
                ...q,
                endYear: q.endYear ? Number(q.endYear) : undefined,
                certificateNumber: q.certificateNumber || undefined,
            })) as AcademicQualification[] | undefined;

            const payload = {
                ...data,
                role: data.role as EmployeeRole,
                hireDate: data.hireDate,
                baseSalary: Number(data.baseSalary) || 0,
                subsidyTransport: Number(data.subsidyTransport) || 0,
                subsidyFood: Number(data.subsidyFood) || 0,
                commissionRate: Number(data.commissionRate) || 0,
                qualifications,
                isActive: true,
                department: data.department || undefined,
                birthDate: data.birthDate || undefined,
                contractExpiry: data.contractExpiry || undefined,
                reportsToId: data.reportsToId || undefined,
                address: data.address || undefined,
                documentNumber: data.documentNumber || undefined,
                emergencyContact: data.emergencyContact || undefined,
                socialSecurityNumber: data.socialSecurityNumber || undefined,
                nuit: data.nuit || undefined,
                bankName: data.bankName || undefined,
                bankAccountNumber: data.bankAccountNumber || undefined,
                bankNib: data.bankNib || undefined,
                skills: data.skills || [],
            };

            // Payload ready to send to API

            if (isEditing && employee) {
                await updateEmployee(employee.id, payload);
                toast.success('Funcionário atualizado com sucesso!');
            } else {
                await addEmployee(payload as Parameters<typeof addEmployee>[0]);
                toast.success('Funcionário cadastrado com sucesso!');
            }
            onClose();
        } catch (error) {
            console.error('Detailed Error saving employee:', error);
            const apiErr = error as { response?: { data?: { message?: string; error?: string } } };
            if (apiErr.response?.data) {
                console.error('Backend validation details:', apiErr.response.data);
                const backendMsg = apiErr.response.data.message || apiErr.response.data.error;
                toast.error(`Erro do servidor: ${backendMsg || 'Dados inválidos'}`);
            } else {
                toast.error('Erro ao salvar colaborador. Verifique a sua conexão.');
            }
        }
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({ value, label }));

    const departmentOptions = [
        { value: 'vendas', label: 'Vendas' },
        { value: 'estoque', label: 'Estoque' },
        { value: 'financeiro', label: 'Financeiro' },
        { value: 'administrativo', label: 'Administrativo' },
        { value: 'rh', label: 'Recursos Humanos' },
        { value: 'ti', label: 'Tecnologia' },
        { value: 'atendimento', label: 'Atendimento' },
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={isEditing ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador'}
            size="xl"
        >
            <form onSubmit={handleSubmit(onSubmit, (validationErrors) => {
                console.error('Form validation errors:', validationErrors);
                const firstError = Object.entries(validationErrors)[0];
                if (firstError) {
                    const [field, error] = firstError;
                    toast.error(`Campo "${field}": ${(error as { message?: string })?.message || 'inválido'}`);
                }
            })} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">

                {/* ═══ 1. DADOS PESSOAIS ═══ */}
                <SectionHeader icon={HiOutlineUser} title="Dados Pessoais" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Código *" {...register('code')} error={errors.code?.message} placeholder="EMP-001" />
                    <Input label="Nome Completo *" {...register('name')} error={errors.name?.message} placeholder="Nome do Colaborador" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Email *" type="email" {...register('email')} error={errors.email?.message} placeholder="email@empresa.com" />
                    <Input label="Telefone *" {...register('phone')} error={errors.phone?.message} placeholder="8x 000 0000" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Data de Nascimento" type="date" {...register('birthDate')} />
                    <Input label="Nº Documento (BI)" {...register('documentNumber')} placeholder="Bilhete de Identidade" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="NUIT" {...register('nuit')} placeholder="Nº Único de Identificação Tributária" />
                    <Input label="Contato de Emergência" {...register('emergencyContact')} placeholder="Nome e telefone" />
                </div>
                <Input label="Endereço Residencial" {...register('address')} placeholder="Endereço completo" />

                {/* ═══ 2. CONTRATO & REMUNERAÇÃO ═══ */}
                <SectionHeader icon={HiOutlineDocumentText} title="Contrato & Remuneração" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Função / Cargo *" options={roleOptions} {...register('role')} error={errors.role?.message} />
                    <Select label="Departamento *" options={departmentOptions} {...register('department')} error={errors.department?.message} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Data de Admissão *" type="date" {...register('hireDate')} error={errors.hireDate?.message} />
                    <Input label="Vencimento Base Mensal *" type="number" step="0.01" {...register('baseSalary')} error={errors.baseSalary?.message} leftIcon={<span className="text-gray-500 text-sm">MT</span>} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label="Tipo de Contrato" options={[{ value: 'indefinite', label: 'Indeterminado' }, { value: 'fixed_term', label: 'Prazo Determinado' }]} {...register('contractType')} />
                    <Input label="Data de Expiração" type="date" {...register('contractExpiry')} disabled={control._formValues.contractType !== 'fixed_term'} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="INSS" {...register('socialSecurityNumber')} placeholder="Nº Beneficiário" />
                    <Input label="Subsídio de Transporte" type="number" step="0.01" {...register('subsidyTransport')} />
                    <Input label="Subsídio de Alimentação" type="number" step="0.01" {...register('subsidyFood')} />
                </div>

                {/* ═══ 3. DADOS BANCÁRIOS ═══ */}
                <SectionHeader icon={HiOutlineCreditCard} title="Dados Bancários" />
                <Input label="Nome do Banco" {...register('bankName')} placeholder="Ex: Millennium BIM" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Número da Conta" {...register('bankAccountNumber')} placeholder="000000000" />
                    <Input label="NIB" {...register('bankNib')} placeholder="0000 0000 0000 0000 0000 0" />
                </div>

                {/* ═══ 4. PROFISSIONAL ═══ */}
                <SectionHeader icon={HiOutlineBriefcase} title="Profissional" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Taxa de Comissão Base (%)" type="number" step="0.1" {...register('commissionRate')} placeholder="0.0" rightIcon={<span className="text-gray-400">%</span>} />
                    <Input label="ID do Superior (Opcional)" {...register('reportsToId')} placeholder="ID do Gerente" />
                </div>

                {/* ═══ 5. QUALIFICAÇÕES ACADÊMICAS ═══ */}
                <SectionHeader icon={HiOutlineAcademicCap} title="Qualificações Acadêmicas" />
                <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={addQualification}>
                        <HiOutlinePlus className="mr-1" /> Adicionar Qualificação
                    </Button>
                </div>

                {fields.length === 0 ? (
                    <Card padding="lg" variant="glass" className="text-center text-gray-500">
                        <HiOutlineAcademicCap className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">Nenhuma qualificação adicionada</p>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <Card key={field.id} padding="md" className="relative border-primary-50 dark:border-primary-900/20">
                                <button type="button" onClick={() => remove(index)} className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-50 rounded">
                                    <HiOutlineTrash />
                                </button>
                                <div className="grid grid-cols-2 gap-3">
                                    <Select label="Nível" options={educationLevelOptions} {...register(`qualifications.${index}.level`)} />
                                    <Input label="Curso" {...register(`qualifications.${index}.courseName`)} />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <Input label="Instituição" {...register(`qualifications.${index}.institution`)} />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Input label="Ano Início" type="number" {...register(`qualifications.${index}.startYear`)} />
                                        <Input label="Ano Fim" type="number" {...register(`qualifications.${index}.endYear`)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <div className="flex items-center gap-2 mt-6">
                                        <input type="checkbox" {...register(`qualifications.${index}.isCompleted`)} className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500" />
                                        <label className="text-xs text-gray-700 dark:text-gray-300">Concluído</label>
                                    </div>
                                    <Input label="Nº Certificado" {...register(`qualifications.${index}.certificateNumber`)} />
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* ═══ 6. COMPETÊNCIAS & SKILLS ═══ */}
                <SectionHeader icon={HiOutlinePlus} title="Competências & Skills" />
                <div className="space-y-2">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2">Adicione competências técnicas e soft skills</p>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-dark-900/50 rounded-xl border border-dashed border-gray-300 dark:border-dark-700">
                        {/* Simple skills implementation using a textarea for now, or we can use a more complex component if needed. Let's use a dynamic list of strings. */}
                        <Input 
                            placeholder="Ex: React, Vendas, Gestão de Equipa (Pressione Enter para adicionar)" 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const val = e.currentTarget.value.trim();
                                    if (val) {
                                        const currentSkills = control._formValues.skills || [];
                                        if (!currentSkills.includes(val)) {
                                            setValue('skills', [...currentSkills, val], { shouldDirty: true, shouldValidate: true });
                                        }
                                        e.currentTarget.value = '';
                                    }
                                }
                            }}
                        />
                        <div className="flex flex-wrap gap-2 mt-2 w-full">
                            {(control._formValues.skills || []).map((skill: string, i: number) => (
                                <span key={i} className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 border border-primary-200 dark:border-primary-800/50 group">
                                    {skill}
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const newSkills = (control._formValues.skills || []).filter((_: unknown, idx: number) => idx !== i);
                                            setValue('skills', newSkills, { shouldDirty: true, shouldValidate: true });
                                        }}
                                        className="hover:text-red-500"
                                    >
                                        <HiOutlineTrash className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ═══ ACTIONS ═══ */}
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-700 sticky bottom-0 bg-white dark:bg-dark-800 pb-1">
                    <Button type="button" variant="ghost" onClick={handleClose}>
                        Cancelar
                    </Button>
                    <Button type="submit" isLoading={isSubmitting}>
                        {isEditing ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
