import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineAcademicCap, HiOutlineCreditCard, HiOutlineDocumentText, HiOutlineUser } from 'react-icons/hi';
import { useEmployees } from '../../hooks/useData';
import { Button, Modal, Input, Select, Card } from '../ui';
import { generateId } from '../../utils/helpers';
import { roleLabels } from '../../utils/constants';
import type { Employee, EmployeeRole, AcademicQualification } from '../../types';

import toast from 'react-hot-toast';

// Qualification Schema
const qualificationSchema = z.object({
    id: z.string(),
    level: z.string().min(1, 'Nível é obrigatório'),
    courseName: z.string().min(1, 'Nome do curso é obrigatório'),
    institution: z.string().min(1, 'Instituição é obrigatória'),
    startYear: z.coerce.number().min(1950, 'Ano inválido').max(new Date().getFullYear(), 'Ano inválido'),
    endYear: z.coerce.number().optional(),
    isCompleted: z.boolean(),
    certificateNumber: z.string().optional(),
});

// Validation Schema
const employeeSchema = z.object({
    code: z.string().min(1, 'Código é obrigatório'),
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    phone: z.string().min(10, 'Telefone inválido'),
    role: z.string().min(1, 'Cargo é obrigatório'),
    department: z.string().min(1, 'Departamento é obrigatório'),
    hireDate: z.string().min(1, 'Data de admissão é obrigatória'),
    salary: z.coerce.number().min(0, 'Salário não pode ser negativo'),
    address: z.string().optional(),
    documentNumber: z.string().optional(),
    emergencyContact: z.string().optional(),
    // Contract
    socialSecurityNumber: z.string().optional(),
    nuit: z.string().optional(),
    subsidyTransport: z.coerce.number().optional(),
    subsidyFood: z.coerce.number().optional(),
    // Bank
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    nib: z.string().optional(),
    qualifications: z.array(qualificationSchema).optional(),
    // Personal
    birthDate: z.string().optional(),
    // Contract type
    contractType: z.string().optional(),
    contractExpiry: z.string().optional(),
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

export default function EmployeeForm({ isOpen, onClose, employee }: EmployeeFormProps) {
    const { addEmployee, updateEmployee } = useEmployees();
    const isEditing = !!employee;
    const [activeSection, setActiveSection] = useState<'info' | 'contract' | 'bank' | 'qualifications'>('info');

    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors, isSubmitting },
    } = useForm<EmployeeFormData>({
        resolver: zodResolver(employeeSchema) as never,
        defaultValues: {
            code: '',
            name: '',
            email: '',
            phone: '',
            role: 'operator',
            department: '',
            hireDate: '',
            salary: 0,
            address: '',
            documentNumber: '',
            emergencyContact: '',
            // New Fields Defaults
            socialSecurityNumber: '',
            nuit: '',
            subsidyTransport: 0,
            subsidyFood: 0,
            bankName: '',
            accountNumber: '',
            nib: '',
            qualifications: [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'qualifications',
    });

    // Reset form when employee changes
    useEffect(() => {
        if (employee) {
            reset({
                code: employee.code,
                name: employee.name,
                email: employee.email,
                phone: employee.phone,
                role: employee.role,
                department: employee.department,
                hireDate: employee.hireDate,
                salary: employee.salary,
                address: employee.address || '',
                documentNumber: employee.documentNumber || '',
                emergencyContact: employee.emergencyContact || '',
                qualifications: employee.qualifications || [],
                // Map new fields
                socialSecurityNumber: employee.socialSecurityNumber || '',
                nuit: employee.nuit || '',
                subsidyTransport: employee.subsidyTransport || 0,
                subsidyFood: employee.subsidyFood || 0,
                bankName: employee.bankInfo?.bankName || '',
                accountNumber: employee.bankInfo?.accountNumber || '',
                nib: employee.bankInfo?.nib || '',
                birthDate: employee.birthDate?.split('T')[0] || '',
                contractType: employee.contractType || 'indefinite',
                contractExpiry: employee.contractExpiry?.split('T')[0] || '',
            });
        } else {
            reset({
                code: `EMP-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
                name: '',
                email: '',
                phone: '',
                role: 'operator',
                department: '',
                hireDate: new Date().toISOString().split('T')[0],
                salary: 0,
                address: '',
                documentNumber: '',
                emergencyContact: '',
                qualifications: [],
                birthDate: '',
                contractType: 'indefinite',
                contractExpiry: '',
            });
        }
    }, [employee, reset]);

    const addQualification = () => {
        append({
            id: generateId(),
            level: 'graduacao',
            courseName: '',
            institution: '',
            startYear: new Date().getFullYear() - 4,
            endYear: undefined,
            isCompleted: false,
            certificateNumber: '',
        });
    };

    const onSubmit = (data: EmployeeFormData) => {
        const qualifications = data.qualifications?.map((q) => ({
            ...q,
            endYear: q.endYear || undefined,
            certificateNumber: q.certificateNumber || undefined,
        })) as AcademicQualification[] | undefined;

        if (isEditing && employee) {
            updateEmployee(employee.id, {
                name: data.name,
                email: data.email,
                phone: data.phone,
                role: data.role,
                department: data.department,
                hireDate: data.hireDate,
                address: data.address || undefined,
                documentNumber: data.documentNumber || undefined,
                socialSecurityNumber: data.socialSecurityNumber,
                nuit: data.nuit,
                subsidyTransport: data.subsidyTransport,
                subsidyFood: data.subsidyFood,
                baseSalary: data.salary,
                bankName: data.bankName || undefined,
                bankAccountNumber: data.accountNumber || undefined,
                bankNib: data.nib || undefined,
                birthDate: data.birthDate || undefined,
                contractType: data.contractType || 'indefinite',
                contractExpiry: data.contractType === 'fixed_term' ? data.contractExpiry : undefined,
            } as Partial<Employee>);
            toast.success('Funcionário atualizado com sucesso!');
        } else {
            const newEmployee: Employee = {
                id: generateId(),
                code: data.code,
                name: data.name,
                email: data.email,
                phone: data.phone,
                role: data.role as EmployeeRole,
                department: data.department,
                hireDate: data.hireDate,
                salary: data.salary,
                address: data.address || undefined,
                documentNumber: data.documentNumber || undefined,
                emergencyContact: data.emergencyContact || undefined,
                qualifications,
                isActive: true,
                createdAt: new Date().toISOString(),
                socialSecurityNumber: data.socialSecurityNumber,
                nuit: data.nuit,
                subsidyTransport: data.subsidyTransport,
                subsidyFood: data.subsidyFood,
                baseSalary: data.salary,
                bankInfo: {
                    bankName: data.bankName || '',
                    accountNumber: data.accountNumber || '',
                    nib: data.nib || '',
                },
                birthDate: data.birthDate || undefined,
                contractType: (data.contractType || 'indefinite') as any,
                contractExpiry: data.contractType === 'fixed_term' ? data.contractExpiry : undefined,
            };
            addEmployee(newEmployee);
            toast.success('Funcionário cadastrado com sucesso!');
        }
        onClose();
    };

    const handleClose = () => {
        reset();
        setActiveSection('info');
        onClose();
    };

    const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({
        value,
        label,
    }));

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
            title={isEditing ? 'Editar Colaborador' : 'Adicionar Colaborador'}
            size="xl"
        >
            <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-6">
                {/* Section Tabs */}
                <div className="flex gap-2 border-b border-gray-200 dark:border-dark-700 pb-4 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveSection('info')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeSection === 'info'
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-700'
                            }`}
                    >
                        <HiOutlineUser className="w-5 h-5" />
                        Pessoal
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection('contract')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeSection === 'contract'
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-700'
                            }`}
                    >
                        <HiOutlineDocumentText className="w-5 h-5" />
                        Contrato
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection('bank')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeSection === 'bank'
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-700'
                            }`}
                    >
                        <HiOutlineCreditCard className="w-5 h-5" />
                        Bancários
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection('qualifications')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeSection === 'qualifications'
                            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-700'
                            }`}
                    >
                        <HiOutlineAcademicCap className="w-5 h-5" />
                        Qualificações
                    </button>
                </div>

                {/* Personal Info Section */}
                {activeSection === 'info' && (
                    <div className="space-y-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Código de Funcionário *"
                                {...register('code')}
                                error={errors.code?.message}
                                placeholder="EMP-001"
                            />
                            <Input
                                label="Nome Completo *"
                                {...register('name')}
                                error={errors.name?.message}
                                placeholder="Nome Completo do Colaborador"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Email *"
                                type="email"
                                {...register('email')}
                                error={errors.email?.message}
                                placeholder="email@empresa.com"
                            />
                            <Input
                                label="Telefone *"
                                {...register('phone')}
                                error={errors.phone?.message}
                                placeholder="(00) 00000-0000"
                            />
                        </div>

                        {/* Role and Department */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select
                                label="Função / Cargo *"
                                options={roleOptions}
                                {...register('role')}
                                error={errors.role?.message}
                            />
                            <Select
                                label="Departamento *"
                                options={departmentOptions}
                                {...register('department')}
                                error={errors.department?.message}
                            />
                        </div>

                        {/* Hire Date and Salary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Data de Admissão *"
                                type="date"
                                {...register('hireDate')}
                                error={errors.hireDate?.message}
                            />
                            <Input
                                label="Data de Nascimento"
                                type="date"
                                {...register('birthDate')}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Vencimento Base"
                                type="number"
                                step="0.01"
                                {...register('salary')}
                                error={errors.salary?.message}
                                placeholder="0.00"
                            />
                        </div>

                        {/* Additional Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="NUIT"
                                {...register('documentNumber')}
                                placeholder="Número Único de Identificação Tributária"
                            />
                            <Input
                                label="Contato de Emergência"
                                {...register('emergencyContact')}
                                placeholder="Nome e telefone (Ex: Maria - 82 000 0000)"
                            />
                            <Input
                                label="Endereço Residencial"
                                {...register('address')}
                                placeholder="Endereço completo"
                                className="md:col-span-2"
                            />
                        </div>
                    </div>
                )}

                {/* Contract Section */}
                {activeSection === 'contract' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select
                                label="Função / Cargo *"
                                options={roleOptions}
                                {...register('role')}
                                error={errors.role?.message}
                            />
                            <Select
                                label="Departamento *"
                                options={departmentOptions}
                                {...register('department')}
                                error={errors.department?.message}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Data de Admissão *"
                                type="date"
                                {...register('hireDate')}
                                error={errors.hireDate?.message}
                            />
                            <Input
                                label="Vencimento Base Mensal *"
                                type="number"
                                step="0.01"
                                {...register('salary')}
                                error={errors.salary?.message}
                                leftIcon={<span className="text-gray-500 text-sm">MT</span>}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="INSS (Opcional)"
                                {...register('socialSecurityNumber')}
                                placeholder="Número Beneficiário"
                            />
                            <Input
                                label="NUIT (Opcional)"
                                {...register('nuit')}
                                placeholder="Número Único de Identificação Tributária"
                            />
                        </div>
                        <h4 className="font-medium text-gray-900 dark:text-white pt-2">Tipo de Contrato</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select
                                label="Tipo de Contrato"
                                options={[
                                    { value: 'indefinite', label: 'Indeterminado' },
                                    { value: 'fixed_term', label: 'Prazo Determinado' },
                                ]}
                                {...register('contractType')}
                            />
                            {/* Only show expiry date for fixed-term contracts */}
                            <Input
                                label="Data de Expiração do Contrato"
                                type="date"
                                {...register('contractExpiry')}
                                placeholder="Para contratos a prazo"
                            />
                        </div>
                        <h4 className="font-medium text-gray-900 dark:text-white pt-2">Subsídios e Benefícios</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Subsídio de Transporte"
                                type="number"
                                step="0.01"
                                {...register('subsidyTransport')}
                                leftIcon={<span className="text-gray-500 text-sm">MT</span>}
                            />
                            <Input
                                label="Subsídio de Alimentação"
                                type="number"
                                step="0.01"
                                {...register('subsidyFood')}
                                leftIcon={<span className="text-gray-500 text-sm">MT</span>}
                            />
                        </div>
                    </div>
                )}

                {/* Bank Section */}
                {activeSection === 'bank' && (
                    <div className="space-y-4">
                        <Input
                            label="Nome do Banco"
                            {...register('bankName')}
                            placeholder="Ex: Millennium BIM"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Número da Conta"
                                {...register('accountNumber')}
                                placeholder="000000000"
                            />
                            <Input
                                label="NIB"
                                {...register('nib')}
                                placeholder="0000 0000 0000 0000 0000 0"
                            />
                        </div>
                    </div>
                )}

                {/* Qualifications Section */}
                {activeSection === 'qualifications' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                    Qualificações Acadêmicas
                                </h3>
                                <p className="text-sm text-gray-500">
                                    Adicione as formações acadêmicas e certificações do colaborador
                                </p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={addQualification}>
                                <HiOutlinePlus className="w-4 h-4 mr-1" />
                                Adicionar
                            </Button>
                        </div>

                        {fields.length === 0 ? (
                            <Card padding="lg" variant="glass" className="text-center">
                                <HiOutlineAcademicCap className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                                <p className="text-gray-500 dark:text-gray-400">
                                    Nenhuma qualificação adicionada
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-3"
                                    onClick={addQualification}
                                >
                                    <HiOutlinePlus className="w-4 h-4 mr-1" />
                                    Adicionar Qualificação
                                </Button>
                            </Card>
                        ) : (
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {fields.map((field, index) => (
                                    <Card key={field.id} padding="md" className="relative">
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            className="absolute top-3 right-3 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                        >
                                            <HiOutlineTrash className="w-4 h-4" />
                                        </button>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <Select
                                                label="Nível *"
                                                options={educationLevelOptions}
                                                {...register(`qualifications.${index}.level`)}
                                                error={errors.qualifications?.[index]?.level?.message}
                                            />
                                            <Input
                                                label="Curso *"
                                                {...register(`qualifications.${index}.courseName`)}
                                                error={errors.qualifications?.[index]?.courseName?.message}
                                                placeholder="Ex: Administração de Empresas"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                            <Input
                                                label="Instituição *"
                                                {...register(`qualifications.${index}.institution`)}
                                                error={errors.qualifications?.[index]?.institution?.message}
                                                placeholder="Ex: Universidade Federal"
                                            />
                                            <Input
                                                label="Nº Certificado"
                                                {...register(`qualifications.${index}.certificateNumber`)}
                                                placeholder="Opcional"
                                            />
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 mt-3">
                                            <Input
                                                label="Ano Início *"
                                                type="number"
                                                {...register(`qualifications.${index}.startYear`)}
                                                error={errors.qualifications?.[index]?.startYear?.message}
                                            />
                                            <Input
                                                label="Ano Conclusão"
                                                type="number"
                                                {...register(`qualifications.${index}.endYear`)}
                                                placeholder="Em curso"
                                            />
                                            <div className="flex items-end pb-1">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        {...register(`qualifications.${index}.isCompleted`)}
                                                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        Concluído
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
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
