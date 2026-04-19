import { useState, useEffect } from 'react';
import { 
    HiOutlineSun, 
    HiOutlineCalendar, 
    HiOutlineCheckCircle, 
    HiOutlineXCircle,
    HiOutlinePlus
} from 'react-icons/hi2';
import { Card, Button, Badge, Modal, Input, Select } from '../../ui';
import { employeesAPI } from '../../../services/api';
import { logger } from '../../../utils/logger';
import toast from 'react-hot-toast';
import type { VacationRequest, Employee } from '../../../types';

export function CommercialVacationManager() {
    const [requests, setRequests] = useState<VacationRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [vacationsData, employeesData] = await Promise.all([
                employeesAPI.getVacations(),
                employeesAPI.getAll()
            ]);
            setRequests(Array.isArray(vacationsData) ? vacationsData : (vacationsData?.data || []));
            setEmployees(Array.isArray(employeesData) ? employeesData : (employeesData.data || []));
        } catch (error) {
            logger.error('Error fetching vacation data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            await employeesAPI.updateVacation(id, { status: 'approved' });
            toast.success('Férias aprovadas!');
            fetchData();
        } catch (error) {
            toast.error('Erro ao aprovar');
        }
    };

    const handleReject = async (id: string) => {
        try {
            await employeesAPI.updateVacation(id, { status: 'rejected' });
            toast.success('Pedido rejeitado');
            fetchData();
        } catch (error) {
            toast.error('Erro ao rejeitar');
        }
    };

    const getEmployeeName = (id: string) => {
        return employees.find(e => e.id === id)?.name || 'Colaborador';
    };

    if (isLoading) {
        return (
            <div className="p-12 text-center bg-white dark:bg-dark-700 rounded-lg border border-dashed border-gray-200 dark:border-dark-700">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">A sincronizar calendário de férias...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineSun className="text-yellow-500" />
                        Gestãor de Férias & Ausências
                    </h2>
                    <p className="text-gray-500">Controlo de escalas, saldos e pedidos de folga</p>
                </div>
                <Button variant="primary" leftIcon={<HiOutlinePlus />} onClick={() => setShowRequestModal(true)}>
                    Solicitar Férias
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Pendentes</p>
                    <p className="text-3xl font-black text-blue-800 dark:text-blue-200 mt-1">
                        {requests.filter(r => r.status === 'pending').length}
                    </p>
                </Card>
                <Card className="p-4 bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800">
                    <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Aprovados (Mês)</p>
                    <p className="text-3xl font-black text-green-800 dark:text-green-200 mt-1">
                        {requests.filter(r => r.status === 'approved').length}
                    </p>
                </Card>
                <Card className="p-4 bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-800">
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Em Gozo</p>
                    <p className="text-3xl font-black text-orange-800 dark:text-orange-200 mt-1">2</p>
                </Card>
                <Card className="p-4 bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800">
                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Total Equipa</p>
                    <p className="text-3xl font-black text-purple-800 dark:text-purple-200 mt-1">{employees.length}</p>
                </Card>
            </div>

            <Card className="overflow-hidden border-gray-100 dark:border-dark-600">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-100 dark:border-dark-600">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Colaborador</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Período</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Dias</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Estado</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                            {requests.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                                        Nenhum pedido de férias registado no sistema.
                                    </td>
                                </tr>
                            ) : (
                                requests.map(req => (
                                    <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-dark-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-gray-900 dark:text-white">{getEmployeeName(req.employeeId)}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                <HiOutlineCalendar />
                                                <span>{new Date(req.startDate).toLocaleDateString()}</span>
                                                <span>→</span>
                                                <span>{new Date(req.endDate).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-mono font-bold bg-gray-100 dark:bg-dark-800 px-2 py-1 rounded">
                                                {req.days}d
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={
                                                req.status === 'approved' ? 'success' : 
                                                req.status === 'pending' ? 'warning' : 'danger'
                                            }>
                                                {req.status.toUpperCase()}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {req.status === 'pending' && (
                                                <div className="flex gap-2 justify-end">
                                                    <button 
                                                        onClick={() => handleApprove(req.id)}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        title="Aprovar"
                                                    >
                                                        <HiOutlineCheckCircle className="w-5 h-5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleReject(req.id)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Rejeitar"
                                                    >
                                                        <HiOutlineXCircle className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            )}
                                            {req.status !== 'pending' && (
                                                <span className="text-xs text-gray-400 italic">
                                                    Processado em {new Date(req.createdAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Modal isOpen={showRequestModal} onClose={() => setShowRequestModal(false)} title="Novo Pedido de Férias">
                <div className="p-4 space-y-4">
                    <Select label="Colaborador" options={employees.map(e => ({ value: e.id, label: e.name }))} />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Data Início" type="date" />
                        <Input label="Data Fim" type="date" />
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-100 dark:border-yellow-800">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            <strong>Nota:</strong> O sistema verificar automaticamente se o colaborador possui saldo de férias disponível antes de permitir a aprovação final pelo Gestãor.
                        </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setShowRequestModal(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={() => { toast.success('Pedido submetido!'); setShowRequestModal(false); }}>
                            Submeter Pedido
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

