import { logger } from '../../utils/logger';
import { useMemo, useRef, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
import { useProducts } from '../../hooks/useData';
import { formatCurrency } from '../../utils/helpers';
import { categoryLabels } from '../../utils/constants';
import { Button, Modal } from '../ui';

import { HiOutlinePrinter, HiOutlineXMark as HiOutlineX } from 'react-icons/hi2';

interface InventoryPrintReportProps {
    isOpen: boolean;
    onClose: () => void;
    category?: string;
}

export default function InventoryPrintReport({ isOpen, onClose, category }: InventoryPrintReportProps) {
    const { companySettings, loadCompanySettings } = useStore();
    const { products } = useProducts({ category });
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
            grandTotalUnits += product.currentStock; // Sum all quantities regardless of unit for a general total
            grandTotalBoxes += product.unit === 'cx' ? product.currentStock : 0;

            return {
                ...product,
                totalValue,
                categoryLabel: categoryLabels[product.category] || product.category,
            };
        });

        // Debug log
        logger.info('Inventory Report - Company Settings:', companySettings);

        // Format company info for display (with robust null safety)
        const company = {
            name: companySettings?.tradeName || companySettings?.companyName || 'Empresa Padrão',
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
                <meta name="color-scheme" content="light">
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                                   body { 
                        font-family: 'Inter', system-ui, sans-serif; 
                        padding: 30px; 
                        background-color: white !important;
                        color: #1e293b !important;
                    }
                    .header { margin-bottom: 30px; }
                    .header h1 { 
                        font-size: 20px; 
                        font-weight: 900; 
                        text-transform: uppercase; 
                        letter-spacing: 0.1em;
                        margin: 0;
                        padding-bottom: 10px;
                        border: none !important;
                        display: inline-block;
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-top: 20px;
                        border: none !important;
                    }
                    th { 
                        text-align: left; 
                        padding: 16px 12px; 
                        font-size: 10px; 
                        text-transform: uppercase;
                        font-weight: 900;
                        color: #64748b;
                        background-color: #f8fafc !important;
                        border-bottom: 1px solid #f1f5f9 !important;
                        letter-spacing: 0.15em;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    td { 
                        padding: 14px 12px; 
                        font-size: 11px;
                        border-bottom: 1px solid #f8fafc !important;
                    }
                    .total-row td {
                        font-weight: 900;
                        font-size: 14px;
                        padding-top: 24px;
                        padding-bottom: 24px;
                        border-top: 2px solid #0f172a !important;
                        border-bottom: none !important;
                        color: #0f172a !important;
                    }
                    .font-mono { font-family: ui-monospace, monospace; }
                    .footer {
                        margin-top: 40px;
                        text-align: center;
                        font-size: 10px;
                        color: #94a3b8;
                    }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none !important; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="text-align: right; margin-bottom: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; background: #1e293b; color: white; border: none; border-radius: 4px; font-weight: bold;">
                         Confirmar Impressão
                    </button>
                    <button onclick="window.close()" style="padding: 10px 20px; cursor: pointer; background: #f1f5f9; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 4px; font-weight: bold; margin-left: 10px;">
                        Fechar
                    </button>
                </div>
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
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Relatório de Inventário" 
            size="xl"
            isLight
        >
            <div className="space-y-4">
                {/* Action Buttons */}
                <div className="flex justify-end gap-3 no-print">
                    <Button 
                        variant="ghost" 
                        onClick={onClose} 
                        leftIcon={<HiOutlineX className="w-4 h-4" />}
                        className="!text-slate-500 hover:!bg-slate-100"
                    >
                        Fechar
                    </Button>
                    <Button 
                        onClick={handlePrint} 
                        leftIcon={<HiOutlinePrinter className="w-4 h-4" />}
                        className="bg-slate-900 hover:bg-slate-800 text-white border-none shadow-none"
                    >
                        Imprimir
                    </Button>
                </div>

                {/* Printable Content */}
                <div ref={printRef} className="bg-white text-slate-900 p-8 rounded-lg max-h-[60vh] overflow-y-auto" style={{ backgroundColor: 'white !important', color: '#0f172a !important', maxWidth: '850px', margin: '0 auto' }}>
                    {/* Company Header */}
                    <div className="text-left mb-6 pb-4" style={{ backgroundColor: 'white !important' }}>
                        {companySettings?.logo && (
                            <img src={companySettings.logo} alt="Logo" className="h-14 mb-3 object-contain" />
                        )}
                        <h2 className="text-lg font-extrabold text-slate-900 tracking-tight" style={{ color: '#0f172a !important' }}>{reportData.company.name}</h2>
                        <div className="space-y-0.5 mt-2">
                            <p className="text-[11px] text-slate-500 font-medium">{reportData.company.address}</p>
                            <p className="text-[11px] text-slate-500">Tel: {reportData.company.phone} • Email: {reportData.company.email}</p>
                            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">NUIT: {reportData.company.taxId}</p>
                        </div>
                    </div>

                    {/* Report Title */}
                    <div className="header text-left mb-6" style={{ backgroundColor: 'white !important' }}>
                        <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest" style={{ color: '#0f172a !important', display: 'inline-block', paddingBottom: '4px' }}>
                            RELATÓRIO DE INVENTÁRIO
                        </h1>
                        <p className="text-slate-400 text-[10px] mt-2 font-bold italic">GERADO EM: {reportData.generatedAt}</p>
                    </div>

                    <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white !important' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '160px' }}>Código</th>
                                <th style={{ width: 'auto' }}>Produto</th>
                                <th style={{ width: '120px' }}>Referência</th>
                                <th style={{ width: '80px' }}>Qtd.</th>
                                <th style={{ width: '140px' }}>Preço Unit.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.products.map((product) => (
                                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="font-mono" style={{ fontWeight: '800', color: '#0f172a', letterSpacing: '-0.025em' }}>
                                        {product.barcode || '-'}
                                    </td>
                                    <td>
                                        <h3 className="product-name font-black uppercase tracking-tight text-[#0f172a]">{product.name}</h3>
                                    </td>
                                    <td>
                                        <span className="sku-text font-bold text-slate-500">{product.sku || '-'}</span>
                                    </td>
                                    <td style={{ fontWeight: '900', fontSize: '14px', color: '#0f172a' }}>
                                        {formatCurrency(product.currentStock).replace('MTn', '').trim()}
                                    </td>
                                    <td className="font-black" style={{ color: '#64748b' }}>
                                        {formatCurrency(product.price)}
                                    </td>
                                </tr>
                            ))}
                            {/* Total Row */}
                             <tr className="total-row">
                                <td colSpan={3} className="text-right">
                                    <span className="label-totals uppercase tracking-[0.2em] text-[10px] text-slate-400">TOTAIS GERAIS :</span>
                                </td>
                                <td>
                                    <span className="val-total font-black tracking-tighter">
                                        {formatCurrency(reportData.grandTotalUnits).replace('MTn', '').trim()}
                                    </span>
                                </td>
                                <td>
                                    <span className="val-price font-black tracking-tighter text-blue-600">
                                        {formatCurrency(reportData.grandTotalValue)}
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Footer */}
                    <div className="footer mt-8 text-center text-xs text-gray-400">
                        <p>Multicore - Relatório gerado automaticamente</p>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
