import { logger } from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { employeesAPI } from '../services/api';
import type { AttendanceRecord } from '../types';

interface UseAttendanceParams {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
}

export function useAttendance(params?: UseAttendanceParams) {
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAttendance = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await employeesAPI.getAttendance(params);
            
            let attendanceData: AttendanceRecord[] = [];
            if (result.success && result.data) {
                const payload = result.data;
                attendanceData = payload.data || (Array.isArray(payload) ? payload : []);
            } else {
                attendanceData = Array.isArray(result) ? result : (result.records || []);
            }
            
            setAttendance(attendanceData);
        } catch (err) {
            setError('Erro ao carregar presenças');
            logger.error('Error fetching attendance:', err);
        } finally {
            setIsLoading(false);
        }
    }, [params?.employeeId, params?.startDate, params?.endDate]);

    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    const recordAttendance = async (data: Parameters<typeof employeesAPI.recordAttendance>[0]) => {
        try {
            const result = await employeesAPI.recordAttendance(data);
            const record = result.success ? result.data : result;
            setAttendance((prev) => [...prev, record]);
            toast.success('Presença registada com sucesso!');
            return record;
        } catch (err) {
            logger.error('Error recording attendance:', err);
            throw err;
        }
    };

    return {
        attendance,
        isLoading,
        error,
        refetch: fetchAttendance,
        recordAttendance,
    };
}
