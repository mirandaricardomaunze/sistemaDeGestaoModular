import { useState, useMemo } from 'react';
import {
    HiOutlineSearch,
    HiOutlineUser,
    HiOutlineUserGroup,
    HiOutlineOfficeBuilding,
    HiOutlinePlus,
    HiOutlineLogin,
    HiOutlineLogout,
    HiOutlineTrash,
    HiOutlineCheck
} from 'react-icons/hi';
import { useAttendanceRoster } from '../../hooks/useAttendanceRoster';
import { useEmployees } from '../../hooks/useEmployees';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { Button, Card, EmptyState, Modal } from '../ui';
import toast from 'react-hot-toast';

export default function AttendanceControl() {
    const { user } = useAuthStore();
    const { roster, isLoading, addToRoster, removeFromRoster, recordTime } = useAttendanceRoster();
    const { employees: allEmployees } = useEmployees();
    const { settings: companySettings } = useCompanySettings();

    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addType, setAddType] = useState<'individual' | 'department'>('individual');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    // Get departments for selection
    const departments = useMemo(() => {
        const deps = new Set(allEmployees.map(e => e.department).filter(Boolean));
        return Array.from(deps) as string[];
    }, [allEmployees]);

    // Filter roster by search term
    const filteredRoster = useMemo(() => {
        return roster.filter(emp =>
            emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.code.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [roster, searchTerm]);

    const handleAdd = async () => {
        try {
            if (addType === 'department') {
                if (!selectedDepartment) return toast.error('Selecione um departamento');
                await addToRoster({ department: selectedDepartment });
            } else {
                if (selectedEmployeeIds.length === 0) return toast.error('Selecione pelo menos um funcionário');
                await addToRoster({ employeeIds: selectedEmployeeIds });
            }
            setIsAddModalOpen(false);
            setSelectedEmployeeIds([]);
            setSelectedDepartment('');
        } catch (error) {
            // Toast handled in hook
        }
    };

    return (
        <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col flex-1 max-w-md gap-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <HiOutlineOfficeBuilding className="w-4 h-4" />
                        <span>Empresa: <span className="font-semibold text-gray-700 dark:text-gray-300">{companySettings?.companyName || 'Carregando...'}</span></span>
                    </div>
                    <div className="relative">
                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Pesquisar funcionário na lista..."
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <Button
                    variant="primary"
                    leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                    onClick={() => setIsAddModalOpen(true)}
                >
                    Adicionar à Área de Ponto
                </Button>
            </div>

            {/* Roster Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-gray-100 dark:bg-dark-800 animate-pulse rounded-2xl" />
                    ))}
                </div>
            ) : filteredRoster.length === 0 ? (
                <EmptyState
                    title="Área de Ponto Vazia"
                    description="Adicione funcionários para começar o controle de ponto em tempo real."
                    icon={<HiOutlinePlus className="w-12 h-12" />}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRoster.map((emp) => (
                        <Card key={emp.id} className="relative group overflow-hidden border-t-4 border-t-primary-500">
                            {isAdmin && (
                                <button
                                    onClick={() => removeFromRoster(emp.id)}
                                    className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                    title="Remover da lista"
                                >
                                    <HiOutlineTrash className="w-5 h-5" />
                                </button>
                            )}

                            <div className="flex flex-col h-full gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                        <span className="text-xl font-bold">
                                            {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <a
                                            href={emp.phone ? `tel:${emp.phone}` : '#'}
                                            className="block text-lg font-bold text-gray-900 dark:text-white hover:text-primary-600 transition-colors truncate"
                                            title={emp.phone ? `Ligar para ${emp.phone}` : 'Sem telefone'}
                                        >
                                            {emp.name}
                                        </a>
                                        <p className="text-sm text-gray-500 flex items-center gap-1">
                                            {emp.code} • {emp.department}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-row gap-2 mt-auto">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                                        leftIcon={<HiOutlineLogin className="w-4 h-4" />}
                                        onClick={() => recordTime(emp.id, 'checkIn')}
                                    >
                                        Entrada
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                        leftIcon={<HiOutlineLogout className="w-4 h-4" />}
                                        onClick={() => recordTime(emp.id, 'checkOut')}
                                    >
                                        Saída
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add to Roster Modal */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Adicionar à Área de Ponto"
                size="md"
            >
                <div className="space-y-6 pt-4">
                    <div className="flex gap-2">
                        <Button
                            variant={addType === 'individual' ? 'primary' : 'outline'}
                            onClick={() => setAddType('individual')}
                            className="flex-1"
                            leftIcon={<HiOutlineUser className="w-5 h-5" />}
                        >
                            Individual
                        </Button>
                        <Button
                            variant={addType === 'department' ? 'primary' : 'outline'}
                            onClick={() => setAddType('department')}
                            className="flex-1"
                            leftIcon={<HiOutlineUserGroup className="w-5 h-5" />}
                        >
                            Por Setor
                        </Button>
                    </div>

                    {addType === 'individual' ? (
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Selecionar Funcionários
                            </label>
                            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-dark-700 rounded-xl divide-y divide-gray-100 dark:divide-dark-800">
                                {allEmployees.filter(e => e.isActive && !roster.some(r => r.id === e.id)).map(emp => (
                                    <div
                                        key={emp.id}
                                        className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer"
                                        onClick={() => {
                                            setSelectedEmployeeIds(prev =>
                                                prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                                            );
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedEmployeeIds.includes(emp.id)}
                                            onChange={() => { }} // Handled by div click
                                            className="w-4 h-4 rounded text-primary-600 border-gray-300 focus:ring-primary-500"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{emp.name}</p>
                                            <p className="text-xs text-gray-500">{emp.department}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <HiOutlineUserGroup className="w-5 h-5 text-primary-500" />
                                Selecionar Departamento
                            </label>
                            <select
                                className="w-full p-3 bg-white dark:bg-dark-800 border-2 border-gray-100 dark:border-dark-700 rounded-2xl outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-medium"
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                            >
                                <option value="">Escolha um setor...</option>
                                {departments.length > 0 ? (
                                    departments.map(dep => (
                                        <option key={dep} value={dep}>{dep}</option>
                                    ))
                                ) : (
                                    <>
                                        <option value="Administração">Administração</option>
                                        <option value="Vendas">Vendas</option>
                                        <option value="Operações">Operações</option>
                                        <option value="Logística">Logística</option>
                                        <option value="Segurança">Segurança</option>
                                        <option value="Limpeza">Limpeza</option>
                                    </>
                                )}
                            </select>
                            <p className="text-xs text-gray-500 mt-2">
                                * Se o setor não aparecer, verifique o cadastro dos funcionários.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-dark-800">
                        <Button variant="outline" onClick={() => setIsAddModalOpen(false)} size="lg">
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleAdd}
                            size="lg"
                            disabled={addType === 'individual' ? selectedEmployeeIds.length === 0 : !selectedDepartment}
                            leftIcon={<HiOutlineCheck className="w-5 h-5" />}
                        >
                            Confirmar Adição
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
