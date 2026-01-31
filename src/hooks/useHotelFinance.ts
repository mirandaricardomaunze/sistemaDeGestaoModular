import { useState, useEffect, useMemo, useCallback } from 'react';
import { hospitalityAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { usePagination } from '../components/ui';
import { expenseCategories } from '../pages/hotel/components/ExpenseModal';

export type TimePeriod = '1m' | '3m' | '6m' | '1y';

export function useHotelFinance(selectedPeriod: TimePeriod, activeTab: string) {
    const [isLoading, setIsLoading] = useState(true);
    const [dashboard, setDashboard] = useState<any>(null);
    const [revenues, setRevenues] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);

    // Reports states
    const [profitLossReport, setProfitLossReport] = useState<any>(null);
    const [roomRevenueReport, setRoomRevenueReport] = useState<any>(null);
    const [isLoadingReports, setIsLoadingReports] = useState(false);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQueryRevenue, setSearchQueryRevenue] = useState('');
    const [filterStatusRevenue, setFilterStatusRevenue] = useState<string>('all');

    // Fetch dashboard data
    const fetchDashboard = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await hospitalityAPI.getFinanceDashboard(selectedPeriod);
            setDashboard(data);
        } catch (error) {
            console.error('Error fetching finance dashboard:', error);
            toast.error('Erro ao carregar dashboard financeiro');
        } finally {
            setIsLoading(false);
        }
    }, [selectedPeriod]);

    // Fetch revenues
    const fetchRevenues = useCallback(async () => {
        try {
            const data = await hospitalityAPI.getRevenues({ limit: 50 });
            setRevenues(data.data || []);
        } catch (error) {
            console.error('Error fetching revenues:', error);
            toast.error('Erro ao carregar receitas');
        }
    }, []);

    // Fetch expenses
    const fetchExpenses = useCallback(async () => {
        try {
            const data = await hospitalityAPI.getExpenses({ limit: 50 });
            setExpenses(data.data || []);
        } catch (error) {
            console.error('Error fetching expenses:', error);
            toast.error('Erro ao carregar despesas');
        }
    }, []);

    // Fetch reports
    const fetchReports = useCallback(async () => {
        try {
            setIsLoadingReports(true);
            const now = new Date();
            const startDate = new Date();

            if (selectedPeriod === '1m') startDate.setMonth(now.getMonth() - 1);
            else if (selectedPeriod === '3m') startDate.setMonth(now.getMonth() - 3);
            else if (selectedPeriod === '6m') startDate.setMonth(now.getMonth() - 6);
            else if (selectedPeriod === '1y') startDate.setFullYear(now.getFullYear() - 1);

            const [profitLoss, roomRevenue] = await Promise.all([
                hospitalityAPI.getProfitLossReport(
                    startDate.toISOString().split('T')[0],
                    now.toISOString().split('T')[0]
                ),
                hospitalityAPI.getByRoomReport(
                    startDate.toISOString().split('T')[0],
                    now.toISOString().split('T')[0]
                )
            ]);

            setProfitLossReport(profitLoss);
            setRoomRevenueReport(roomRevenue);
        } catch (error) {
            console.error('Error fetching reports:', error);
            toast.error('Erro ao carregar relatórios');
        } finally {
            setIsLoadingReports(false);
        }
    }, [selectedPeriod]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    useEffect(() => {
        if (activeTab === 'revenues') {
            fetchRevenues();
        } else if (activeTab === 'expenses') {
            fetchExpenses();
        } else if (activeTab === 'reports') {
            fetchReports();
        }
    }, [activeTab, fetchRevenues, fetchExpenses, fetchReports]);

    // Filtered revenues
    const filteredRevenues = useMemo(() => {
        return revenues.filter((revenue) => {
            const description = revenue.description || '';
            const category = revenue.category || '';
            const reference = revenue.reference || '';

            const matchesSearch = description.toLowerCase().includes(searchQueryRevenue.toLowerCase()) ||
                category.toLowerCase().includes(searchQueryRevenue.toLowerCase()) ||
                reference.toLowerCase().includes(searchQueryRevenue.toLowerCase());
            const matchesStatus = filterStatusRevenue === 'all' || revenue.status === filterStatusRevenue;
            return matchesSearch && matchesStatus;
        });
    }, [revenues, searchQueryRevenue, filterStatusRevenue]);

    // Filtered expenses
    const filteredExpenses = useMemo(() => {
        return expenses.filter((expense) => {
            const matchesSearch = expense.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                expense.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                expense.reference?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = filterStatus === 'all' || expense.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [expenses, searchQuery, filterStatus]);

    // Pagination hooks
    const revenuePagination = usePagination(filteredRevenues, 5);
    const expensePagination = usePagination(filteredExpenses, 5);

    // Reports data for pagination
    const revenueByCatArray = useMemo(() =>
        Object.entries(profitLossReport?.revenues?.byCategory || {}).map(([category, data]: any) => ({
            category,
            ...data
        })), [profitLossReport]);

    const expenseByCatArray = useMemo(() =>
        Object.entries(profitLossReport?.expenses?.byCategory || {}).map(([category, data]: any) => ({
            category,
            ...data
        })), [profitLossReport]);

    const roomsReportArray = useMemo(() =>
        roomRevenueReport?.rooms || [], [roomRevenueReport]);

    const revenueCatPagination = usePagination(revenueByCatArray, 5);
    const expenseCatPagination = usePagination(expenseByCatArray, 5);
    const roomRevenuePagination = usePagination(roomsReportArray, 5);

    // Transform data for charts
    const monthlyData = useMemo(() => {
        if (!dashboard?.monthlyTrend) return [];
        return dashboard.monthlyTrend.map((item: any) => ({
            month: item.month.slice(-2),
            receitas: item.revenue,
            despesas: item.expense,
            lucro: item.profit
        }));
    }, [dashboard]);

    const categoryData = useMemo(() => {
        if (!dashboard?.revenueByCategory) return [];
        return Object.entries(dashboard.revenueByCategory).map(([name, value]: any) => ({
            name: name === 'accommodation' ? 'Hospedagem' : name === 'consumption' ? 'Consumos' : name,
            value: value
        }));
    }, [dashboard]);

    const expenseCategoryData = useMemo(() => {
        if (!dashboard?.expensesByCategory) return [];
        return Object.entries(dashboard.expensesByCategory).map(([name, value]: any) => ({
            name: expenseCategories.find(c => c.value === name)?.label || name,
            value: value
        }));
    }, [dashboard]);

    // Calculate pending expenses
    const pendingExpenses = useMemo(() => {
        return expenses
            .filter(e => e.status === 'pending')
            .reduce((sum, e) => sum + Number(e.amount), 0);
    }, [expenses]);

    const handleDeleteExpense = async (id: string) => {
        if (!confirm('Tem certeza que deseja eliminar esta despesa?')) return;

        try {
            await hospitalityAPI.deleteExpense(id);
            toast.success('Despesa eliminada com sucesso!');
            fetchExpenses();
            fetchDashboard();
        } catch (error: unknown) {
            console.error('Error deleting expense:', error);
            toast.error(error.response?.data?.message || 'Erro ao eliminar despesa');
        }
    };

    const handleMarkAsPaid = async (id: string) => {
        try {
            await hospitalityAPI.updateExpense(id, { status: 'completed' });
            toast.success('Despesa marcada como paga!');
            fetchExpenses();
            fetchDashboard();
        } catch (error: unknown) {
            console.error('Error updating expense:', error);
            toast.error(error.response?.data?.message || 'Erro ao atualizar despesa');
        }
    };

    return {
        isLoading,
        dashboard,
        revenues: filteredRevenues,
        expenses: filteredExpenses,
        revenuePagination,
        expensePagination,
        profitLossReport,
        roomRevenueReport,
        isLoadingReports,
        revenueByCatArray,
        expenseByCatArray,
        roomsReportArray,
        revenueCatPagination,
        expenseCatPagination,
        roomRevenuePagination,
        monthlyData,
        categoryData,
        expenseCategoryData,
        pendingExpenses,
        searchQuery,
        setSearchQuery,
        filterStatus,
        setFilterStatus,
        searchQueryRevenue,
        setSearchQueryRevenue,
        filterStatusRevenue,
        setFilterStatusRevenue,
        fetchDashboard,
        fetchRevenues,
        fetchExpenses,
        fetchReports,
        handleDeleteExpense,
        handleMarkAsPaid
    };
}
