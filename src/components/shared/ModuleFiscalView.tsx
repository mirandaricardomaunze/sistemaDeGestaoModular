import { useState, useEffect } from 'react';
import { Card, Badge, LoadingSpinner, EmptyState, Button } from '../ui';
import { 
    HiOutlineChartBar, 
    HiOutlineDocumentText as HiOutlineDocumentReport, 
    HiOutlineFunnel as HiOutlineFilter, 
    HiOutlineArrowTopRightOnSquare as HiOutlineExternalLink 
} from 'react-icons/hi2';
import { fiscalAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import PaymentGuidePrint from './PaymentGuidePrint';
import Modelo10Print from './Modelo10Print';

interface ModuleFiscalViewProps {
    module: string;
    title: string;
}

export default function ModuleFiscalView({ module, title }: ModuleFiscalViewProps) {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [retentions, setRetentions] = useState<any[]>([]);
    const [showGuide, setShowGuide] = useState(false);
    const [showModelo10, setShowModelo10] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Simulating metrics for now
                setTimeout(() => {
                    setMetrics({
                        totalInvoiced: 1250000,
                        ivaPayable: 200000,
                        retentions: 45000,
                        lastSubmission: new Date().toISOString()
                    });
                    setLoading(false);
                }, 800);

                const retentionRes = await fiscalAPI.getRetentions();
                setRetentions(retentionRes.filter((r: any) => r.module === module));
            } catch (err: any) {
                toast.error('Erro ao buscar dados fiscais');
                setLoading(false);
            }
        };

        fetchData();
    }, [module]);

    if (loading) return <div className="flex justify-center p-12"><LoadingSpinner size="lg" /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Module Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card variant="glass" className="border-l-4 border-l-primary-500 p-6 group transition-all hover:translate-y-[-2px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg group-hover:scale-110 transition-transform">
                            <HiOutlineChartBar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="h-1.5 w-10 rounded-full bg-primary-100" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Faturado Total ({title})</p>
                    <h3 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white">
                        {formatCurrency(metrics?.totalInvoiced || 0)}
                    </h3>
                </Card>

                <Card variant="glass" className="border-l-4 border-l-red-500 p-6 group transition-all hover:translate-y-[-2px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg group-hover:scale-110 transition-transform">
                            <Badge variant="danger" className="animate-pulse font-black text-[9px] uppercase tracking-widest">Pendente</Badge>
                        </div>
                        <div className="h-1.5 w-10 rounded-full bg-red-100" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">IVA Apurado</p>
                    <h3 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white">
                        {formatCurrency(metrics?.ivaPayable || 0)}
                    </h3>
                </Card>

                <Card variant="glass" className="border-l-4 border-l-amber-500 p-6 group transition-all hover:translate-y-[-2px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg group-hover:scale-110 transition-transform">
                            <HiOutlineDocumentReport className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="h-1.5 w-10 rounded-full bg-amber-100" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">Retenções na Fonte</p>
                    <h3 className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white">
                        {formatCurrency(metrics?.retentions || 0)}
                    </h3>
                </Card>
            </div>

            {/* Recent Retentions / Tax Events */}
            <Card variant="glass" padding="none" className="overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-dark-700/50 flex items-center justify-between bg-white/30 dark:bg-dark-900/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                            <HiOutlineDocumentReport className="w-5 h-5 text-primary-600" />
                        </div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-gray-300">
                            Retenções e Eventos Fiscais Recentes
                        </h3>
                    </div>
                </div>
                <div className="p-4">
                    {retentions.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/80 dark:bg-dark-800/80 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-dark-700/50 whitespace-nowrap">
                                        <th className="px-6 py-4 font-black">Data</th>
                                        <th className="px-6 py-4 font-black">Tipo</th>
                                        <th className="px-6 py-4 font-black">Beneficiário</th>
                                        <th className="px-6 py-4 text-right font-black">Valor Retido</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {retentions.map((r: any) => (
                                        <tr key={r.id} className="border-b border-gray-50 dark:border-dark-700/50 hover:bg-gray-50/50 dark:hover:bg-dark-700/30 transition-colors">
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{formatDate(r.createdAt)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                <Badge variant="outline">{r.type}</Badge>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{r.beneficiary}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-right">{formatCurrency(r.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState
                            title="Nenhuma retenção encontrada"
                            description="Não h registros de retenção na fonte para este período ou módulo."
                            icon={<HiOutlineFilter className="w-12 h-12 text-gray-300" />}
                        />
                    )}
                </div>
            </Card>

            {/* Quick Actions */}
            <div className="flex justify-end gap-3">
                <Button variant="outline" leftIcon={<HiOutlineExternalLink />} onClick={() => setShowGuide(true)}>
                    Ver Guia de Pagamento
                </Button>
                <Button variant="primary" leftIcon={<HiOutlineDocumentReport />} onClick={() => setShowModelo10(true)}>
                    Gerar Relatório Modelo 10
                </Button>
            </div>

            {/* Payment Guide Modal */}
            {metrics && (
                <PaymentGuidePrint
                    isOpen={showGuide}
                    onClose={() => setShowGuide(false)}
                    metrics={metrics}
                    moduleTitle={title}
                />
            )}

            {/* Modelo 10 Modal */}
            <Modelo10Print
                isOpen={showModelo10}
                onClose={() => setShowModelo10(false)}
                retentions={retentions}
                moduleTitle={title}
            />
        </div>
    );
}
