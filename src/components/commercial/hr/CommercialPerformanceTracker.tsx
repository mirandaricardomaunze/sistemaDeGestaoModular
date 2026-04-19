import { useState, useEffect } from 'react';
import { 
    ResponsiveContainer, 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartTooltip, 
    Legend
} from 'recharts';
import { 
    HiOutlineChartBar, 
    HiOutlineTrophy, 
    HiOutlineUserGroup, 
    HiOutlineArrowTrendingUp,
    HiOutlineStar
} from 'react-icons/hi2';
import { Card, Badge, Button } from '../../ui';
import { employeesAPI } from '../../../services/api';
import type { Employee } from '../../../types';
import { logger } from '../../../utils/logger';

// Mock data for initial rendering
const performanceData = [
    { name: 'Ricardo', ventas: 450000, meta: 500000, conversion: 15 },
    { name: 'Maria', ventas: 680000, meta: 600000, conversion: 22 },
    { name: 'Joaquim', ventas: 320000, meta: 400000, conversion: 12 },
    { name: 'Ana', ventas: 890000, meta: 750000, conversion: 28 },
    { name: 'Carlos', ventas: 120000, meta: 300000, conversion: 8 },
];

export function CommercialPerformanceTracker() {
    const [_employees, setEmployees] = useState<Employee[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const response = await employeesAPI.getAll({ department: 'vendas' });
            setEmployees(Array.isArray(response) ? response : (response.data || []));
        } catch (error) {
            logger.error('Error fetching employees:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-12 text-center bg-white dark:bg-dark-700 rounded-lg border border-dashed border-gray-200 dark:border-dark-700">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">A processar dados de performance...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineChartBar className="text-primary-500" />
                        Tracker de Performance Comercial
                    </h2>
                    <p className="text-gray-500">Métricas individuais e ranking de vendas em tempo real</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm">Este Mês</Button>
                    <Button variant="outline" size="sm">Exportar KPIs</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Performance Chart */}
                <Card className="lg:col-span-2 p-6 overflow-visible">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <HiOutlineArrowTrendingUp className="text-primary-500" />
                        Vendas vs Metas Individuais
                    </h4>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={performanceData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <RechartTooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend iconType="circle" />
                                <Bar dataKey="ventas" name="Vendas Atuais" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="meta" name="Meta Estipulada" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Leaderboard Section */}
                <Card className="p-6">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                        <HiOutlineTrophy className="text-yellow-500" />
                        Top Performers
                    </h4>
                    <div className="space-y-4">
                        {[...performanceData].sort((a, b) => b.ventas - a.ventas).slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-dark-800 border border-gray-100 dark:border-dark-700">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white
                                    ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : 'bg-orange-400'}`}>
                                    {idx + 1}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                                    <p className="text-xs text-gray-500">{item.ventas.toLocaleString()} MT</p>
                                </div>
                                <div className="text-right">
                                    <Badge variant="success">+{Math.round((item.ventas/item.meta - 1) * 100)}%</Badge>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 p-4 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-100 dark:border-primary-800">
                        <div className="flex items-center gap-2 text-primary-700 dark:text-primary-400 font-bold mb-2">
                            <HiOutlineStar />
                            <span>Insight IA</span>
                        </div>
                        <p className="text-xs text-primary-600 dark:text-primary-300 leading-relaxed">
                            A equipa est a operar a <strong>92% da meta global</strong>. Sugerimos focar em {[...performanceData].sort((a,b)=>a.conversion-b.conversion)[0]?.name} para melhorar taxas de conversão.
                        </p>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               {performanceData.map((item, idx) => (
                   <Card key={idx} className="p-4 hover:border-primary-200 transition-colors">
                       <div className="flex justify-between items-start mb-3">
                           <div className="p-2 bg-gray-100 dark:bg-dark-800 rounded-lg">
                               <HiOutlineUserGroup className="text-gray-600" />
                           </div>
                           <Badge variant={item.ventas >= item.meta ? 'success' : 'warning'}>
                               {item.ventas >= item.meta ? 'Acima da Meta' : 'Em Progresso'}
                           </Badge>
                       </div>
                       <h5 className="font-bold text-gray-900 dark:text-white">{item.name}</h5>
                       <div className="mt-4 space-y-2">
                           <div className="flex justify-between text-xs text-gray-500">
                               <span>Progresso</span>
                               <span>{Math.round((item.ventas/item.meta) * 100)}%</span>
                           </div>
                           <div className="w-full h-1.5 bg-gray-100 dark:bg-dark-800 rounded-full overflow-hidden">
                               <div 
                                    className={`h-full rounded-full ${item.ventas >= item.meta ? 'bg-green-500' : 'bg-primary-500'}`}
                                    style={{ width: `${Math.min(100, (item.ventas/item.meta) * 100)}%` }}
                                />
                           </div>
                       </div>
                   </Card>
               ))}
            </div>
        </div>
    );
}
