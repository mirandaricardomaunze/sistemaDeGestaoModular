import { logger } from '../../utils/logger';
/**
 * ExportButton Component
 * 
 * Reusable button with dropdown menu for exporting data to Excel or PDF
 * Can be easily integrated into any page with tabular data
 */

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlineArrowDownTray, HiOutlineDocumentText, HiOutlineTableCells } from 'react-icons/hi2';
import { Button } from '../ui/Button';
import type { ExportOptions, ExportFormat } from '../../utils/exportUtils';
import { exportData } from '../../utils/exportUtils';
import { useStore } from '../../stores/useStore';
import { cn } from '../../utils/helpers';

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
    /** Company info object */
    companyInfo?: {
        name: string;
        nuit?: string;
        address?: string;
        phone?: string;
        email?: string;
    };
    /** Disabled state */
    disabled?: boolean;
    /** Custom class names */
    className?: string;
    /** Callback after export */
    onExport?: (format: ExportFormat) => void;
}
export function ExportButton({
    options,
    filename,
    title,
    variant = 'primary',
    size = 'md',
    buttonText = 'Exportar',
    showIcon = true,
    disabled = false,
    className = '',
    onExport,
    companyInfo
}: ExportButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

    // Close dropdown when clicking outside (covers both trigger area and portaled menu).
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (wrapperRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Position the portaled menu under the trigger and keep it pinned on
    // scroll/resize. Uses fixed positioning so it escapes overflow-hidden ancestors.
    useLayoutEffect(() => {
        if (!isOpen) return;
        const MENU_WIDTH = 192; // matches w-48
        const updatePos = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            setMenuPos({
                top: rect.bottom + 8,
                left: Math.max(8, rect.right - MENU_WIDTH),
            });
        };
        updatePos();
        window.addEventListener('scroll', updatePos, true);
        window.addEventListener('resize', updatePos);
        return () => {
            window.removeEventListener('scroll', updatePos, true);
            window.removeEventListener('resize', updatePos);
        };
    }, [isOpen]);

    const handleExport = async (format: ExportFormat) => {
        setIsExporting(true);
        setIsOpen(false);

        try {
            // Small delay for UX
            await new Promise(resolve => setTimeout(resolve, 100));

            exportData({
                ...options,
                filename,
                title,
                companyName: companyInfo?.name || options.companyName,
                companyNUIT: companyInfo?.nuit,
                companyAddress: companyInfo?.address,
                companyPhone: companyInfo?.phone,
                companyEmail: companyInfo?.email
            }, format);

            onExport?.(format);
        } catch (error) {
            logger.error('Export error:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className={cn("relative inline-block", className)} ref={wrapperRef}>
            <div ref={triggerRef} className="w-full">
                <Button
                    variant={variant}
                    size={size}
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={disabled || isExporting || !options.data?.length}
                    leftIcon={showIcon ? <HiOutlineArrowDownTray className="w-4 h-4" /> : undefined}
                    className="w-full"
                >
                    {isExporting ? 'Exportando...' : buttonText}
                </Button>
            </div>

            {/* Dropdown Menu — portaled to body with fixed positioning so it
                escapes any `overflow-hidden` ancestor (e.g. PageHeader). */}
            {isOpen && menuPos && createPortal(
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: 192 }}
                    className="bg-white dark:bg-dark-800 rounded-xl shadow-card-hover border border-slate-300/70 dark:border-dark-700 overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    <div className="py-1">
                        {/* Excel Option */}
                        <Button variant="ghost"
                            onClick={() => handleExport('excel')}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-dark-700 transition-colors"
                        >
                            <HiOutlineTableCells className="w-5 h-5 text-green-600" />
                            <div className="text-left">
                                <p className="font-semibold">Excel (.xlsx)</p>
                                <p className="text-xs text-slate-600 dark:text-gray-400">Folha de cálculo</p>
                            </div>
                        </Button>

                        {/* PDF Option */}
                        <Button variant="ghost"
                            onClick={() => handleExport('pdf')}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-dark-700 transition-colors"
                        >
                            <HiOutlineDocumentText className="w-5 h-5 text-red-600" />
                            <div className="text-left">
                                <p className="font-semibold">PDF</p>
                                <p className="text-xs text-slate-600 dark:text-gray-400">Documento formatado</p>
                            </div>
                        </Button>
                    </div>

                    {/* Data count */}
                    <div className="px-4 py-2 bg-slate-50 dark:bg-dark-900 border-t border-slate-200 dark:border-dark-700">
                        <p className="text-xs text-slate-600 dark:text-gray-400">
                            {options.data?.length || 0} registos a exportar
                        </p>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

// ============================================================================
// Quick Export Buttons for Common Entities
// ============================================================================

type ExportRow = Record<string, unknown>;

interface QuickExportProps {
    data: object[];
    companyName?: string;
    companyInfo?: {
        name: string;
        nuit?: string;
        address?: string;
        phone?: string;
        email?: string;
    };
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

export function ExportProductsButton({ data, className, size = 'md' }: Omit<QuickExportProps, 'companyInfo'>) {
    const { companySettings } = useStore();
    type ProductRow = ExportRow & { packSize?: number; currentStock?: number; price?: number; category?: string; categoryModel?: { name?: string } | null };
    const formattedData = (data as ProductRow[]).map(p => {
        const packSize = p.packSize && p.packSize > 1 ? p.packSize : 1;
        const stock = Number(p.currentStock ?? 0);
        const boxes = Math.floor(stock / packSize);

        return {
            ...p,
            boxCount: boxes,
            totalUnits: stock,
            totalValue: stock * Number(p.price ?? 0),
            categoryName: p.categoryModel?.name || p.category
        };
    });

    return (
        <ExportButton
            filename="inventario"
            title="Inventário"
            className={className}
            size={size}
            companyInfo={{
                name: companySettings?.companyName || 'MULTICORE',
                nuit: companySettings?.taxId,
                address: companySettings?.address,
                phone: companySettings?.phone,
                email: companySettings?.email
            }}
            options={{
                columns: [
                    { key: 'barcode', header: 'Código de Barras', width: 12 },
                    { key: 'sku', header: 'Referência', width: 12 },
                    { key: 'name', header: 'Nome', width: 28 },
                    { key: 'boxCount', header: 'Caixas', format: 'number', width: 8, align: 'right' },
                    { key: 'totalUnits', header: 'Qtd. (Un)', format: 'number', width: 8, align: 'right' },
                    { key: 'price', header: 'Preço Unit', format: 'currency', width: 16, align: 'right' },
                    { key: 'totalValue', header: 'Valor Total', format: 'currency', width: 16, align: 'right' },
                ],
                data: formattedData
            }}
        />
    );
}

export function ExportCustomersButton({ data, companyName, className, size = 'md', variant }: QuickExportProps) {
    return (
        <ExportButton
            filename="clientes"
            title="Lista de Clientes"
            className={className}
            size={size}
            variant={variant}
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

export function ExportSalesButton({ data, companyName, className, size = 'md' }: QuickExportProps) {
    return (
        <ExportButton
            filename="vendas"
            title="Relatório de Vendas"
            className={className}
            size={size}
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

export function ExportInvoicesButton({ data, companyName, className, size = 'md', variant }: QuickExportProps) {
    return (
        <ExportButton
            filename="facturas"
            title="Lista de Facturas"
            className={className}
            size={size}
            variant={variant}
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

export function ExportBookingsButton({ data, companyName, className, size = 'md' }: QuickExportProps) {
    return (
        <ExportButton
            filename="reservas"
            title="Lista de Reservas"
            className={className}
            size={size}
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

export function ExportEmployeesButton({ data, companyName, className, size = 'md' }: QuickExportProps) {
    return (
        <ExportButton
            filename="funcionarios"
            title="Lista de Colaboradores"
            className={className}
            size={size}
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

export function ExportSuppliersButton({ data, companyName, className, size = 'md', variant }: QuickExportProps) {
    return (
        <ExportButton
            filename="fornecedores"
            title="Lista de Fornecedores"
            className={className}
            size={size}
            variant={variant}
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

export function ExportVehiclesButton({ data, companyName, className, size = 'md' }: QuickExportProps) {
    return (
        <ExportButton
            filename="veiculos"
            title="Frota de Veículos"
            className={className}
            size={size}
            options={{
                companyName,
                columns: [
                    { key: 'plate', header: 'Matrícula', width: 15 },
                    { key: 'brand', header: 'Marca', width: 15 },
                    { key: 'model', header: 'Modelo', width: 15 },
                    { key: 'type', header: 'Tipo', width: 12 },
                    { key: 'capacity', header: 'Capacidade', width: 12 },
                    { key: 'mileage', header: 'Kms', format: 'number', width: 12 },
                    { key: 'status', header: 'Estado', width: 12 },
                ],
                data
            }}
        />
    );
}

export function ExportDeliveriesButton({ data, companyName, className, size = 'md' }: QuickExportProps) {
    return (
        <ExportButton
            filename="entregas"
            title="Relatório de Entregas"
            className={className}
            size={size}
            options={{
                companyName,
                orientation: 'landscape',
                columns: [
                    { key: 'number', header: 'Nº Entrega', width: 15 },
                    { key: 'recipientName', header: 'Destinatrio', width: 20 },
                    { key: 'deliveryAddress', header: 'Endereço', width: 30 },
                    { key: 'driver.name', header: 'Motorista', width: 15 },
                    { key: 'vehicle.plate', header: 'Veículo', width: 12 },
                    { key: 'shippingCost', header: 'Custo', format: 'currency', width: 15 },
                    { key: 'status', header: 'Estado', width: 12 },
                    { key: 'priority', header: 'Prioridade', width: 12 },
                ],
                data
            }}
        />
    );
}

export function ExportRoomsButton({ data, companyName, className, size = 'md' }: QuickExportProps) {
    return (
        <ExportButton
            filename="quartos"
            title="Estado dos Quartos"
            className={className}
            size={size}
            options={{
                companyName,
                columns: [
                    { key: 'number', header: 'Nº Quarto', width: 15 },
                    { key: 'type', header: 'Tipo', width: 15 },
                    { key: 'price', header: 'Preço/Noite', format: 'currency', width: 15 },
                    { key: 'status', header: 'Estado', width: 15 },
                    { key: 'notes', header: 'Notas', width: 30 },
                ],
                data
            }}
        />
    );
}
export function ExportBatchesButton({ data, companyInfo, className, size = 'md' }: QuickExportProps) {
    type BatchRow = ExportRow & { warehouse?: { name?: string } | null; product?: { name?: string } | null; expiryDate?: string | Date | null };
    const formattedData = (data as BatchRow[]).map(b => ({
        ...b,
        warehouseName: b.warehouse?.name || 'N/A',
        productName: b.product?.name || 'N/A',
        expiryDate: b.expiryDate ? new Date(b.expiryDate as string | Date).toLocaleDateString() : 'N/A'
    }));

    return (
        <ExportButton
            filename="lotes_inventario"
            title="Relatório de Lotes e Validades"
            className={className}
            size={size}
            companyInfo={companyInfo}
            options={{
                columns: [
                    { key: 'productName', header: 'Produto', width: 25 },
                    { key: 'batchNumber', header: 'Lote', width: 15 },
                    { key: 'warehouseName', header: 'Armazém', width: 15 },
                    { key: 'quantity', header: 'Qtd Atual', format: 'number', width: 10, align: 'right' },
                    { key: 'expiryDate', header: 'Validade', width: 15 },
                    { key: 'status', header: 'Estado', width: 12 },
                ],
                data: formattedData,
                subtitle: "Rastreio completo de lotes, armazéns e datas de expiração"
            }}
        />
    );
}
