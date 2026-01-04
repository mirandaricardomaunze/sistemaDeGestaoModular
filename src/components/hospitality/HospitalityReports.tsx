/**
 * HospitalityReports Component
 * Reports section with summary, insights, data tables, and export functionality (PDF/Excel)
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, Button, Badge, Input, Select, SkeletonTable, SkeletonCard } from '../ui';
import Pagination, { usePagination } from '../ui/Pagination';
import { useStore } from '../../stores/useStore';
import * as XLSX from 'xlsx';
import {
    HiOutlineDocumentReport,
    HiOutlineDownload,
    HiOutlinePrinter,
    HiOutlineDocument,
    HiOutlineChartPie,
    HiOutlineRefresh,
    HiOutlineSearch,
    HiOutlineHome,
    HiOutlineShoppingCart,
    HiOutlineUsers
} from 'react-icons/hi';
import type { DashboardPeriod, ReportBooking } from '../../hooks/useHospitalityDashboard';
import useHospitalityDashboard from '../../hooks/useHospitalityDashboard';
import { generateHospitalityReport } from '../../utils/documentGenerator';

// ============================================================================
// Props Interface
// ============================================================================
interface HospitalityReportsProps {
    className?: string;
}

// ============================================================================
// Main Component
// ============================================================================
export default function HospitalityReports({ className }: HospitalityReportsProps) {
    const {
        period,
        setPeriod,
        reportLoading,
        reportData,
        fetchReportData,
        periodOptions
    } = useHospitalityDashboard('1m');

    const { companySettings, loadCompanySettings } = useStore();
    const printRef = useRef<HTMLDivElement>(null);

    // Search and filtering state
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isLoaded, setIsLoaded] = useState(false);

    // Load company settings
    useEffect(() => {
        loadCompanySettings();
    }, [loadCompanySettings]);

    // Filtered bookings
    const filteredBookings = useMemo(() => {
        if (!reportData) return [];
        return reportData.bookings.filter((b: ReportBooking) => {
            const matchesSearch = b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [reportData, searchTerm, statusFilter]);

    // Pagination for filtered bookings table
    const pagination = usePagination<ReportBooking>(filteredBookings, 10);

    // Format currency
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 0 }).format(value) + ' MT';
    };

    // Format date
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Load report data
    const handleLoadReport = async () => {
        await fetchReportData();
        setIsLoaded(true);
    };

    // Export to PDF (Professional)
    const handleExportPDF = () => {
        if (!reportData) return;
        generateHospitalityReport(reportData, companySettings);
    };

    // Professional Printing (like Inventory)
    const handlePrint = () => {
        if (!reportData) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const generatedAt = new Date().toLocaleString('pt-PT');
        const company = {
            name: companySettings?.companyName || 'Minha Empresa',
            address: [companySettings?.address, companySettings?.city].filter(Boolean).join(', ') || 'Endereço não configurado',
            phone: companySettings?.phone || '',
            email: companySettings?.email || '',
            nuit: companySettings?.taxId || ''
        };

        const periodLabel = periodOptions.find(o => o.value === period)?.label || period;

        // Generate rows for ALL filtered bookings
        const tableRows = filteredBookings.map(b => `
            <tr>
                <td>${formatDate(b.checkIn)}</td>
                <td class="font-bold">Q-${b.roomNumber}</td>
                <td>${b.roomType}</td>
                <td>${b.customerName}</td>
                <td class="text-center">${b.guestCount}</td>
                <td class="text-right">${formatCurrency(b.roomRevenue)}</td>
                <td class="text-right">${formatCurrency(b.consumptionTotal)}</td>
                <td class="text-right font-bold">${formatCurrency(b.totalRevenue)}</td>
                <td><span class="badge status-${b.status}">${b.status.replace('_', ' ').toUpperCase()}</span></td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Relatório de Hotelaria - ${periodLabel}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #000; line-height: 1.3; }
                        .header { border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 15px; display: flex; align-items: center; justify-content: space-between; }
                        .company-info-block { text-align: left; }
                        .company-name { font-size: 18px; font-weight: bold; margin: 0; text-transform: uppercase; }
                        .company-info { font-size: 10px; color: #333; margin: 1px 0; }
                        .report-meta { text-align: right; }
                        .report-title { font-size: 16px; font-weight: bold; margin: 0; text-transform: uppercase; }
                        .meta-text { font-size: 10px; color: #333; margin: 1px 0; }
                        
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
                        th { border: 1px solid #000; background: #f2f2f2; text-align: left; padding: 6px 4px; font-weight: bold; text-transform: uppercase; }
                        td { border: 1px solid #000; padding: 5px 4px; vertical-align: top; }
                        
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        
                        .summary-footer { margin-top: 15px; border-top: 2px solid #000; padding-top: 10px; display: flex; justify-content: flex-end; }
                        .summary-item { margin-left: 30px; text-align: right; }
                        .summary-label { font-size: 9px; font-weight: bold; text-transform: uppercase; }
                        .summary-value { font-size: 12px; font-weight: bold; }
                        
                        .footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 8px; color: #666; display: flex; justify-content: space-between; }
                        
                        @media print {
                            body { padding: 0; }
                            tr { page-break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="company-info-block">
                            <h1 class="company-name">${company.name}</h1>
                            <p class="company-info">${company.address}</p>
                            <p class="company-info">TEL: ${company.phone} | EMAIL: ${company.email}</p>
                            <p class="company-info">NUIT: ${company.nuit}</p>
                        </div>
                        <div class="report-meta">
                            <h2 class="report-title">Relatório de Hotelaria</h2>
                            <p class="meta-text">Período: <strong>${periodLabel}</strong></p>
                            <p class="meta-text">Data de Emissão: ${generatedAt}</p>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Quarto</th>
                                <th>Tipo</th>
                                <th>Cliente</th>
                                <th class="text-center">Hósp.</th>
                                <th class="text-right">Vlr. Quarto</th>
                                <th class="text-right">Vlr. Consumos</th>
                                <th class="text-right">Total Bruto</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>

                    <div class="summary-footer">
                        <div class="summary-item">
                            <div class="summary-label">Total de Reservas</div>
                            <div class="summary-value">${reportData.summary.totalBookings}</div>
                        </div>
                        <div class="summary-item">
                            <div class="summary-label">Total Receita</div>
                            <div class="summary-value" style="font-size: 14px;">${formatCurrency(reportData.summary.totalRevenue)}</div>
                        </div>
                    </div>

                    <div class="footer">
                        <span>Gerado via ERP Hotelaria - Documento para uso interno</span>
                        <span>Página 1 de 1</span>
                    </div>
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 800);
    };

    // Export to Excel (Professional using xlsx)
    const handleExportExcel = () => {
        if (!reportData) return;

        const worksheetData = filteredBookings.map((b: ReportBooking) => ({
            'Data Check-in': formatDate(b.checkIn),
            'Check-out': formatDate(b.checkOut),
            'Quarto': b.roomNumber,
            'Tipo': b.roomType,
            'Cliente': b.customerName,
            'Hóspedes': b.guestCount,
            'Valor Hospedagem': b.roomRevenue,
            'Valor Consumos': b.consumptionTotal,
            'Total': b.totalRevenue,
            'Status': b.status.toUpperCase()
        }));

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reservas");
        XLSX.writeFile(wb, `Relatorio_Hotelaria_${period}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };


    // Status badge component
    const StatusBadge = ({ status }: { status: string }) => {
        const variant = status === 'checked_in' ? 'info'
            : status === 'checked_out' ? 'success'
                : status === 'cancelled' ? 'danger'
                    : 'warning';
        const label = status === 'checked_in' ? 'Ocupado'
            : status === 'checked_out' ? 'Check-out'
                : status === 'cancelled' ? 'Cancelado'
                    : status.toUpperCase();
        return <Badge variant={variant}>{label}</Badge>;
    };

    return (
        <div className={`space-y-8 ${className}`}>
            {/* Toolbar: Actions & Period Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-dark-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-lg">
                        <HiOutlineDocumentReport className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Gestão de Relatórios</h3>
                        <p className="text-[10px] text-gray-500 font-medium">Exportação e análise de dados</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1 bg-gray-100 dark:bg-dark-900 rounded-lg p-1">
                        {periodOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { setPeriod(opt.value as DashboardPeriod); setIsLoaded(false); }}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${period === opt.value
                                    ? 'bg-white dark:bg-dark-700 text-primary-600 shadow-sm border border-gray-200 dark:border-dark-600'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <Button onClick={handleLoadReport} disabled={reportLoading} leftIcon={<HiOutlineRefresh className="w-4 h-4" />}>
                        {reportLoading ? 'Carregando...' : isLoaded ? 'Actualizar' : 'Gerar Relatório'}
                    </Button>
                </div>
            </div>

            {/* Report Content */}
            {reportLoading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} className="h-28" />)}
                    </div>
                    <SkeletonCard className="h-40" />
                    <SkeletonTable rows={5} columns={6} />
                </div>
            ) : !isLoaded ? (
                <Card className="p-16 text-center border-dashed border-2">
                    <div className="w-20 h-20 bg-gray-50 dark:bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
                        <HiOutlineChartPie className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Pronto para gerar relatório</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mb-8">Seleccione o período desejado acima para consolidar todos os dados de reservas e consumos.</p>
                    <Button size="lg" onClick={handleLoadReport} leftIcon={<HiOutlineDocumentReport className="w-5 h-5" />}>
                        Gerar Agora
                    </Button>
                </Card>
            ) : reportData && (
                <>
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 dark:bg-dark-800/50 p-3 rounded-lg border border-gray-200 dark:border-dark-700">
                        <div className="flex gap-2 print:hidden italic text-xs text-gray-500">
                            Opções de exportação disponíveis:
                        </div>
                        <div className="flex gap-2 print:hidden">
                            <Button variant="outline" size="sm" onClick={handleExportPDF} leftIcon={<HiOutlineDocument className="w-4 h-4" />}>
                                PDF
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleExportExcel} leftIcon={<HiOutlineDownload className="w-4 h-4" />}>
                                Excel
                            </Button>
                            <Button variant="primary" size="sm" onClick={handlePrint} leftIcon={<HiOutlinePrinter className="w-4 h-4" />}>
                                Imprimir
                            </Button>
                        </div>
                    </div>

                    {/* Printable area starting here */}
                    <div ref={printRef} className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <Card className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg border-none">
                                <div className="flex items-center gap-2 mb-2 opacity-80">
                                    <HiOutlineChartPie className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Receita Total</span>
                                </div>
                                <p className="text-2xl font-black">{formatCurrency(reportData.summary.totalRevenue)}</p>
                            </Card>

                            <Card className="p-5 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg border-none">
                                <div className="flex items-center gap-2 mb-2 opacity-80">
                                    <HiOutlineHome className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Hospedagem</span>
                                </div>
                                <p className="text-2xl font-black">{formatCurrency(reportData.summary.totalRoomRevenue)}</p>
                            </Card>

                            <Card className="p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg border-none">
                                <div className="flex items-center gap-2 mb-2 opacity-80">
                                    <HiOutlineShoppingCart className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Consumos</span>
                                </div>
                                <p className="text-2xl font-black">{formatCurrency(reportData.summary.totalConsumptionRevenue)}</p>
                            </Card>

                            <Card className="p-5 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg border-none">
                                <div className="flex items-center gap-2 mb-2 opacity-80">
                                    <HiOutlineUsers className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Reservas</span>
                                </div>
                                <p className="text-2xl font-black">{reportData.summary.totalBookings}</p>
                            </Card>
                        </div>

                        {/* Insights Section */}
                        <Card className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📊 Insights do Período</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4">
                                    <p className="text-sm text-gray-500 mb-1">Taxa de Ocupação Média</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">{reportData.summary.occupancyRate}%</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4">
                                    <p className="text-sm text-gray-500 mb-1">Valor Médio por Reserva</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(reportData.summary.avgBookingValue)}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4">
                                    <p className="text-sm text-gray-500 mb-1">Total de Hóspedes</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-white">{reportData.summary.totalGuests}</p>
                                </div>
                            </div>
                        </Card>

                        {/* Room Status Summary */}
                        <Card className="p-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🛏️ Status dos Quartos (Actual)</h3>
                            <div className="flex flex-wrap gap-3">
                                <Badge variant="success" className="text-base px-3 py-1">{reportData.roomStats.available} Disponíveis</Badge>
                                <Badge variant="info" className="text-base px-3 py-1">{reportData.roomStats.occupied} Ocupados</Badge>
                                <Badge variant="warning" className="text-base px-3 py-1">{reportData.roomStats.dirty} Limpeza</Badge>
                                <Badge variant="danger" className="text-base px-3 py-1">{reportData.roomStats.maintenance} Manutenção</Badge>
                            </div>
                        </Card>

                        {/* Bookings Table with Search/Filter */}
                        <Card className="p-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">📋 Detalhes das Reservas</h3>

                                <div className="flex flex-wrap items-center gap-3 print:hidden">
                                    <Input
                                        placeholder="Pesquisar cliente ou quarto..."
                                        className="w-full md:w-64"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        leftIcon={<HiOutlineSearch className="w-5 h-5" />}
                                    />
                                    <Select
                                        options={[
                                            { value: 'all', label: 'Todos Status' },
                                            { value: 'checked_in', label: 'Ocupado' },
                                            { value: 'checked_out', label: 'Check-out' },
                                            { value: 'cancelled', label: 'Cancelado' },
                                        ]}
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        className="w-full md:w-44"
                                    />
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 dark:bg-dark-700 text-xs uppercase text-gray-500">
                                        <tr>
                                            <th className="px-4 py-3">Data</th>
                                            <th className="px-4 py-3">Quarto</th>
                                            <th className="px-4 py-3">Tipo</th>
                                            <th className="px-4 py-3">Cliente</th>
                                            <th className="px-4 py-3 text-center">Hósp.</th>
                                            <th className="px-4 py-3 text-right">Hospedagem</th>
                                            <th className="px-4 py-3 text-right">Consumos</th>
                                            <th className="px-4 py-3 text-right">Total</th>
                                            <th className="px-4 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-dark-600">
                                        {pagination.paginatedItems.map((booking: ReportBooking) => (
                                            <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                                <td className="px-4 py-3">{formatDate(booking.checkIn)}</td>
                                                <td className="px-4 py-3 font-medium">Q-{booking.roomNumber}</td>
                                                <td className="px-4 py-3 capitalize">{booking.roomType}</td>
                                                <td className="px-4 py-3">{booking.customerName}</td>
                                                <td className="px-4 py-3 text-center">{booking.guestCount}</td>
                                                <td className="px-4 py-3 text-right">{formatCurrency(booking.roomRevenue)}</td>
                                                <td className="px-4 py-3 text-right">{formatCurrency(booking.consumptionTotal)}</td>
                                                <td className="px-4 py-3 text-right font-bold">{formatCurrency(booking.totalRevenue)}</td>
                                                <td className="px-4 py-3"><StatusBadge status={booking.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination bar - hidden in print if needed, but here we include it or hide it via CSS */}
                            <div className="print:hidden">
                                <Pagination
                                    currentPage={pagination.currentPage}
                                    totalItems={pagination.totalItems}
                                    itemsPerPage={pagination.itemsPerPage}
                                    onPageChange={pagination.setCurrentPage}
                                    onItemsPerPageChange={pagination.setItemsPerPage}
                                    showItemsPerPage={true}
                                />
                            </div>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
