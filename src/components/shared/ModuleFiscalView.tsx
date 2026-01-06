import { useState, useEffect } from 'react';
import { Card, Badge, LoadingSpinner, EmptyState, Button } from '../ui';
import { HiOutlineChartBar, HiOutlineDocumentReport, HiOutlineFilter, HiOutlineExternalLink } from 'react-icons/hi';
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
                <Card className="bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/10 dark:to-dark-800">
                    <div className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Faturado Total ({title})</p>
                            <h3 className="text-2xl font-bold text-primary-600 dark:text-primary-400 mt-1">
                                {formatCurrency(metrics?.totalInvoiced || 0)}
                            </h3>
                        </div>
                        <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                            <HiOutlineChartBar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-white dark:from-red-900/10 dark:to-dark-800 border-red-100 dark:border-red-900/30">
                    <div className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">IVA Apurado</p>
                            <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                                {formatCurrency(metrics?.ivaPayable || 0)}
                            </h3>
                        </div>
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                            <Badge variant="danger" className="animate-pulse">Pendente</Badge>
                        </div>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/10 dark:to-dark-800 border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Retenções na Fonte</p>
                            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                                {formatCurrency(metrics?.retentions || 0)}
                            </h3>
                        </div>
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                            <HiOutlineDocumentReport className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Recent Retentions / Tax Events */}
            <Card padding="none" className="overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-dark-700 flex items-center gap-2 bg-gray-50/50 dark:bg-dark-800/50">
                    <HiOutlineDocumentReport className="w-5 h-5 text-primary-500" />
                    <h3 className="font-bold text-gray-900 dark:text-white">Retenções e Eventos Fiscais Recentes</h3>
                </div>
                <div className="p-4">
                    {retentions.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-100 dark:border-dark-700">
                                        <th className="px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Data</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Tipo</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300">Beneficiário</th>
                                        <th className="px-4 py-3 text-sm font-semibold text-gray-600 dark:text-gray-300 text-right">Valor Retido</th>
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
                            description="Não há registros de retenção na fonte para este período ou módulo."
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
