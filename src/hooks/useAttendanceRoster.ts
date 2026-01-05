import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { employeesAPI } from '../services/api';

export interface RosterEmployee {
    id: string;
    name: string;
    code: string;
    department: string | null;
    phone: string | null;
    status?: string;
}

export function useAttendanceRoster() {
    const [roster, setRoster] = useState<RosterEmployee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRoster = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await employeesAPI.getRoster();
            setRoster(data);
        } catch (err) {
            setError('Erro ao carregar lista de ponto');
            console.error('Error fetching roster:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoster();
    }, [fetchRoster]);

    const addToRoster = async (params: { employeeIds?: string[]; department?: string }) => {
        try {
            await employeesAPI.addToRoster(params);
            toast.success('Funcionários adicionados com sucesso');
            fetchRoster();
        } catch (err) {
            toast.error('Erro ao adicionar à lista');
            throw err;
        }
    };

    const removeFromRoster = async (id: string) => {
        try {
            await employeesAPI.removeFromRoster(id);
            toast.success('Funcionário removido da lista');
            fetchRoster();
        } catch (err: any) {
            const message = err.response?.data?.error || 'Erro ao remover da lista';
            toast.error(message);
            throw err;
        }
    };

    const recordTime = async (id: string, type: 'checkIn' | 'checkOut') => {
        try {
            await employeesAPI.recordRosterTime(id, { type });
            toast.success(type === 'checkIn' ? 'Entrada registrada' : 'Saída registrada');
            fetchRoster();
        } catch (err: any) {
            const message = err.response?.data?.error || 'Erro ao registrar tempo';
            toast.error(message);
            throw err;
        }
    };

    return {
        roster,
        isLoading,
        error,
        refetch: fetchRoster,
        addToRoster,
        removeFromRoster,
        recordTime
    };
}
