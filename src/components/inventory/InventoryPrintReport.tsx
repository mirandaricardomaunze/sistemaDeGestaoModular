import { useMemo, useRef, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
import { useProducts } from '../../hooks/useData';
import { formatCurrency } from '../../utils/helpers';
import { categoryLabels } from '../../utils/constants';
import { Button, Modal } from '../ui';

import { HiOutlinePrinter, HiOutlineX } from 'react-icons/hi';

interface InventoryPrintReportProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function InventoryPrintReport({ isOpen, onClose }: InventoryPrintReportProps) {
    const { companySettings, loadCompanySettings } = useStore();
    const { products } = useProducts();
    const printRef = useRef<HTMLDivElement>(null);

    // Refresh company settings when modal opens
    useEffect(() => {
        if (isOpen) {
            loadCompanySettings();
        }
    }, [isOpen, loadCompanySettings]);

    // Ensure products is always an array
    const productsList = Array.isArray(products) ? products : [];

    // Calculate totals and organize data
    const reportData = useMemo(() => {
        const sortedProducts = [...productsList].sort((a, b) => a.category.localeCompare(b.category));

        let grandTotalValue = 0;
        let grandTotalUnits = 0;
        let grandTotalBoxes = 0;

        const productRows = sortedProducts.map((product) => {
            const totalValue = product.price * product.currentStock;
            grandTotalValue += totalValue;
            grandTotalUnits += product.unit === 'un' ? product.currentStock : 0;
            grandTotalBoxes += product.unit === 'cx' ? product.currentStock : 0;

            return {
                ...product,
                totalValue,
                categoryLabel: categoryLabels[product.category] || product.category,
            };
        });

        // Debug log
        console.log('Inventory Report - Company Settings:', companySettings);

        // Format company info for display (with robust null safety)
        const company = {
            name: companySettings?.companyName || 'Empresa Padrão',
            address: [
                companySettings?.address,
                companySettings?.city,
                companySettings?.province
            ].filter(Boolean).join(' - ') || 'Endereço não configurado',
            phone: companySettings?.phone || '',
            email: companySettings?.email || '',
            taxId: companySettings?.taxId || '',
        };

        return {
            products: productRows,
            grandTotalValue,
            grandTotalUnits,
            grandTotalBoxes,
            totalProducts: productsList.length,
            generatedAt: new Date().toLocaleString('pt-BR'),
            company,
        };
    }, [productsList, companySettings]);

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Inventário</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        font-size: 12px;
                        line-height: 1.4;
                        color: #333;
                        padding: 20px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                        padding-bottom: 15px;
                        border-bottom: 2px solid #333;
                    }
                    .header h1 {
                        font-size: 24px;
                        margin-bottom: 5px;
                    }
                    .header p {
                        color: #666;
                        font-size: 11px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px 6px;
                        text-align: left;
                    }
                    th {
                        background-color: #f5f5f5;
                        font-weight: 600;
                        font-size: 11px;
                        text-transform: uppercase;
                    }
                    td {
                        font-size: 11px;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .text-center {
                        text-align: center;
                    }
                    .font-mono {
                        font-family: 'Courier New', monospace;
                    }
                    .font-bold {
                        font-weight: 600;
                    }
                    .total-row {
                        background-color: #f0f0f0;
                        font-weight: 600;
                    }
                    .summary {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 20px;
                        padding: 15px;
                        background-color: #f5f5f5;
                        border-radius: 4px;
                    }
                    .summary-item {
                        text-align: center;
                    }
                    .summary-item strong {
                        display: block;
                        font-size: 18px;
                        color: #333;
                    }
                    .summary-item span {
                        font-size: 10px;
                        color: #666;
                        text-transform: uppercase;
                    }
                    .footer {
                        margin-top: 30px;
                        text-align: center;
                        font-size: 10px;
                        color: #999;
                    }
                    @media print {
                        body { padding: 10px; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Relatório de Inventário" size="xl">
            <div className="space-y-4">
                {/* Action Buttons */}
                <div className="flex justify-end gap-3 no-print">
                    <Button variant="ghost" onClick={onClose} leftIcon={<HiOutlineX className="w-4 h-4" />}>
                        Fechar
                    </Button>
                    <Button onClick={handlePrint} leftIcon={<HiOutlinePrinter className="w-4 h-4" />}>
                        Imprimir
                    </Button>
                </div>

                {/* Printable Content */}
                <div ref={printRef} className="bg-white p-6 rounded-lg max-h-[60vh] overflow-y-auto">
                    {/* Company Header */}
                    <div className="text-center mb-4 pb-4 border-b border-gray-300">
                        {companySettings?.logo && (
                            <img src={companySettings.logo} alt="Logo" className="h-16 mx-auto mb-2 object-contain" />
                        )}
                        <h2 className="text-xl font-bold text-gray-900">{reportData.company.name}</h2>
                        <p className="text-sm text-gray-600 mt-1">{reportData.company.address}</p>
                        <p className="text-sm text-gray-600">Tel: {reportData.company.phone} | Email: {reportData.company.email}</p>
                        <p className="text-sm text-gray-600">NUIT: {reportData.company.taxId}</p>
                    </div>

                    {/* Report Title */}
                    <div className="header text-center mb-6 pb-4 border-b-2 border-gray-800">
                        <h1 className="text-2xl font-bold text-gray-900">RELATÓRIO DE INVENTÁRIO</h1>
                        <p className="text-gray-500 text-sm mt-1">Gerado em: {reportData.generatedAt}</p>
                    </div>

                    {/* Table */}
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-xs uppercase">Código</th>
                                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-xs uppercase">Produto</th>
                                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-xs uppercase">Categoria</th>
                                <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-xs uppercase">Un.</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-xs uppercase">Qtd.</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-xs uppercase">Preço Unit.</th>
                                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-xs uppercase">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.products.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 px-3 py-2 font-mono text-xs">
                                        {product.code}
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2">
                                        <div>
                                            <p className="font-medium">{product.name}</p>
                                            {product.barcode && (
                                                <p className="text-xs text-gray-500 font-mono">{product.barcode}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-gray-600">
                                        {product.categoryLabel}
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-center">
                                        {product.unit}
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                                        {product.currentStock}
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right">
                                        {formatCurrency(product.price)}
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                                        {formatCurrency(product.totalValue)}
                                    </td>
                                </tr>
                            ))}
                            {/* Total Row */}
                            <tr className="total-row bg-gray-200 font-bold">
                                <td colSpan={4} className="border border-gray-300 px-3 py-3 text-right font-semibold">
                                    TOTAIS:
                                </td>
                                <td className="border border-gray-300 px-3 py-3 text-right font-semibold">
                                    -
                                </td>
                                <td className="border border-gray-300 px-3 py-3 text-right font-semibold">
                                    -
                                </td>
                                <td className="border border-gray-300 px-3 py-3 text-right font-bold text-lg">
                                    {formatCurrency(reportData.grandTotalValue)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Summary Cards */}
                    <div className="summary grid grid-cols-4 gap-4 mt-6 p-4 bg-gray-100 rounded-lg">
                        <div className="summary-item text-center">
                            <strong className="text-xl font-bold text-gray-900">{reportData.totalProducts}</strong>
                            <span className="text-xs text-gray-500 uppercase block">Produtos</span>
                        </div>
                        <div className="summary-item text-center">
                            <strong className="text-xl font-bold text-gray-900">{reportData.grandTotalUnits}</strong>
                            <span className="text-xs text-gray-500 uppercase block">Total Unidades</span>
                        </div>
                        <div className="summary-item text-center">
                            <strong className="text-xl font-bold text-gray-900">{reportData.grandTotalBoxes}</strong>
                            <span className="text-xs text-gray-500 uppercase block">Total Caixas</span>
                        </div>
                        <div className="summary-item text-center">
                            <strong className="text-xl font-bold text-primary-600">{formatCurrency(reportData.grandTotalValue)}</strong>
                            <span className="text-xs text-gray-500 uppercase block">Valor Total</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="footer mt-8 text-center text-xs text-gray-400">
                        <p>Sistema de Gestão Empresarial - Relatório gerado automaticamente</p>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
