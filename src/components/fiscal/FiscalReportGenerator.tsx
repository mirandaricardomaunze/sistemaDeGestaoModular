import { useState, useMemo } from 'react';
import {
    HiOutlineDocumentReport,
    HiOutlineDownload,
    HiOutlinePrinter,
    HiOutlineCheck,
    HiOutlineRefresh,
} from 'react-icons/hi';
import { useFiscalStore } from '../../stores/useFiscalStore';
import { useStore } from '../../stores/useStore';
import { Button, Card, Select, Badge, Modal, Pagination, usePagination } from '../ui';
import { formatCurrency, generateId } from '../../utils/helpers';
import {
    exportRetentionsToCSV,
    exportIVAReportCSV,
    exportINSSReportCSV,
    formatPeriod,
    getCurrentFiscalPeriod,
    getPeriodRange,
    validateFiscalReport,
} from '../../utils/fiscalCalculations';
import { exportData } from '../../utils/exportUtils';
import type { ExportOptions } from '../../utils/exportUtils';
import type { FiscalReport, FiscalReportType, TaxType, ExportFormat } from '../../types/fiscal';
import toast from 'react-hot-toast';

export default function FiscalReportGenerator() {
    const { retentions, fiscalReports, addFiscalReport, updateFiscalReport } = useFiscalStore();
    const { companySettings } = useStore();

    const [selectedReportType, setSelectedReportType] = useState<FiscalReportType>('iva_monthly');
    const [selectedPeriod, setSelectedPeriod] = useState(getCurrentFiscalPeriod());
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewReport, setPreviewReport] = useState<FiscalReport | null>(null);

    // Pagination for reports list
    const sortedReports = useMemo(() =>
        [...fiscalReports].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()),
        [fiscalReports]
    );

    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedReports,
        totalItems,
    } = usePagination(sortedReports, 10);

    // Generate period options (last 12 months)
    const periodOptions = useMemo(() => {
        const options = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const period = date.toISOString().slice(0, 7);
            options.push({
                value: period,
                label: formatPeriod(period),
            });
        }
        return options;
    }, []);

    const reportTypeOptions = [
        { value: 'iva_monthly', label: 'IVA - Mensal' },
        { value: 'inss_monthly', label: 'INSS - Mensal' },
        { value: 'irt_monthly', label: 'IRPS - Mensal' },
        { value: 'withholding_monthly', label: 'Retenções Fonte - Mensal' },
    ];

    const getTypeFilter = (reportType: FiscalReportType): TaxType[] => {
        switch (reportType) {
            case 'iva_monthly':
            case 'iva_quarterly':
                return ['iva'];
            case 'inss_monthly':
                return ['inss_employee', 'inss_employer'];
            case 'irt_monthly':
            case 'irt_annual':
                return ['irt'];
            case 'withholding_monthly':
                return ['withholding'];
            default:
                return [];
        }
    };

    const handleGenerateReport = () => {
        const typeFilters = getTypeFilter(selectedReportType);
        const periodRetentions = retentions.filter(
            r => r.period === selectedPeriod && typeFilters.includes(r.type)
        );

        const { startDate, endDate } = getPeriodRange(selectedPeriod);

        // Calculate summary
        const summary = {
            totalBaseAmount: periodRetentions.reduce((sum, r) => sum + r.baseAmount, 0),
            totalTaxAmount: periodRetentions.reduce((sum, r) => sum + r.retainedAmount, 0),
            totalDocuments: periodRetentions.length,
            byCategory: periodRetentions.reduce((acc, r) => {
                if (!acc[r.documentType]) {
                    acc[r.documentType] = { base: 0, tax: 0, count: 0 };
                }
                acc[r.documentType].base += r.baseAmount;
                acc[r.documentType].tax += r.retainedAmount;
                acc[r.documentType].count += 1;
                return acc;
            }, {} as Record<string, { base: number; tax: number; count: number }>),
        };

        const report: FiscalReport = {
            id: generateId(),
            type: selectedReportType,
            name: `${reportTypeOptions.find(o => o.value === selectedReportType)?.label} - ${formatPeriod(selectedPeriod)}`,
            period: selectedPeriod,
            startDate,
            endDate,
            status: 'generated',
            summary,
            retentions: periodRetentions,
            generatedAt: new Date().toISOString(),
            exportedFormats: [],
            createdBy: 'Sistema',
        };

        // Validate
        const validation = validateFiscalReport(report);

        if (!validation.isValid) {
            toast.error('Erros na validação: ' + validation.errors.map(e => e.message).join(', '));
            return;
        }

        if (validation.warnings.length > 0) {
            toast(validation.warnings.map(w => w.message).join('\n'), { icon: 'âš ï¸' });
        }

        addFiscalReport(report);
        toast.success('Relatório gerado com sucesso!');
        setPreviewReport(report);
        setShowPreviewModal(true);
    };

    const handleExport = (report: FiscalReport, format: ExportFormat) => {
        let content = '';
        let filename = '';
        let mimeType = '';

        switch (format) {
            case 'csv':
                if (report.type.includes('iva')) {
                    content = exportIVAReportCSV(report.retentions, report.period, companySettings?.taxId ?? '');
                    filename = `IVA_${report.period}.csv`;
                } else if (report.type.includes('inss')) {
                    content = exportINSSReportCSV(report.retentions, report.period, companySettings?.taxId ?? '');
                    filename = `INSS_${report.period}.csv`;
                } else {
                    content = exportRetentionsToCSV(report.retentions, {
                        format: 'csv',
                        includeHeader: true,
                        dateFormat: 'yyyy-MM-dd',
                        decimalSeparator: ',',
                        fieldSeparator: ';',
                        encoding: 'utf-8',
                    });
                    filename = `Retencoes_${report.period}.csv`;
                }
                mimeType = 'text/csv;charset=utf-8;';
                break;

            case 'xml':
                // Simple XML export
                content = `<?xml version="1.0" encoding="UTF-8"?>
<FiscalReport>
    <Header>
        <ReportType>${report.type}</ReportType>
        <Period>${report.period}</Period>
        <CompanyNUIT>${companySettings?.taxId ?? ''}</CompanyNUIT>
        <GeneratedAt>${report.generatedAt}</GeneratedAt>
    </Header>
    <Summary>
        <TotalBaseAmount>${report.summary.totalBaseAmount.toFixed(2)}</TotalBaseAmount>
        <TotalTaxAmount>${report.summary.totalTaxAmount.toFixed(2)}</TotalTaxAmount>
        <TotalDocuments>${report.summary.totalDocuments}</TotalDocuments>
    </Summary>
    <Retentions>
        ${report.retentions.map(r => `
        <Retention>
            <Type>${r.type}</Type>
            <DocumentNumber>${r.documentNumber}</DocumentNumber>
            <EntityName>${r.entityName}</EntityName>
            <EntityNUIT>${r.entityNuit || ''}</EntityNUIT>
            <BaseAmount>${r.baseAmount.toFixed(2)}</BaseAmount>
            <RetainedAmount>${r.retainedAmount.toFixed(2)}</RetainedAmount>
            <Date>${r.date}</Date>
        </Retention>`).join('')}
    </Retentions>
</FiscalReport>`;
                filename = `FiscalReport_${report.type}_${report.period}.xml`;
                mimeType = 'application/xml;charset=utf-8;';
                break;

            case 'pdf':
            case 'excel':
                const exportOptions: ExportOptions = {
                    filename: `Relatorio_Fiscal_${report.type}_${report.period}`,
                    title: report.name,
                    subtitle: companySettings?.companyName || 'Multicore',
                    companyName: companySettings?.companyName,
                    columns: [
                        { key: 'documentType', header: 'Tipo Doc', width: 15 },
                        { key: 'documentNumber', header: 'Nº Documento', width: 20 },
                        { key: 'entityName', header: 'Entidade', width: 30 },
                        { key: 'entityNuit', header: 'NUIT', width: 15 },
                        { key: 'baseAmount', header: 'Base Tributável', format: 'currency', width: 20, align: 'right' },
                        { key: 'retainedAmount', header: 'Imposto', format: 'currency', width: 20, align: 'right' },
                        { key: 'date', header: 'Data', format: 'date', width: 15 },
                    ],
                    data: report.retentions,
                    footerText: `Relatório gerado automaticamente pelo sistema em ${new Date().toLocaleString('pt-MZ')}`,
                    orientation: 'landscape'
                };
                exportData(exportOptions, format === 'pdf' ? 'pdf' : 'excel');
                filename = `${exportOptions.filename}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
                break;

            default:
                toast.error('Formato não suportado');
                return;
        }

        if (format !== 'pdf' && format !== 'excel') {
            // Download file for CSV/XML
            const blob = new Blob([content], { type: mimeType });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // Update report with exported format
        if (!report.exportedFormats.includes(format)) {
            updateFiscalReport(report.id, {
                exportedFormats: [...report.exportedFormats, format],
            });
        }

        toast.success(`Ficheiro ${filename} exportado com sucesso!`);
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, 'warning' | 'primary' | 'success' | 'danger' | 'info'> = {
            draft: 'warning',
            generated: 'primary',
            validated: 'info',
            submitted: 'success',
            accepted: 'success',
            rejected: 'danger',
        };
        const labels: Record<string, string> = {
            draft: 'Rascunho',
            generated: 'Gerado',
            validated: 'Validado',
            submitted: 'Submetido',
            accepted: 'Aceite',
            rejected: 'Rejeitado',
        };
        return <Badge variant={variants[status] || 'gray'}>{labels[status] || status}</Badge>;
    };

    return (
        <div className="space-y-6">
            {/* Generate Report Section */}
            <Card padding="md">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    <HiOutlineDocumentReport className="w-5 h-5 inline mr-2" />
                    Gerar Relatório Fiscal
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select
                        label="Tipo de Relatório"
                        options={reportTypeOptions}
                        value={selectedReportType}
                        onChange={(e) => setSelectedReportType(e.target.value as FiscalReportType)}
                    />

                    <Select
                        label="Período"
                        options={periodOptions}
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                    />

                    <div className="flex items-end">
                        <Button onClick={handleGenerateReport} className="w-full">
                            <HiOutlineRefresh className="w-5 h-5 mr-2" />
                            Gerar Relatório
                        </Button>
                    </div>
                </div>

                {/* Quick Stats for Selected Period */}
                <div className="mt-4 p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        Prévia para {formatPeriod(selectedPeriod)}:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {getTypeFilter(selectedReportType).map(type => {
                            const filtered = retentions.filter(r => r.period === selectedPeriod && r.type === type);
                            const total = filtered.reduce((sum, r) => sum + r.retainedAmount, 0);
                            return (
                                <div key={type} className="text-center">
                                    <p className="text-xs text-gray-500 uppercase">{type.replace('_', ' ')}</p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(total)}
                                    </p>
                                    <p className="text-xs text-gray-400">{filtered.length} docs</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>

            {/* Reports List */}
            <Card padding="none">
                <div className="p-4 border-b border-gray-200 dark:border-dark-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                        Relatórios Gerados
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                        <thead className="bg-gray-50 dark:bg-dark-800">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Relatório</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Base</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Imposto</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Docs</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                            {paginatedReports.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        Nenhum relatório gerado. Use o formulário acima para gerar o primeiro.
                                    </td>
                                </tr>
                            ) : (
                                paginatedReports.map((report) => (
                                    <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                                        <td className="px-6 py-4">
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {report.name}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Gerado em {new Date(report.generatedAt).toLocaleDateString('pt-MZ')}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                            {formatPeriod(report.period)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-gray-900 dark:text-white">
                                            {formatCurrency(report.summary.totalBaseAmount)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-primary-600 dark:text-primary-400">
                                            {formatCurrency(report.summary.totalTaxAmount)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant="gray">{report.summary.totalDocuments}</Badge>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {getStatusBadge(report.status)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => {
                                                        setPreviewReport(report);
                                                        setShowPreviewModal(true);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="Ver Detalhes"
                                                >
                                                    <HiOutlineDocumentReport className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleExport(report, 'pdf')}
                                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Exportar PDF"
                                                >
                                                    <HiOutlineDownload className="w-5 h-5 text-red-500" />
                                                </button>
                                                <button
                                                    onClick={() => handleExport(report, 'excel')}
                                                    className="p-2 text-gray-400 hover:text-green-700 transition-colors"
                                                    title="Exportar Excel"
                                                >
                                                    <HiOutlineDownload className="w-5 h-5 text-green-600" />
                                                </button>
                                                <button
                                                    onClick={() => handleExport(report, 'csv')}
                                                    className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                                                    title="Exportar CSV"
                                                >
                                                    <HiOutlineDownload className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleExport(report, 'xml')}
                                                    className="p-2 text-gray-400 hover:text-orange-600 transition-colors"
                                                    title="Exportar XML"
                                                >
                                                    <HiOutlinePrinter className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6">
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </div>
            </Card>

            {/* Preview Modal */}
            <Modal
                isOpen={showPreviewModal}
                onClose={() => setShowPreviewModal(false)}
                title={previewReport?.name || 'Detalhes do Relatório'}
                size="lg"
            >
                {previewReport && (
                    <div className="space-y-4">
                        {/* Company Logo in Preview */}
                        {companySettings?.logo && (
                            <div className="flex justify-center mb-4">
                                <img src={companySettings.logo} alt="Company Logo" className="h-16 object-contain" />
                            </div>
                        )}

                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg text-center">
                                <p className="text-sm text-gray-500">Total Base Tributável</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(previewReport.summary.totalBaseAmount)}
                                </p>
                            </div>
                            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-center">
                                <p className="text-sm text-primary-600 dark:text-primary-400">Total Imposto</p>
                                <p className="text-xl font-bold text-primary-700 dark:text-primary-300">
                                    {formatCurrency(previewReport.summary.totalTaxAmount)}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-dark-800 rounded-lg text-center">
                                <p className="text-sm text-gray-500">Documentos</p>
                                <p className="text-xl font-bold text-gray-900 dark:text-white">
                                    {previewReport.summary.totalDocuments}
                                </p>
                            </div>
                        </div>

                        {/* Retentions Table */}
                        <div className="max-h-64 overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700 text-sm">
                                <thead className="bg-gray-50 dark:bg-dark-800 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Documento</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Entidade</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Base</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Imposto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                                    {previewReport.retentions.map((r) => (
                                        <tr key={r.id}>
                                            <td className="px-3 py-2 font-mono">{r.documentNumber}</td>
                                            <td className="px-3 py-2">{r.entityName}</td>
                                            <td className="px-3 py-2 text-right font-mono">{formatCurrency(r.baseAmount)}</td>
                                            <td className="px-3 py-2 text-right font-mono font-bold text-primary-600">{formatCurrency(r.retainedAmount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Export Actions */}
                        <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-dark-700">
                            <div className="flex gap-2">
                                {previewReport.exportedFormats.map((format) => (
                                    <Badge key={format} variant="success" size="sm">
                                        <HiOutlineCheck className="w-3 h-3 mr-1" />
                                        {format.toUpperCase()}
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2 justify-end">
                                <Button variant="primary" onClick={() => handleExport(previewReport, 'pdf')}>
                                    <HiOutlineDownload className="w-4 h-4 mr-2" />
                                    PDF
                                </Button>
                                <Button variant="success" onClick={() => handleExport(previewReport, 'excel')}>
                                    <HiOutlineDownload className="w-4 h-4 mr-2" />
                                    Excel
                                </Button>
                                <Button variant="outline" onClick={() => handleExport(previewReport, 'csv')}>
                                    <HiOutlineDownload className="w-4 h-4 mr-2" />
                                    CSV
                                </Button>
                                <Button variant="outline" onClick={() => handleExport(previewReport, 'xml')}>
                                    <HiOutlineDownload className="w-4 h-4 mr-2" />
                                    XML
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
