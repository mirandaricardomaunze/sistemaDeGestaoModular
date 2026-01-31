/**
 * Export Utilities - Excel and PDF Export
 * 
 * Provides functions to export data to Excel (.xlsx) and PDF formats
 * Supports custom headers, formatting, and company branding
 */

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================================================
// Types
// ============================================================================

export interface ExportColumn {
    key: string;
    header: string;
    width?: number;
    format?: 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'percentage';
    align?: 'left' | 'center' | 'right';
}

export interface ExportOptions {
    filename: string;
    title?: string;
    subtitle?: string;
    columns: ExportColumn[];
    data: Record<string, any>[];
    companyName?: string;
    companyLogo?: string;
    currency?: string;
    locale?: string;
    orientation?: 'portrait' | 'landscape';
    showDate?: boolean;
    footerText?: string;
}

// ============================================================================
// Formatting Helpers
// ============================================================================

const formatValue = (value: any, format?: ExportColumn['format'], currency = 'MZN', locale = 'pt-MZ'): string => {
    if (value === null || value === undefined) return '';

    switch (format) {
        case 'currency':
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency
            }).format(Number(value));

        case 'number':
            return new Intl.NumberFormat(locale).format(Number(value));

        case 'percentage':
            return `${Number(value).toFixed(1)}%`;

        case 'date':
            return new Date(value).toLocaleDateString(locale);

        case 'datetime':
            return new Date(value).toLocaleString(locale);

        default:
            return String(value);
    }
};

const getNestedValue = (obj: Record<string, any>, path: string): any => {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
};

// ============================================================================
// Excel Export
// ============================================================================

export const exportToExcel = (options: ExportOptions): void => {
    const {
        filename,
        title,
        subtitle,
        columns,
        data,
        companyName,
        currency = 'MZN',
        locale = 'pt-MZ',
        showDate = true
    } = options;

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();

    // Prepare header rows
    const wsData: any[][] = [];

    // Add company name and title if provided
    if (companyName) {
        wsData.push([companyName]);
        wsData.push([]);
    }

    if (title) {
        wsData.push([title]);
    }

    if (subtitle) {
        wsData.push([subtitle]);
    }

    if (showDate) {
        wsData.push([`Gerado em: ${new Date().toLocaleString(locale)}`]);
    }

    wsData.push([]); // Empty row before data

    // Add column headers
    wsData.push(columns.map(col => col.header));

    // Add data rows
    data.forEach(row => {
        const rowData = columns.map(col => {
            const value = getNestedValue(row, col.key);
            return formatValue(value, col.format, currency, locale);
        });
        wsData.push(rowData);
    });

    // Add summary row if numeric columns exist
    const numericColumns = columns.filter(col =>
        col.format === 'currency' || col.format === 'number'
    );

    if (numericColumns.length > 0) {
        wsData.push([]); // Empty row
        const summaryRow = columns.map(col => {
            if (col.format === 'currency' || col.format === 'number') {
                const sum = data.reduce((acc, row) => {
                    const value = getNestedValue(row, col.key);
                    return acc + (Number(value) || 0);
                }, 0);
                return formatValue(sum, col.format, currency, locale);
            }
            return col.key === columns[0].key ? 'TOTAL' : '';
        });
        wsData.push(summaryRow);
    }

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = columns.map(col => ({ wch: col.width || 15 }));
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');

    // Generate file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Save file
    saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// ============================================================================
// PDF Export
// ============================================================================

export const exportToPDF = (options: ExportOptions): void => {
    const {
        filename,
        title,
        subtitle,
        columns,
        data,
        companyName,
        currency = 'MZN',
        locale = 'pt-MZ',
        orientation = 'portrait',
        showDate = true,
        footerText
    } = options;

    // Create PDF document
    const doc = new jsPDF({
        orientation,
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 15;

    // Add company name
    if (companyName) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;
    }

    // Add title
    if (title) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 6;
    }

    // Add subtitle
    if (subtitle) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(subtitle, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 5;
    }

    // Add date
    if (showDate) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(`Gerado em: ${new Date().toLocaleString(locale)}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;
    }

    // Prepare table data
    const headers = columns.map(col => col.header);
    const rows = data.map(row =>
        columns.map(col => {
            const value = getNestedValue(row, col.key);
            return formatValue(value, col.format, currency, locale);
        })
    );

    // Add summary row
    const numericColumns = columns.filter(col =>
        col.format === 'currency' || col.format === 'number'
    );

    if (numericColumns.length > 0) {
        const summaryRow = columns.map(col => {
            if (col.format === 'currency' || col.format === 'number') {
                const sum = data.reduce((acc, row) => {
                    const value = getNestedValue(row, col.key);
                    return acc + (Number(value) || 0);
                }, 0);
                return formatValue(sum, col.format, currency, locale);
            }
            return col.key === columns[0].key ? 'TOTAL' : '';
        });
        rows.push(summaryRow);
    }

    // Generate table
    autoTable(doc, {
        head: [headers],
        body: rows,
        startY: yPosition,
        theme: 'striped',
        headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 9
        },
        alternateRowStyles: {
            fillColor: [245, 245, 245]
        },
        columnStyles: columns.reduce((acc, col, index) => {
            acc[index] = {
                halign: col.align || (col.format === 'currency' || col.format === 'number' ? 'right' : 'left')
            };
            return acc;
        }, {} as Record<number, { halign: 'left' | 'center' | 'right' }>),
        didDrawPage: (data) => {
            // Footer
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');

            if (footerText) {
                doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            // Page number
            const pageNumber = (doc as any).internal.getNumberOfPages();
            doc.text(
                `Página ${data.pageNumber} de ${pageNumber}`,
                pageWidth - 15,
                pageHeight - 10,
                { align: 'right' }
            );
        },
        margin: { top: 15, left: 10, right: 10, bottom: 20 }
    });

    // Save PDF
    doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// ============================================================================
// Combined Export (with format selection)
// ============================================================================

export type ExportFormat = 'excel' | 'pdf';

export const exportData = (options: ExportOptions, format: ExportFormat): void => {
    if (format === 'excel') {
        exportToExcel(options);
    } else {
        exportToPDF(options);
    }
};

// ============================================================================
// Pre-configured Export Functions for Common Entities
// ============================================================================

export const exportProducts = (
    products: any[],
    format: ExportFormat,
    companyName?: string
): void => {
    exportData({
        filename: 'produtos',
        title: 'Lista de Produtos',
        companyName,
        columns: [
            { key: 'code', header: 'Código', width: 12 },
            { key: 'name', header: 'Nome', width: 30 },
            { key: 'category.name', header: 'Categoria', width: 15 },
            { key: 'currentStock', header: 'Stock', format: 'number', width: 10, align: 'right' },
            { key: 'minStock', header: 'Stock Mín.', format: 'number', width: 10, align: 'right' },
            { key: 'costPrice', header: 'Custo', format: 'currency', width: 15 },
            { key: 'sellingPrice', header: 'Preço Venda', format: 'currency', width: 15 },
        ],
        data: products
    }, format);
};

export const exportCustomers = (
    customers: any[],
    format: ExportFormat,
    companyName?: string
): void => {
    exportData({
        filename: 'clientes',
        title: 'Lista de Clientes',
        companyName,
        columns: [
            { key: 'code', header: 'Código', width: 12 },
            { key: 'name', header: 'Nome', width: 25 },
            { key: 'email', header: 'Email', width: 25 },
            { key: 'phone', header: 'Telefone', width: 15 },
            { key: 'nuit', header: 'NUIT', width: 15 },
            { key: 'totalPurchases', header: 'Total Compras', format: 'currency', width: 15 },
        ],
        data: customers
    }, format);
};

export const exportSales = (
    sales: any[],
    format: ExportFormat,
    companyName?: string
): void => {
    exportData({
        filename: 'vendas',
        title: 'Relatório de Vendas',
        companyName,
        orientation: 'landscape',
        columns: [
            { key: 'receiptNumber', header: 'Nº Recibo', width: 15 },
            { key: 'createdAt', header: 'Data', format: 'datetime', width: 18 },
            { key: 'customer.name', header: 'Cliente', width: 20 },
            { key: 'items.length', header: 'Itens', format: 'number', width: 8, align: 'center' },
            { key: 'subtotal', header: 'Subtotal', format: 'currency', width: 15 },
            { key: 'discount', header: 'Desconto', format: 'currency', width: 12 },
            { key: 'total', header: 'Total', format: 'currency', width: 15 },
            { key: 'paymentMethod', header: 'Pagamento', width: 12 },
        ],
        data: sales
    }, format);
};

export const exportInvoices = (
    invoices: any[],
    format: ExportFormat,
    companyName?: string
): void => {
    exportData({
        filename: 'facturas',
        title: 'Lista de Facturas',
        companyName,
        orientation: 'landscape',
        columns: [
            { key: 'invoiceNumber', header: 'Nº Factura', width: 15 },
            { key: 'issueDate', header: 'Data Emissão', format: 'date', width: 12 },
            { key: 'dueDate', header: 'Vencimento', format: 'date', width: 12 },
            { key: 'customer.name', header: 'Cliente', width: 25 },
            { key: 'subtotal', header: 'Subtotal', format: 'currency', width: 15 },
            { key: 'taxAmount', header: 'IVA', format: 'currency', width: 12 },
            { key: 'total', header: 'Total', format: 'currency', width: 15 },
            { key: 'status', header: 'Estado', width: 12 },
        ],
        data: invoices
    }, format);
};

export const exportEmployees = (
    employees: any[],
    format: ExportFormat,
    companyName?: string
): void => {
    exportData({
        filename: 'funcionarios',
        title: 'Lista de Funcionários',
        companyName,
        columns: [
            { key: 'code', header: 'Código', width: 12 },
            { key: 'name', header: 'Nome', width: 25 },
            { key: 'email', header: 'Email', width: 25 },
            { key: 'phone', header: 'Telefone', width: 15 },
            { key: 'department', header: 'Departamento', width: 15 },
            { key: 'role', header: 'Função', width: 12 },
            { key: 'baseSalary', header: 'Salário Base', format: 'currency', width: 15 },
        ],
        data: employees
    }, format);
};

export const exportBookings = (
    bookings: any[],
    format: ExportFormat,
    companyName?: string
): void => {
    exportData({
        filename: 'reservas',
        title: 'Lista de Reservas',
        companyName,
        orientation: 'landscape',
        columns: [
            { key: 'room.number', header: 'Quarto', width: 10 },
            { key: 'customerName', header: 'Hóspede', width: 25 },
            { key: 'guestCountry', header: 'País', width: 12 },
            { key: 'checkIn', header: 'Check-in', format: 'date', width: 12 },
            { key: 'expectedCheckout', header: 'Check-out', format: 'date', width: 12 },
            { key: 'guestCount', header: 'Hóspedes', format: 'number', width: 10, align: 'center' },
            { key: 'totalAmount', header: 'Total', format: 'currency', width: 15 },
            { key: 'status', header: 'Estado', width: 12 },
        ],
        data: bookings
    }, format);
};

export default {
    exportToExcel,
    exportToPDF,
    exportData,
    exportProducts,
    exportCustomers,
    exportSales,
    exportInvoices,
    exportEmployees,
    exportBookings
};
