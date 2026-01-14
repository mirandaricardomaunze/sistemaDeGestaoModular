/**
 * ExportButton Component
 * 
 * Reusable button with dropdown menu for exporting data to Excel or PDF
 * Can be easily integrated into any page with tabular data
 */

import { useState, useRef, useEffect } from 'react';
import { HiOutlineDownload, HiOutlineDocumentText, HiOutlineTable } from 'react-icons/hi';
import { Button } from '../ui';
import type { ExportOptions, ExportFormat } from '../../utils/exportUtils';
import { exportData } from '../../utils/exportUtils';

interface ExportButtonProps {
    /** Export options including columns and data */
    options: Omit<ExportOptions, 'filename' | 'title'> & {
        filename?: string;
        title?: string;
    };
    /** Base filename for the export (without extension) */
    filename: string;
    /** Title to show in the exported document */
    title: string;
    /** Button variant */
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    /** Button size */
    size?: 'sm' | 'md' | 'lg';
    /** Custom button text */
    buttonText?: string;
    /** Whether to show icon */
    showIcon?: boolean;
    /** Disabled state */
    disabled?: boolean;
    /** Custom class names */
    className?: string;
    /** Callback after export */
    onExport?: (format: ExportFormat) => void;
}

export default function ExportButton({
    options,
    filename,
    title,
    variant = 'outline',
    size = 'sm',
    buttonText = 'Exportar',
    showIcon = true,
    disabled = false,
    className = '',
    onExport
}: ExportButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleExport = async (format: ExportFormat) => {
        setIsExporting(true);
        setIsOpen(false);

        try {
            // Small delay for UX
            await new Promise(resolve => setTimeout(resolve, 100));

            exportData({
                ...options,
                filename,
                title
            }, format);

            onExport?.(format);
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className={`relative inline-block ${className}`} ref={dropdownRef}>
            <Button
                variant={variant}
                size={size}
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled || isExporting || !options.data?.length}
                leftIcon={showIcon ? <HiOutlineDownload className="w-4 h-4" /> : undefined}
            >
                {isExporting ? 'Exportando...' : buttonText}
            </Button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-800 rounded-lg shadow-xl border border-gray-200 dark:border-dark-700 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="py-1">
                        {/* Excel Option */}
                        <button
                            onClick={() => handleExport('excel')}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                        >
                            <HiOutlineTable className="w-5 h-5 text-green-600" />
                            <div className="text-left">
                                <p className="font-medium">Excel (.xlsx)</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Folha de cálculo</p>
                            </div>
                        </button>

                        {/* PDF Option */}
                        <button
                            onClick={() => handleExport('pdf')}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
                        >
                            <HiOutlineDocumentText className="w-5 h-5 text-red-600" />
                            <div className="text-left">
                                <p className="font-medium">PDF</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Documento formatado</p>
                            </div>
                        </button>
                    </div>

                    {/* Data count */}
                    <div className="px-4 py-2 bg-gray-50 dark:bg-dark-900 border-t border-gray-200 dark:border-dark-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {options.data?.length || 0} registos a exportar
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Quick Export Buttons for Common Entities
// ============================================================================

interface QuickExportProps {
    data: any[];
    companyName?: string;
    className?: string;
}

export function ExportProductsButton({ data, companyName, className }: QuickExportProps) {
    return (
        <ExportButton
            filename="produtos"
            title="Lista de Produtos"
            className={className}
            options={{
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
                data
            }}
        />
    );
}

export function ExportCustomersButton({ data, companyName, className }: QuickExportProps) {
    return (
        <ExportButton
            filename="clientes"
            title="Lista de Clientes"
            className={className}
            options={{
                companyName,
                columns: [
                    { key: 'code', header: 'Código', width: 12 },
                    { key: 'name', header: 'Nome', width: 25 },
                    { key: 'email', header: 'Email', width: 25 },
                    { key: 'phone', header: 'Telefone', width: 15 },
                    { key: 'nuit', header: 'NUIT', width: 15 },
                    { key: 'totalPurchases', header: 'Total Compras', format: 'currency', width: 15 },
                ],
                data
            }}
        />
    );
}

export function ExportSalesButton({ data, companyName, className }: QuickExportProps) {
    return (
        <ExportButton
            filename="vendas"
            title="Relatório de Vendas"
            className={className}
            options={{
                companyName,
                orientation: 'landscape',
                columns: [
                    { key: 'receiptNumber', header: 'Nº Recibo', width: 15 },
                    { key: 'createdAt', header: 'Data', format: 'datetime', width: 18 },
                    { key: 'customer.name', header: 'Cliente', width: 20 },
                    { key: 'subtotal', header: 'Subtotal', format: 'currency', width: 15 },
                    { key: 'discount', header: 'Desconto', format: 'currency', width: 12 },
                    { key: 'total', header: 'Total', format: 'currency', width: 15 },
                    { key: 'paymentMethod', header: 'Pagamento', width: 12 },
                ],
                data
            }}
        />
    );
}

export function ExportInvoicesButton({ data, companyName, className }: QuickExportProps) {
    return (
        <ExportButton
            filename="facturas"
            title="Lista de Facturas"
            className={className}
            options={{
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
                data
            }}
        />
    );
}

export function ExportBookingsButton({ data, companyName, className }: QuickExportProps) {
    return (
        <ExportButton
            filename="reservas"
            title="Lista de Reservas"
            className={className}
            options={{
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
                data
            }}
        />
    );
}

export function ExportEmployeesButton({ data, companyName, className }: QuickExportProps) {
    return (
        <ExportButton
            filename="funcionarios"
            title="Lista de Colaboradores"
            className={className}
            options={{
                companyName,
                orientation: 'landscape',
                columns: [
                    { key: 'code', header: 'ID', width: 10 },
                    { key: 'name', header: 'Nome', width: 25 },
                    { key: 'role', header: 'Cargo', width: 15 },
                    { key: 'department', header: 'Departamento', width: 15 },
                    { key: 'email', header: 'Email', width: 25 },
                    { key: 'phone', header: 'Telefone', width: 15 },
                    { key: 'salary', header: 'Salário', format: 'currency', width: 15 },
                    { key: 'idNumber', header: 'Documento', width: 15 },
                    { key: 'isActive', header: 'Estado', width: 10 },
                ],
                data
            }}
        />
    );
}

export function ExportSuppliersButton({ data, companyName, className }: QuickExportProps) {
    return (
        <ExportButton
            filename="fornecedores"
            title="Lista de Fornecedores"
            className={className}
            options={{
                companyName,
                orientation: 'landscape',
                columns: [
                    { key: 'code', header: 'ID', width: 10 },
                    { key: 'name', header: 'Nome', width: 25 },
                    { key: 'nuit', header: 'NUIT', width: 15 },
                    { key: 'contactPerson', header: 'Contacto', width: 20 },
                    { key: 'phone', header: 'Telefone', width: 15 },
                    { key: 'email', header: 'Email', width: 25 },
                    { key: 'paymentTerms', header: 'Prazo Pag.', width: 15 },
                    { key: 'totalPurchases', header: 'T. Compras', format: 'currency', width: 15 },
                    { key: 'currentBalance', header: 'Saldo', format: 'currency', width: 15 },
                ],
                data
            }}
        />
    );
}


