import { useState, useEffect } from 'react';
import { 
    HiOutlineSun, 
    HiOutlineCalendar, 
    HiOutlineCheckCircle, 
    HiOutlineXCircle,
    HiOutlinePlus
} from 'react-icons/hi2';
import { Card, Button, Badge, Modal, Input, Select, Pagination, usePagination } from '../../ui';
import { MetricCard } from '../../common/ModuleMetricCard';
import { employeesAPI } from '../../../services/api';
import { logger } from '../../../utils/logger';
import toast from 'react-hot-toast';
import type { VacationRequest, Employee } from '../../../types';
import { HiOutlineUserGroup } from 'react-icons/hi2';

export function CommercialVacationManager() {
    const [requests, setRequests] = useState<VacationRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [newRequest, setNewRequest] = useState({ employeeId: '', startDate: '', endDate: '' });

    const {
        paginatedItems: paginatedRequests,
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        totalItems,
    } = usePagination(requests, 10);

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
        } catch {
            toast.error('Erro ao aprovar');
        }
    };

    const handleReject = async (id: string) => {
        try {
            await employeesAPI.updateVacation(id, { status: 'rejected' });
            toast.success('Pedido rejeitado');
            fetchData();
        } catch {
            toast.error('Erro ao rejeitar');
        }
    };

    const handleSubmitRequest = async () => {
        if (!newRequest.employeeId || !newRequest.startDate || !newRequest.endDate) {
            toast.error('Preencha colaborador e periodo');
            return;
        }

        try {
            await employeesAPI.requestVacation(newRequest);
            toast.success('Pedido submetido!');
            setShowRequestModal(false);
            setNewRequest({ employeeId: '', startDate: '', endDate: '' });
            fetchData();
        } catch {
            toast.error('Erro ao submeter pedido');
        }
    };

    const getEmployeeName = (id: string) => {
        return employees.find(e => e.id === id)?.name || 'Colaborador';
    };

    if (isLoading) {
        return (
            <div className="p-12 text-center bg-white/50 dark:bg-dark-800/50 backdrop-blur-xl rounded-2xl border border-dashed border-gray-200 dark:border-dark-700">
                <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 italic">A sincronizar calendário de férias...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tighter">
                        <HiOutlineSun className="text-yellow-500" />
                        Gestão de Férias
                    </h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mt-1">Escalas, saldos e pedidos de ausência da equipa</p>
                </div>
                <Button variant="primary" leftIcon={<HiOutlinePlus />} onClick={() => setShowRequestModal(true)}>
                    Solicitar Férias
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard
                    label="Pendentes"
                    value={requests.filter(r => r.status === 'pending').length}
                    color="blue"
                    icon={<HiOutlineSun className="w-6 h-6 opacity-20" />}
                />
                <MetricCard
                    label="Aprovados"
                    value={requests.filter(r => r.status === 'approved').length}
                    color="green"
                    icon={<HiOutlineCheckCircle className="w-6 h-6 opacity-20" />}
                />
                <MetricCard
                    label="Em Gozo"
                    value={requests.filter((request) => {
                        const today = new Date();
                        return request.status === 'approved' &&
                            new Date(request.startDate) <= today &&
                            new Date(request.endDate) >= today;
                    }).length}
                    color="orange"
                    icon={<HiOutlineCalendar className="w-6 h-6 opacity-20" />}
                />
                <MetricCard
                    label="Total Equipa"
                    value={employees.length}
                    color="purple"
                    icon={<HiOutlineUserGroup className="w-6 h-6 opacity-20" />}
                />
            </div>

            <Card variant="glass" padding="none" className="overflow-hidden shadow-xl">
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
                                paginatedRequests.map(req => (
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
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleApprove(req.id)}
                                                        title="Aprovar"
                                                        className="p-2 text-green-600 hover:bg-green-50 active:scale-95"
                                                    >
                                                        <HiOutlineCheckCircle className="w-5 h-5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleReject(req.id)}
                                                        title="Rejeitar"
                                                        className="p-2 text-red-600 hover:bg-red-50 active:scale-95"
                                                    >
                                                        <HiOutlineXCircle className="w-5 h-5" />
                                                    </Button>
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
                {!isLoading && requests.length > 0 && (
                    <div className="p-4 border-t border-gray-100 dark:border-dark-600 bg-gray-50/50 dark:bg-dark-800/50">
                        <Pagination
                            currentPage={currentPage}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                        />
                    </div>
                )}
            </Card>

            <Modal isOpen={showRequestModal} onClose={() => setShowRequestModal(false)} title="Novo Pedido de Férias">
                <div className="p-4 space-y-4">
                    <Select
                        label="Colaborador"
                        value={newRequest.employeeId}
                        onChange={(e) => setNewRequest((current) => ({ ...current, employeeId: e.target.value }))}
                        options={employees.map(e => ({ value: e.id, label: e.name }))}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Data Início"
                            type="date"
                            value={newRequest.startDate}
                            onChange={(e) => setNewRequest((current) => ({ ...current, startDate: e.target.value }))}
                        />
                        <Input
                            label="Data Fim"
                            type="date"
                            value={newRequest.endDate}
                            onChange={(e) => setNewRequest((current) => ({ ...current, endDate: e.target.value }))}
                        />
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-100 dark:border-yellow-800">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            <strong>Nota:</strong> O sistema verificar automaticamente se o colaborador possui saldo de férias disponível antes de permitir a aprovação final pelo Gestãor.
                        </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="ghost" onClick={() => setShowRequestModal(false)}>Cancelar</Button>
                        <Button variant="primary" onClick={handleSubmitRequest}>
                            Submeter Pedido
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

