import React, { useState, useEffect, Fragment, useCallback } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { 
    HiOutlineClock,
    HiOutlineArrowDownTray,
    HiOutlinePrinter, 
    HiOutlineEye, 
    HiOutlineCheckCircle, 
    HiOutlineXCircle,
    HiOutlineUser,
    HiOutlineArrowTrendingUp,
    HiOutlineArrowTrendingDown,
    HiOutlineCurrencyDollar,
    HiOutlineArrowPath,
    HiOutlineDocumentText,
    HiOutlineHome
} from 'react-icons/hi2';
import { shiftAPI, warehousesAPI, type ShiftSession as CashSession, type ShiftZReport } from '../../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, Badge, Button, Input, Select, SimpleTable } from '../../components/ui';
import Pagination from '../../components/ui/Pagination';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, cn } from '../../utils/helpers';
import { CommercialShiftDetailsModal } from '../../components/commercial/pos/CommercialShiftDetailsModal';
import { logger } from '../../utils/logger';
import { useTenant } from '../../contexts/TenantContext';
import { useDebounce } from '../../hooks/useDebounce';
import { MetricCard } from '../../components/common/ModuleMetricCard';
import { PAGE_SIZE } from '../../utils/constants';
import { useQuery } from '@tanstack/react-query';
import { getApiErrorMessage } from '../../utils/apiError';

type AutoTableDocument = jsPDF & {
    lastAutoTable?: {
        finalY: number;
    };
};

type WarehouseOption = {
    id: string;
    name: string;
};

type WarehousesResponse = WarehouseOption[] | {
    data?: WarehouseOption[];
};

const getWarehouseRows = (response: WarehousesResponse): WarehouseOption[] => (
    Array.isArray(response) ? response : response.data ?? []
);

const getLastTableY = (doc: AutoTableDocument): number => doc.lastAutoTable?.finalY ?? 0;

const CommercialShiftHistory: React.FC = () => {
    const { company } = useTenant();
    const [sessions, setSessions] = useState<CashSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [dateRange, setDateRange] = useState({
        start: format(new Date(), 'yyyy-MM-01'),
        end: format(new Date(), 'yyyy-MM-dd')
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [warehouseId, setWarehouseId] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);

    const [selectedSession, setSelectedSession] = useState<CashSession | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);

    const { data: warehouses = [] } = useQuery<WarehouseOption[]>({
        queryKey: ['warehouses'],
        queryFn: async () => {
            const data = await warehousesAPI.getAll() as WarehousesResponse;
            return getWarehouseRows(data);
        },
    });

    const loadHistory = useCallback(async (pageNum = 1) => {
        try {
            setLoading(true);
            const response = await shiftAPI.getHistory({
                startDate: dateRange.start,
                endDate: dateRange.end,
                page: pageNum,
                limit: PAGE_SIZE,
                warehouseId: warehouseId || undefined,
                search: debouncedSearch || undefined
            });
            const sessionsData = response?.data || (Array.isArray(response) ? response : []);
            setSessions(sessionsData);
            setTotal(response?.pagination?.total || sessionsData.length);
        } catch (err) {
            logger.error('Error loading commercial shift history:', err);
            toast.error(getApiErrorMessage(err, 'Erro ao carregar histÃ³rico de turnos'));
        } finally {
            setLoading(false);
        }
    }, [dateRange.end, dateRange.start, debouncedSearch, warehouseId]);

    useEffect(() => {
        loadHistory(page);
    }, [loadHistory, page]);

    const applyFilters = () => {
        if (page === 1) loadHistory(1);
        else setPage(1);
    };

    const handleExport = () => {
        if (!sessions || sessions.length === 0) {
            toast.error('Nenhum dado para exportar');
            return;
        }

        const headers = ['Abertura', 'Fecho', 'Responsavel', 'Fundo Maneio', 'Total Vendas', 'Saldo Final', 'Diferenca'];
        const csvContent = [
            headers.join(','),
            ...sessions.map(s => {
                const diff = Number(s.difference || 0);
                return [
                    format(new Date(s.openedAt), 'dd/MM/yyyy HH:mm'),
                    s.closedAt ? format(new Date(s.closedAt), 'dd/MM/yyyy HH:mm') : 'Em aberto',
                    s.openedBy?.name || '',
                    Number(s.openingBalance || 0).toFixed(2),
                    Number(s.totalSales || 0).toFixed(2),
                    Number(s.closingBalance || 0).toFixed(2),
                    diff.toFixed(2)
                ].map(v => `"${v}"`).join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `historico_turnos_${dateRange.start}_${dateRange.end}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('HistÃ³rico exportado para CSV com sucesso');
    };

    const handleExportPDF = () => {
        if (!sessions || sessions.length === 0) {
            toast.error('Nenhum dado para exportar');
            return;
        }

        try {
            const doc = new jsPDF('p', 'mm', 'a4') as AutoTableDocument;
            
            // Header
            doc.setFontSize(18);
            doc.setTextColor(59, 84, 255); // Primary color
            doc.text(company?.name || "SISTEMA DE GESTAO MODULAR", 14, 22);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            let yPos = 30;
            if (company?.nuit) {
                doc.text(`NUIT: ${company.nuit}`, 14, yPos);
                yPos += 5;
            }
            if (company?.address) {
                doc.text(`${company.address}${company?.city ? `, ${company.city}` : ''}`, 14, yPos);
                yPos += 7;
            } else {
                yPos += 5;
            }
            
            doc.setFontSize(10);
            doc.text(`Data de EmissÃ£o: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, yPos);
            yPos += 10;
            
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text("RelatÃ³rio Oficial de Fechos de Caixa", 14, yPos);
            yPos += 5;
            doc.setFontSize(9);
            doc.text(`PerÃ­odo de ReferÃªncia: ${format(new Date(dateRange.start), 'dd/MM/yyyy')} a ${format(new Date(dateRange.end), 'dd/MM/yyyy')}`, 14, yPos);

            const totalFundo = sessions.reduce((acc, s) => acc + Number(s.openingBalance || 0), 0);
            const totalVendas = sessions.reduce((acc, s) => acc + Number(s.totalSales || 0), 0);
            const totalDiscrepancia = sessions.reduce((acc, s) => acc + Number(s.difference || 0), 0);

            // Summary Table
            autoTable(doc, {
                startY: yPos + 5,
                head: [['MÃ©tricas do PerÃ­odo', 'Valores Acumulados']],
                body: [
                    ['Total de Fundo de Maneio', formatCurrency(totalFundo)],
                    ['Total de Vendas (Turnos)', formatCurrency(totalVendas)],
                    ['BalanÃ§o de DiscrepÃ¢ncias', formatCurrency(totalDiscrepancia)]
                ],
                theme: 'grid',
                headStyles: { fillColor: [59, 84, 255], fontSize: 10 },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
                margin: { left: 14, right: 100 }
            });

            // Details Table
            const tableData = sessions.map(s => {
                const diff = Number(s.difference || 0);
                return [
                    format(new Date(s.openedAt), 'dd/MM/yyyy HH:mm'),
                    s.closedAt ? format(new Date(s.closedAt), 'dd/MM/yyyy HH:mm') : 'Em aberto',
                    s.openedBy?.name || '-',
                    formatCurrency(s.openingBalance),
                    formatCurrency(s.totalSales),
                    formatCurrency(s.closingBalance || 0),
                    formatCurrency(diff)
                ];
            });

            autoTable(doc, {
                startY: getLastTableY(doc) + 15,
                head: [['Abertura', 'Fecho', 'Operador', 'Fundo', 'Vendas', 'Caixa Final', 'Auditoria']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [40, 40, 40], fontSize: 8 },
                styles: { fontSize: 7, cellPadding: 2 },
                columnStyles: {
                    3: { halign: 'right' },
                    4: { halign: 'right' },
                    5: { halign: 'right' },
                    6: { halign: 'right', fontStyle: 'bold' }
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 6) {
                        const rawVal = sessions[data.row.index].difference || 0;
                        if (rawVal < 0) {
                            data.cell.styles.textColor = [239, 68, 68];
                        } else if (rawVal > 0) {
                            data.cell.styles.textColor = [16, 185, 129];
                        }
                    }
                }
            });

            doc.save(`Relatorio_Turnos_${dateRange.start}_a_${dateRange.end}.pdf`);
            toast.success('RelatÃ³rio PDF gerado com sucesso');
        } catch (error) {
            logger.error('Error generating PDF:', error);
            toast.error('Erro ao gerar ficheiro PDF');
        }
    };

    const handlePrintList = () => {
        if (!sessions || sessions.length === 0) {
            toast.error('Nenhum dado para imprimir');
            return;
        }

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>HistÃ³rico de Turnos</title>
                <style>
                    body { font-family: sans-serif; font-size: 12px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .text-red { color: #ef4444; }
                    .text-green { color: #10b981; }
                </style>
            </head>
            <body>
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="margin: 0; color: #3b54ff;">${company?.name || 'SISTEMA DE GESTÃƒO MODULAR'}</h1>
                    ${company?.nuit ? `<p style="margin: 2px 0; color: #666; font-size: 14px;">NUIT: ${company.nuit}</p>` : ''}
                    ${company?.address ? `<p style="margin: 2px 0; color: #666; font-size: 14px;">${company.address}</p>` : ''}
                </div>
                <h2>HistÃ³rico de Turnos (${format(new Date(dateRange.start), 'dd/MM/yyyy')} - ${format(new Date(dateRange.end), 'dd/MM/yyyy')})</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Abertura</th>
                            <th>Fecho</th>
                            <th>ResponsÃ¡vel</th>
                            <th class="text-right">Fundo de Maneio</th>
                            <th class="text-right">Total Vendas</th>
                            <th class="text-right">Saldo Final</th>
                            <th class="text-right">DiferenÃ§a</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sessions.map(s => {
                            const diff = Number(s.difference || 0);
                            return `
                                <tr>
                                    <td>${format(new Date(s.openedAt), 'dd/MM/yyyy HH:mm')}</td>
                                    <td>${s.closedAt ? format(new Date(s.closedAt), 'dd/MM/yyyy HH:mm') : 'Em aberto'}</td>
                                    <td>${s.openedBy?.name || '-'}</td>
                                    <td class="text-right">${formatCurrency(s.openingBalance)}</td>
                                    <td class="text-right">${formatCurrency(s.totalSales)}</td>
                                    <td class="text-right">${formatCurrency(s.closingBalance || 0)}</td>
                                    <td class="text-right ${diff < 0 ? 'text-red' : diff > 0 ? 'text-green' : ''}">${formatCurrency(diff)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                <script>
                    window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); }
                </script>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            toast.success('A abrir janela de impressÃ£o...');
        } else {
            toast.error('Por favor, permita pop-ups para imprimir');
        }
    };

    const handleViewDetails = async (session: CashSession) => {
        setSelectedSession(session);
        setShowDetailsModal(true);
        setDetailsLoading(true);
        try {
            const details = await shiftAPI.getDetails(session.id);
            setSelectedSession(details);
        } catch (error) {
            logger.error('Failed to load shift details', error);
            toast.error('Erro ao carregar detalhes do turno');
        } finally {
            setDetailsLoading(false);
        }
    };

    const handlePrintZReport = async (baseSession: CashSession) => {
        try {
            const report: ShiftZReport = await shiftAPI.getZReport(baseSession.id);
            const reportCompany = report.company || company;
            const session: CashSession = {
                ...baseSession,
                ...report.session,
                cashSales: report.byMethod.cash,
                mpesaSales: report.byMethod.mpesa,
                emolaSales: report.byMethod.emola,
                cardSales: report.byMethod.card,
                creditSales: report.byMethod.credit,
                totalSales: report.totalSales,
                withdrawals: report.totalWithdrawals,
                deposits: report.totalDeposits,
                expectedBalance: report.expectedBalance,
                closingBalance: report.closingBalance,
                difference: report.difference,
                movements: report.movements,
                sales: report.sales,
                _count: { sales: report.totalTransactions }
            };
            const doc = new jsPDF('p', 'mm', 'a4') as AutoTableDocument;
            const opened = session.openedAt ? new Date(session.openedAt) : null;
            const closed = session.closedAt ? new Date(session.closedAt) : null;
            const fmtDate = (d: Date | null) => d ? format(d, "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'â€”';
            const fmt = (n: number | undefined) => formatCurrency(Number(n || 0));
            const diff = Number(session.difference || 0);
            
            // Header
            doc.setFontSize(22);
            doc.setTextColor(59, 84, 255); // Primary color
            doc.text(reportCompany?.name || "SISTEMA DE GESTAO MODULAR", 14, 22);
            
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            let yPos = 30;
            if (reportCompany?.nuit) {
                doc.text(`NUIT: ${reportCompany.nuit}`, 14, yPos);
                yPos += 5;
            }
            if (reportCompany?.address) {
                doc.text(reportCompany.address, 14, yPos);
                yPos += 7;
            } else {
                yPos += 5;
            }
            
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text(`RelatÃ³rio Oficial de Fecho de Turno (Z-Report)`, 14, yPos);
            yPos += 6;
            
            doc.setFontSize(10);
            doc.text(`Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, yPos);
            yPos += 10;

            // Session Info
            autoTable(doc, {
                startY: yPos,
                head: [['Detalhes da SessÃ£o', '']],
                body: [
                    ['Aberto por', session.openedBy?.name || 'â€”'],
                    ['Aberto em', fmtDate(opened)],
                    ['Fechado por', session.closedBy?.name || 'â€”'],
                    ['Fechado em', fmtDate(closed)],
                    ['Total de Vendas Registadas', `${session._count?.sales || 0} Vendas`]
                ],
                theme: 'plain',
                headStyles: { fillColor: [240, 240, 240], textColor: [0,0,0] },
                columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
                margin: { left: 14, right: 14 }
            });

            const diffColor = diff < 0 ? [239, 68, 68] : diff > 0 ? [16, 185, 129] : [100, 100, 100];
            const diffText = diff < 0 ? 'Falta no Caixa' : diff > 0 ? 'Sobra no Caixa' : 'Sem DiscrepÃ¢ncias';

            // Financial Summary
            autoTable(doc, {
                startY: getLastTableY(doc) + 10,
                head: [['Resumo Financeiro', 'Valor']],
                body: [
                    ['Fundo de Maneio Inicial', fmt(session.openingBalance)],
                    ['(+) Suprimentos (Entradas)', fmt(session.deposits)],
                    ['(-) Sangrias (SaÃ­das)', fmt(session.withdrawals)],
                    ['Receitas (NumerÃ¡rio)', fmt(session.cashSales)],
                    ['Receitas (M-Pesa)', fmt(session.mpesaSales)],
                    ['Receitas (e-Mola)', fmt(session.emolaSales)],
                    ['Receitas (CartÃ£o/TPA)', fmt(session.cardSales)],
                    ['Receitas (CrÃ©dito)', fmt(session.creditSales)],
                    ['TOTAL FACTURADO', fmt(session.totalSales)],
                    ['', ''],
                    ['Saldo Esperado no Sistema', fmt(session.expectedBalance)],
                    ['Saldo Contado Fisicamente', fmt(session.closingBalance)],
                    [diffText, fmt(Math.abs(diff))]
                ],
                theme: 'striped',
                headStyles: { fillColor: [59, 84, 255] },
                columnStyles: { 1: { halign: 'right' } },
                didParseCell: function(data) {
                    if (data.row.index === 8) { // TOTAL FACTURADO
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.textColor = [0, 0, 0];
                    }
                    if (data.row.index === 10 || data.row.index === 11) { // Esperado / Contado
                        data.cell.styles.fontStyle = 'bold';
                    }
                    if (data.row.index === 12) { // DiferenÃ§a
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.textColor = diffColor as [number, number, number];
                    }
                },
                margin: { left: 14, right: 14 }
            });

            if (report.topProducts?.length) {
                autoTable(doc, {
                    startY: getLastTableY(doc) + 8,
                    head: [['Top Produtos', 'Qtd', 'Total']],
                    body: report.topProducts.slice(0, 8).map(product => [
                        product.name,
                        String(product.qty),
                        fmt(product.total)
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [30, 41, 59] },
                    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
                    margin: { left: 14, right: 14 }
                });
            }

            if (report.movements?.length) {
                autoTable(doc, {
                    startY: getLastTableY(doc) + 8,
                    head: [['Movimentos de Caixa', 'Responsavel', 'Valor']],
                    body: report.movements.map(movement => [
                        `${movement.type === 'suprimento' ? 'Suprimento' : 'Sangria'} - ${movement.reason}`,
                        movement.performedBy?.name || 'Sistema',
                        `${movement.type === 'suprimento' ? '+' : '-'} ${fmt(movement.amount)}`
                    ]),
                    theme: 'plain',
                    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
                    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
                    margin: { left: 14, right: 14 }
                });
            }

            if (session.notes) {
                const finalY = getLastTableY(doc);
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);
                doc.text("Notas do Operador:", 14, finalY + 15);
                doc.setFontSize(9);
                doc.setTextColor(80, 80, 80);
                const splitNotes = doc.splitTextToSize(session.notes.replace(/<[^>]*>?/gm, ''), 180);
                doc.text(splitNotes, 14, finalY + 20);
            }

            const signatureY = Math.max(getLastTableY(doc), session.notes ? 245 : 220) + 18;
            const safeSignatureY = signatureY > 265 ? 265 : signatureY;
            doc.setDrawColor(160, 160, 160);
            doc.line(14, safeSignatureY, 72, safeSignatureY);
            doc.line(78, safeSignatureY, 136, safeSignatureY);
            doc.line(142, safeSignatureY, 200, safeSignatureY);
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text('Operador', 35, safeSignatureY + 5);
            doc.text('Supervisor', 98, safeSignatureY + 5);
            doc.text('Conferencia', 162, safeSignatureY + 5);

            window.open(doc.output('bloburl'), '_blank');
            toast.success(`RelatÃ³rio Z profissional gerado com sucesso`);
            logger.debug('Generated professional Z-Report PDF for shift:', session.id);
        } catch (err) {
            logger.error('Professional Z-Report generation failed', err);
            toast.error('Erro ao gerar RelatÃ³rio Z');
        }
    };

    const getStatusBadge = (session: CashSession) => {
        const diff = Number(session.difference || 0);
        
        if (Math.abs(diff) < 0.01) {
            return (
                <Badge variant="success" className="text-[9px] font-black uppercase px-2 py-0.5 border-none bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <HiOutlineCheckCircle className="w-3 h-3 mr-1" />
                    Sem Quebras
                </Badge>
            );
        } else if (diff > 0) {
            return (
                <Badge variant="info" className="text-[9px] font-black uppercase px-2 py-0.5 border-none bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <HiOutlineArrowTrendingUp className="w-3 h-3 mr-1" />
                    Sobra: {formatCurrency(diff)}
                </Badge>
            );
        } else {
            return (
                <Badge variant="danger" className="text-[9px] font-black uppercase px-2 py-0.5 border-none bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    <HiOutlineArrowTrendingDown className="w-3 h-3 mr-1" />
                    Falta: {formatCurrency(Math.abs(diff))}
                </Badge>
            );
        }
    };

    return (
        <div className="space-y-4 animate-fade-in pb-10">
            {/* High Density Filters & Actions */}
            <Card padding="md" className="border-none shadow-none bg-white dark:bg-dark-900 border border-gray-100 dark:border-dark-700 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-3">
                        <Input 
                            label="Operador"
                            placeholder="Filtrar por nome..."
                            leftIcon={<HiOutlineUser className="h-4 w-4" />}
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                if (page !== 1) setPage(1);
                            }}
                            className="bg-gray-50 dark:bg-dark-800 border-none"
                            size="sm"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <Select
                            label="ArmazÃ©m"
                            value={warehouseId}
                            onChange={(e) => {
                                setWarehouseId(e.target.value);
                                if (page !== 1) setPage(1);
                            }}
                            leftIcon={<HiOutlineHome className="h-4 w-4" />}
                            options={[
                                { value: '', label: 'Todos' },
                                ...warehouses.map((warehouse) => ({
                                    value: warehouse.id,
                                    label: warehouse.name,
                                })),
                            ]}
                            className="bg-gray-50 dark:bg-dark-800 border-none"
                            size="sm"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <Input
                            label="InÃ­cio"
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => { setDateRange({...dateRange, start: e.target.value}); setPage(1); }}
                            className="bg-gray-50 dark:bg-dark-800 border-none"
                            size="sm"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <Input
                            label="Fim"
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => { setDateRange({...dateRange, end: e.target.value}); setPage(1); }}
                            className="bg-gray-50 dark:bg-dark-800 border-none"
                            size="sm"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <Button 
                            onClick={applyFilters} 
                            size="sm"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-500/20 border-none"
                        >
                            Filtrar
                        </Button>
                    </div>
                    
                    <div className="md:col-span-2 flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadHistory(page)}
                            className="h-10 px-3 bg-gray-50 dark:bg-dark-800 text-gray-400 hover:text-indigo-600"
                        >
                            <HiOutlineArrowPath className={cn("w-5 h-5", loading && "animate-spin")} />
                        </Button>

                        <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button as="div">
                                <Button 
                                    variant="primary" 
                                    className="h-10 rounded-lg font-bold text-xs bg-gray-900 dark:bg-dark-700 text-white hover:bg-black"
                                >
                                    <HiOutlineArrowDownTray className="w-4 h-4 mr-2" />
                                    Exportar
                                </Button>
                            </Menu.Button>
                            <Transition
                                as={Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                            >
                                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right divide-y divide-gray-100 dark:divide-dark-700 rounded-md bg-white dark:bg-dark-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                    <div className="px-1 py-1">
                                        <Menu.Item>
                                            {({ active }) => (
                                                <Button variant="ghost" onClick={handleExportPDF} className={cn(active ? 'bg-indigo-600 text-white' : 'text-gray-900 dark:text-gray-100', 'group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium')}>
                                                    <HiOutlineDocumentText className="mr-2 h-5 w-5" aria-hidden="true" /> Exportar PDF
                                                </Button>
                                            )}
                                        </Menu.Item>
                                        <Menu.Item>
                                            {({ active }) => (
                                                <Button variant="ghost" onClick={handleExport} className={cn(active ? 'bg-indigo-600 text-white' : 'text-gray-900 dark:text-gray-100', 'group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium')}>
                                                    <HiOutlineArrowDownTray className="mr-2 h-5 w-5" aria-hidden="true" /> Exportar CSV
                                                </Button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                    <div className="px-1 py-1">
                                        <Menu.Item>
                                            {({ active }) => (
                                                <Button variant="ghost" onClick={handlePrintList} className={cn(active ? 'bg-indigo-600 text-white' : 'text-gray-900 dark:text-gray-100', 'group flex w-full items-center rounded-md px-2 py-2 text-sm font-medium')}>
                                                    <HiOutlinePrinter className="mr-2 h-5 w-5" aria-hidden="true" /> Imprimir Lista
                                                </Button>
                                            )}
                                        </Menu.Item>
                                    </div>
                                </Menu.Items>
                            </Transition>
                        </Menu>
                    </div>
                </div>
            </Card>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard
                    icon={<HiOutlineCurrencyDollar className="w-5 h-5" />}
                    color="primary"
                    value={formatCurrency(sessions.reduce((acc, s) => acc + Number(s.closingBalance || 0), 0))}
                    label="Total em Caixa"
                />
                <MetricCard
                    icon={<HiOutlineArrowTrendingUp className="w-5 h-5" />}
                    color="info"
                    value={formatCurrency(sessions.reduce((acc, s) => acc + Number(s.deposits || 0), 0))}
                    label="Total Suprimentos"
                />
                <MetricCard
                    icon={<HiOutlineArrowTrendingDown className="w-5 h-5" />}
                    color="warning"
                    value={formatCurrency(sessions.reduce((acc, s) => acc + Number(s.withdrawals || 0), 0))}
                    label="Total Sangrias"
                />
                <MetricCard
                    icon={<HiOutlineXCircle className="w-5 h-5" />}
                    color={sessions.reduce((acc, s) => acc + Number(s.difference || 0), 0) < 0 ? 'danger' : 'success'}
                    value={formatCurrency(sessions.reduce((acc, s) => acc + Number(s.difference || 0), 0))}
                    label="DiscrepÃ¢ncias"
                />
            </div>

            {/* Main Data Table */}
            <Card padding="none" className="overflow-hidden border-gray-100 dark:border-dark-700 shadow-xl shadow-black/5">
                <SimpleTable
                    columns={[
                        { key: 'session', label: 'SessÃ£o (Abertura/Fecho)' },
                        { key: 'responsible', label: 'ResponsÃ¡vel' },
                        { key: 'fund', label: 'Fundo / Vendas', className: 'text-right' },
                        { key: 'balance', label: 'Saldo Final', className: 'text-right' },
                        { key: 'audit', label: 'Auditoria', className: 'text-center' },
                        { key: 'actions', label: 'AcÃ§Ãµes', className: 'text-right pr-10' },
                    ]}
                    isLoading={loading}
                    isEmpty={!loading && sessions.length === 0}
                    emptyTitle="Sem registos de turnos"
                    emptyDescription="Os turnos aparecerÃ£o aqui assim que forem registados."
                    minHeight="460px"
                    loadingRows={8}
                    loadingMessage="A carregar turnos..."
                    headerRowClassName="text-gray-400 border-gray-100 dark:border-dark-700 bg-gray-50/50 dark:bg-dark-900/50"
                    tbodyClassName="divide-y divide-gray-100 dark:divide-dark-700"
                >
                            {!loading && sessions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20">
                                            <HiOutlineClock className="w-16 h-16 text-gray-300" />
                                            <p className="text-sm font-bold uppercase tracking-widest">Sem registos de turnos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : !loading && (
                                sessions.map((session) => (
                                    <tr key={session.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group">
                                        <td className="px-6 py-4 font-mono">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-gray-900 dark:text-white">
                                                    {format(new Date(session.openedAt), "dd MMM yy, HH:mm", { locale: ptBR }).toUpperCase()}
                                                </span>
                                                {session.closedAt ? (
                                                    <span className="text-[9px] text-gray-400 font-bold uppercase">
                                                        FECHADO Ã€S {format(new Date(session.closedAt), "HH:mm", { locale: ptBR })}
                                                    </span>
                                                ) : (
                                                    <Badge variant="warning" className="text-[8px] mt-1 w-fit px-1.5 py-0">EM ABERTO</Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase">
                                                    {session.openedBy?.name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase truncate">
                                                        {session.openedBy?.name}
                                                    </span>
                                                    <span className="text-[9px] text-gray-400 font-medium">OP #{(session.id as string).slice(-4).toUpperCase()}</span>
                                                    {session.warehouse?.name && (
                                                        <span className="text-[9px] text-gray-400 font-medium uppercase truncate">
                                                            {session.warehouse.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs font-black text-gray-700 dark:text-gray-300">{formatCurrency(session.openingBalance)}</span>
                                                <span className="text-[10px] font-black text-emerald-500 tracking-tighter">+{formatCurrency(session.totalSales)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                                                    {formatCurrency(session.closingBalance || 0)}
                                                </span>
                                                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{session._count?.sales || 0} VENDAS</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {getStatusBadge(session)}
                                        </td>
                                        <td className="px-6 py-4 pr-10">
                                            <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleViewDetails(session)}
                                                    title="Ver Detalhes do Turno"
                                                    className="p-2 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg shadow-sm active:scale-95"
                                                >
                                                    <HiOutlineEye className="w-5 h-5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handlePrintZReport(session)}
                                                    title="Re-imprimir RelatÃ³rio Z"
                                                    className="p-2 text-gray-500 hover:bg-gray-800 hover:text-white rounded-lg shadow-sm active:scale-95"
                                                >
                                                    <HiOutlinePrinter className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                </SimpleTable>

                {!loading && total > 0 && (
                    <div className="px-6 pb-4">
                        <Pagination
                            currentPage={page}
                            totalItems={total}
                            itemsPerPage={PAGE_SIZE}
                            onPageChange={setPage}
                            showItemsPerPage={false}
                        />
                    </div>
                )}
            </Card>

            <CommercialShiftDetailsModal
                isOpen={showDetailsModal}
                session={selectedSession}
                onClose={() => setShowDetailsModal(false)}
                onPrint={() => selectedSession && handlePrintZReport(selectedSession)}
                isLoading={detailsLoading}
            />
        </div>
    );
};

export default CommercialShiftHistory;
