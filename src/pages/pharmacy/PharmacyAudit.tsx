import { useState, useMemo } from 'react';
import { Card, Button, Input, Badge, PageHeader } from '../../components/ui';
import {
    HiOutlineDocumentChartBar as HiOutlineDocumentReport,
    HiOutlineShieldCheck,
    HiOutlineArrowTrendingUp as HiOutlineTrendingUp,
    HiOutlineClipboardDocumentList as HiOutlineClipboardList,
    HiOutlineArrowDownTray as HiOutlineDownload,
    HiOutlineCalendar,
    HiOutlineExclamationCircle,
    HiOutlineCurrencyDollar,
    HiOutlineArchiveBox as HiOutlineArchive
} from 'react-icons/hi2';
import { usePharmacy } from '../../hooks/usePharmacy';
import { usePharmacySales } from '../../hooks/usePharmacySales';
import { formatDate, formatCurrency, formatDateTime } from '../../utils/helpers';
import { pharmacyAPI } from '../../services/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useStore } from '../../stores/useStore';

export default function PharmacyAudit() {
    const { companySettings } = useStore();
    const [period, setPeriod] = useState({ start: '', end: '' });

    // Fetch controlled medications (static list, no period filter)
    const { medications, isLoading: isMedsLoading } = usePharmacy({ isControlled: true, limit: 500 });

    // Fetch sales filtered server-side by period
    const { sales, isLoading: isSalesLoading } = usePharmacySales({
        startDate: period.start || undefined,
        endDate: period.end || undefined,
        limit: 500,
    });

    const [isMovementsLoading, setIsMovementsLoading] = useState(false);
    const [isProfitLoading, setIsProfitLoading] = useState(false);

    const controlledMedications = useMemo(() => {
        return medications.filter((m: any) => m.isControlled);
    }, [medications]);

    const sarrRecords = useMemo(() => {
        // Sales are already date-filtered by the server; filter by controlled medications only
        return sales.filter((sale: any) =>
            sale.items?.some((item: any) => {
                const med = medications.find((m: any) => m.productId === item.batch?.medication?.productId);
                return med?.isControlled;
            })
        );
    }, [sales, medications]);

    // Calculate total profit - sales already date-filtered by server
    const profitabilityMetrics = useMemo(() => {
        let totalRevenue = 0;
        let totalCost = 0;

        sales.forEach((sale: any) => {
            sale.items?.forEach((item: any) => {
                const med = medications.find((m: any) => m.productId === item.batch?.medication?.productId);
                if (!med) return;
                totalRevenue += item.quantity * (item.unitPrice || med.product?.price || 0);
                totalCost += item.quantity * (item.batch?.costPrice || med.product?.costPrice || 0);
            });
        });

        return {
            revenue: totalRevenue,
            cost: totalCost,
            profit: totalRevenue - totalCost,
            margin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
            transactions: sales.length
        };
    }, [sales, medications]);

    const handleExportSARR = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.width;

        // Header
        doc.setFontSize(14);
        doc.text(companySettings?.companyName || 'Farmácia', pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(16);
        doc.text('MODELO S.A.R.R', pageWidth / 2, 22, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Substâncias de Acção de Risco Relevante - Período: ${period.start || 'Início'} a ${period.end || 'Fim'}`, pageWidth / 2, 28, { align: 'center' });

        const tableData: any[][] = [];
        sarrRecords.forEach((sale: any) => {
            sale.items.forEach((item: any) => {
                const med = medications.find((m: any) => m.productId === item.batch?.medication?.productId);
                if (med?.isControlled) {
                    tableData.push([
                        formatDate(sale.createdAt),
                        sale.customerName || 'Cliente Balcão',
                        med.product?.name ?? '-',
                        item.batch?.batchNumber || '-',
                        item.quantity.toString(),
                        sale.prescription?.prescriptionNumber || sale.prescription?.prescriptionNo || '-',
                        sale.soldBy || 'Farmacêutico Responsável'
                    ]);
                }
            });
        });

        autoTable(doc, {
            startY: 35,
            head: [['Data', 'Paciente/Cliente', 'Medicamento', 'Lote', 'Qtd', 'Nº Receita', 'Observação']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [185, 28, 28] }, // Red for SARR
            styles: { fontSize: 8 },
        });

        doc.save(`relatorio_sarr_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('Relatório SARR exportado com sucesso!');
    };

    const handleExportProfitability = () => {
        setIsProfitLoading(true);
        try {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;

            // Header
            doc.setFontSize(14);
            doc.text(companySettings?.companyName || 'Farmácia', pageWidth / 2, 15, { align: 'center' });
            doc.setFontSize(16);
            doc.text('Relatório de Lucratividade', pageWidth / 2, 22, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Análise de Margens - ${period.start || 'Início'} a ${period.end || 'Fim'}`, pageWidth / 2, 28, { align: 'center' });

            const profitData: any = {};

            sales.forEach((sale: any) => {
                sale.items?.forEach((item: any) => {
                    const med = medications.find((m: any) => m.productId === item.batch?.medication?.productId);
                    if (!med) return;

                    const id = med.id;
                    if (!profitData[id]) {
                        profitData[id] = {
                            name: med.product?.name ?? '',
                            qty: 0,
                            revenue: 0,
                            cost: 0,
                            profit: 0
                        };
                    }

                    const itemRevenue = item.quantity * (item.unitPrice || med.product?.price || 0);
                    const itemCost = item.quantity * (item.batch?.costPrice || med.product?.costPrice || 0);

                    profitData[id].qty += item.quantity;
                    profitData[id].revenue += itemRevenue;
                    profitData[id].cost += itemCost;
                    profitData[id].profit += (itemRevenue - itemCost);
                });
            });

            const tableData = Object.values(profitData).map((d: any) => [
                d.name,
                d.qty.toString(),
                formatCurrency(d.revenue),
                formatCurrency(d.cost),
                formatCurrency(d.profit),
                `${d.revenue > 0 ? ((d.profit / d.revenue) * 100).toFixed(1) : '0'}%`
            ]).sort((a: any, b: any) => parseFloat(b[4].replace(/[^0-9.-]+/g, "")) - parseFloat(a[4].replace(/[^0-9.-]+/g, "")));

            autoTable(doc, {
                startY: 35,
                head: [['Medicamento', 'Qtd', 'Receita', 'Custo Total', 'Lucro', 'Margem']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129] },
                styles: { fontSize: 8 },
            });

            doc.save(`relatorio_lucratividade_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success('Relatório de Lucratividade exportado com sucesso!');
        } finally {
            setIsProfitLoading(false);
        }
    };

    const handleExportAuditLog = async () => {
        try {
            setIsMovementsLoading(true);
            const response = await pharmacyAPI.getStockMovements({
                startDate: period.start || undefined,
                endDate: period.end || undefined,
                limit: 2000
            });

            const movementsData = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);

            if (movementsData.length === 0) {
                toast.error('Nenhum movimento encontrado no período selecionado');
                return;
            }

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.width;

            doc.setFontSize(14);
            doc.text(companySettings?.companyName || 'Farmácia', pageWidth / 2, 15, { align: 'center' });
            doc.setFontSize(16);
            doc.text('Log de Auditoria de Stock', pageWidth / 2, 22, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Período: ${period.start || 'Início'} a ${period.end || 'Fim'}`, pageWidth / 2, 28, { align: 'center' });

            const tableData = movementsData.map((mov: any) => [
                formatDateTime(mov.createdAt),
                mov.batch?.batchNumber || '-',
                mov.type?.toUpperCase() || '-',
                mov.quantity?.toString() || '0',
                mov.reason || '-',
                mov.user?.name || 'Sistema'
            ]);

            autoTable(doc, {
                startY: 35,
                head: [['Data/Hora', 'Lote', 'Tipo', 'Qtd', 'Motivo', 'Utilizador']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229] },
                styles: { fontSize: 7 },
            });

            doc.save(`audit_log_farmacia_${new Date().toISOString().split('T')[0]}.pdf`);
            toast.success('Audit Log exportado com sucesso!');
        } catch (error) {
            toast.error('Erro ao gerar log de auditoria');
        } finally {
            setIsMovementsLoading(false);
        }
    };

    const isLoading = isMedsLoading || isSalesLoading;

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <PageHeader 
                title="Auditoria & Conformidade SARR"
                subtitle="Relatórios regulatórios, controlo de substâncias e análise de performance"
                icon={<HiOutlineClipboardList />}
                actions={
                    <Card className="p-4 bg-gray-50 dark:bg-dark-800 border-0 shadow-sm grow-0 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-gray-500">
                                <HiOutlineCalendar className="w-5 h-5" />
                                <span className="text-xs font-bold uppercase tracking-wider">Período:</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="date"
                                    value={period.start}
                                    onChange={e => setPeriod({ ...period, start: e.target.value })}
                                    className="w-36 text-sm"
                                />
                                <span className="text-gray-400">até</span>
                                <Input
                                    type="date"
                                    value={period.end}
                                    onChange={e => setPeriod({ ...period, end: e.target.value })}
                                    className="w-36 text-sm"
                                />
                            </div>
                        </div>
                    </Card>
                }
            />

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-5 border-l-4 border-red-500 bg-red-50 dark:bg-red-900/10">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Itens Controlados</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">
                                {isLoading ? '...' : controlledMedications.length}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Substâncias SARR em stock</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                            <HiOutlineExclamationCircle className="w-6 h-6 text-red-600" />
                        </div>
                    </div>
                </Card>

                <Card className="p-5 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/10">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Vendas (Período)</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">
                                {isLoading ? '...' : sarrRecords.length}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Transações com controlados</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                            <HiOutlineArchive className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </Card>

                <Card className="p-5 border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Lucro Bruto</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">
                                {isLoading ? '...' : formatCurrency(profitabilityMetrics.profit)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Margem: {profitabilityMetrics.margin.toFixed(1)}%</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                            <HiOutlineCurrencyDollar className="w-6 h-6 text-emerald-600" />
                        </div>
                    </div>
                </Card>

                <Card className="p-5 border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/10">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Total Vendas</p>
                            <p className="text-3xl font-black text-gray-900 dark:text-white mt-1">
                                {isLoading ? '...' : profitabilityMetrics.transactions}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Transações no período</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                            <HiOutlineTrendingUp className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Report Actions Grid */}
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <HiOutlineDownload className="w-5 h-5 text-gray-400" />
                    Exportar Relatórios
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* SARR Report Card */}
                    <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-0 bg-red-600">
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        <div className="p-6 relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-14 h-14 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <HiOutlineShieldCheck className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-white">Modelo S.A.R.R</h4>
                                    <Badge variant="outline" className="border-white/50 text-white text-[10px] mt-1">
                                        OBRIGATÓRIO
                                    </Badge>
                                </div>
                            </div>
                            <p className="text-white/80 text-sm mb-6">
                                Relatório oficial de substâncias controladas e psicotrópicas exigido pela INFARMED.
                            </p>
                            <Button
                                variant="secondary"
                                className="w-full bg-white text-red-600 hover:bg-white/90 font-bold"
                                leftIcon={<HiOutlineDocumentReport className="w-5 h-5" />}
                                onClick={handleExportSARR}
                                disabled={isLoading}
                            >
                                {isLoading ? 'A carregar...' : 'Exportar SARR (PDF)'}
                            </Button>
                        </div>
                    </Card>

                    {/* Profitability Card */}
                    <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-0 bg-emerald-600">
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        <div className="p-6 relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-14 h-14 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <HiOutlineTrendingUp className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-white">Lucratividade</h4>
                                    <Badge variant="outline" className="border-white/50 text-white text-[10px] mt-1">
                                        FINANCEIRO
                                    </Badge>
                                </div>
                            </div>
                            <p className="text-white/80 text-sm mb-6">
                                Análise detalhada de margens de lucro por medicamento e performance comercial.
                            </p>
                            <Button
                                variant="secondary"
                                className="w-full bg-white text-emerald-600 hover:bg-white/90 font-bold"
                                leftIcon={<HiOutlineDocumentReport className="w-5 h-5" />}
                                onClick={handleExportProfitability}
                                disabled={isProfitLoading}
                            >
                                {isProfitLoading ? 'Gerando...' : 'Exportar Relatório'}
                            </Button>
                        </div>
                    </Card>

                    {/* Audit Log Card */}
                    <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-0 bg-indigo-600">
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        <div className="p-6 relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-14 h-14 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <HiOutlineClipboardList className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg text-white">Audit Log</h4>
                                    <Badge variant="outline" className="border-white/50 text-white text-[10px] mt-1">
                                        RASTREABILIDADE
                                    </Badge>
                                </div>
                            </div>
                            <p className="text-white/80 text-sm mb-6">
                                Histórico completo de movimentações, ajustes e alterações de stock.
                            </p>
                            <Button
                                variant="secondary"
                                className="w-full bg-white text-indigo-600 hover:bg-white/90 font-bold"
                                leftIcon={<HiOutlineDocumentReport className="w-5 h-5" />}
                                onClick={handleExportAuditLog}
                                disabled={isMovementsLoading}
                            >
                                {isMovementsLoading ? 'Gerando...' : 'Exportar Audit Log'}
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
