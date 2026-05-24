import { useMemo, useRef, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
import { useProducts } from '../../hooks/useData';
import { formatCurrency } from '../../utils/helpers';
import { categoryLabels } from '../../utils/constants';
import { Button, Modal } from '../ui';

import { HiOutlinePrinter, HiOutlineXMark as HiOutlineXMark } from 'react-icons/hi2';

interface InventoryPrintReportProps {
    isOpen: boolean;
    onClose: () => void;
    category?: string;
    status?: string;
    warehouseId?: string;
    search?: string;
    originModule?: string;
    autoAction?: 'print' | 'excel';
}

export default function InventoryPrintReport({ isOpen, onClose, category, status, warehouseId, search, originModule, autoAction }: InventoryPrintReportProps) {
    const { companySettings, loadCompanySettings } = useStore();
    const { products, isLoading } = useProducts({ 
        category, 
        status, 
        warehouseId, 
        search,
        originModule,
        limit: 1000
    });
    const printRef = useRef<HTMLDivElement>(null);

    // Ensure products is always an array
    const productsList = Array.isArray(products) ? products : [];

    // Load company settings when modal opens
    useEffect(() => {
        if (isOpen) {
            loadCompanySettings();
        }
    }, [isOpen, loadCompanySettings]);

    // Handle autoAction
    useEffect(() => {
        if (isOpen && !isLoading && autoAction && productsList.length > 0) {
            if (autoAction === 'excel') {
                handleExportExcel();
                onClose();
            } else if (autoAction === 'print') {
                handlePrint();
                onClose();
            }
        }
    }, [isOpen, isLoading, autoAction, productsList.length]);

    // Calculate totals and organize data
    const reportData = useMemo(() => {
        const sortedProducts = [...productsList].sort((a, b) => a.category.localeCompare(b.category));

        let grandTotalValue = 0;
        let grandTotalUnits = 0;
        let grandTotalBoxes = 0;
        let grandTotalWeight = 0;

        const productRows = sortedProducts.map((product) => {
            // Warehouse-aware stock calculation
            const displayStock = (warehouseId && warehouseId !== 'all')
                ? (product.warehouseStocks?.find(ws => ws.warehouseId === warehouseId)?.quantity ?? 0)
                : product.currentStock;

            const packSize = product.packSize && product.packSize > 1 ? product.packSize : 1;
            const boxes = Math.floor(displayStock / packSize);
            const units = displayStock % packSize;
            
            const unitWeight = product.weight ? (product.weight / packSize) : null;
            const totalWeight = unitWeight !== null ? unitWeight * displayStock : null;

            const totalValue = product.price * displayStock;
            grandTotalValue += totalValue;
            grandTotalUnits += displayStock;
            grandTotalBoxes += boxes;
            if (totalWeight !== null) grandTotalWeight += totalWeight;

            return {
                ...product,
                displayStock,
                totalValue,
                totalWeight,
                boxes,
                units,
                categoryLabel: categoryLabels[product.category] || product.category,
            };
        });

        const hasWeight = productRows.some(p => p.weight && p.weight > 0);

        // Format company info for display
        const company = {
            name: companySettings?.tradeName || companySettings?.companyName || 'Multicore',
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
            grandTotalWeight,
            hasWeight,
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
                <title>Inventário - ${reportData.company.name}</title>
                <meta charset="utf-8">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                    
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    
                    body { 
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                        padding: 0; 
                        background-color: white !important;
                        color: #0f172a !important;
                        line-height: 1.5;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .page {
                        padding: 50px;
                        position: relative;
                        min-height: 100vh;
                    }

                    .top-accent {
                        height: 6px;
                        background: linear-gradient(90deg, #4f46e5, #0ea5e9);
                        width: 100%;
                        position: absolute;
                        top: 0;
                        left: 0;
                    }

                    .print-container { max-width: 1100px; margin: 0 auto; }

                    /* Header Styles */
                    .header { 
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 50px;
                        padding-top: 20px;
                    }

                    .company-info { flex: 1; }
                    .company-info h2 { font-size: 26px; font-weight: 900; color: #1e293b; margin-bottom: 6px; letter-spacing: -0.02em; }
                    .company-info p { font-size: 11px; color: #64748b; margin-bottom: 3px; font-weight: 500; }
                    .company-info .tax-id { font-weight: 800; color: #475569; text-transform: uppercase; margin-top: 8px; font-size: 10px; }

                    .document-info { text-align: right; flex: 1; }
                    .document-info .title { 
                        font-size: 38px; 
                        font-weight: 900; 
                        color: #0f172a; 
                        letter-spacing: -0.04em;
                        line-height: 0.9;
                        margin-bottom: 20px;
                        text-transform: uppercase;
                    }
                    .document-info .meta-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 1px;
                        background: #e2e8f0;
                        border-radius: 8px;
                        overflow: hidden;
                        border: 1px solid #e2e8f0;
                        margin-left: auto;
                        width: fit-content;
                    }
                    .meta-item { 
                        background: #f8fafc;
                        padding: 10px 15px; 
                        text-align: left;
                        min-width: 140px;
                    }
                    .meta-label { font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 2px; }
                    .meta-value { font-size: 11px; font-weight: 700; color: #334155; }

                    /* Table Styles */
                    table.print-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 30px; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; background: #ffffff !important; }
                    th { 
                        background: #f1f5f9 !important; 
                        color: #475569 !important; 
                        text-align: left; 
                        padding: 14px 12px; 
                        font-size: 9px; 
                        font-weight: 900; 
                        text-transform: uppercase;
                        letter-spacing: 0.08em;
                        border-bottom: 2px solid #e2e8f0 !important;
                    }
                    td { 
                        padding: 12px; 
                        font-size: 11px; 
                        border-bottom: 1px solid #f1f5f9;
                        color: #334155;
                        background: white !important;
                    }
                    tr:nth-child(even) td { background-color: #f8fafc !important; }
                    tr:last-child td { border-bottom: none; }

                    .col-code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-weight: 600; color: #4f46e5; font-size: 10px; }
                    .col-name { font-weight: 800; color: #0f172a; font-size: 11px; }
                    .col-number { text-align: right; font-variant-numeric: tabular-nums; }
                    .col-stock { font-weight: 900; color: #0f172a; }
                    .col-total { font-weight: 900; color: #0f172a; background: rgba(79, 70, 229, 0.03) !important; }

                    /* Totals Dashboard */
                    .totals-dashboard { 
                        margin-top: 40px; 
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 20px;
                    }
                    .total-card { 
                        background: #f8fafc;
                        border-radius: 12px;
                        padding: 20px;
                        border: 1px solid #e2e8f0;
                        position: relative;
                    }
                    .total-card.highlight {
                        background: #0f172a;
                        color: white;
                        border: none;
                    }
                    .total-card.highlight .total-label { color: #94a3b8; }
                    .total-card.highlight .total-value { color: white; }
                    .total-card.highlight .grand-total { color: #10b981; }

                    .total-label { font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 8px; }
                    .total-value { font-size: 16px; font-weight: 900; color: #0f172a; }
                    .grand-total { font-size: 22px; }

                    /* Watermark */
                    .watermark {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-30deg);
                        font-size: 140px;
                        font-weight: 900;
                        color: rgba(226, 232, 240, 0.35);
                        z-index: -1;
                        pointer-events: none;
                        text-transform: uppercase;
                        letter-spacing: 0.3em;
                    }

                    /* Footer & Signatures */
                    .footer { margin-top: 80px; }
                    .signature-grid { 
                        display: grid; 
                        grid-template-columns: 1fr 1fr 1fr; 
                        gap: 40px;
                        margin-top: 50px;
                    }
                    .signature-box {
                        text-align: center;
                    }
                    .signature-line {
                        border-top: 2px solid #cbd5e1;
                        margin-bottom: 8px;
                        height: 40px;
                    }
                    .signature-label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                    
                    .stamp-placeholder {
                        width: 80px;
                        height: 80px;
                        border: 2px dashed #e2e8f0;
                        border-radius: 50%;
                        margin: 0 auto 10px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #cbd5e1;
                        font-size: 8px;
                        font-weight: 800;
                        text-transform: uppercase;
                    }

                    .branding { 
                        margin-top: 60px; 
                        text-align: center; 
                        font-size: 9px; 
                        color: #94a3b8; 
                        text-transform: uppercase;
                        letter-spacing: 0.2em;
                        font-weight: 700;
                    }

                    @media print {
                        body { padding: 0; }
                        .no-print { display: none !important; }
                        .page { padding: 40px; }
                        @page { margin: 0; }
                    }
                        gap: 60px;
                        margin-top: 40px;
                    }
                    .signature-line {
                        border-top: 1px solid #94a3b8;
                        padding-top: 8px;
                        text-align: center;
                    }
                    .signature-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
                    
                    .branding { 
                        margin-top: 40px; 
                        text-align: center; 
                        font-size: 9px; 
                        color: #cbd5e1; 
                        text-transform: uppercase;
                        letter-spacing: 0.1em;
                    }

                    @media print {
                        body { padding: 0; }
                        .no-print { display: none !important; }
                        .print-container { width: 100%; max-width: none; }
                        th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .totals-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="position: fixed; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 1000;">
                    <Button variant="ghost" onclick="window.print()" style="padding: 10px 24px; cursor: pointer; background: #0f172a; color: white; border: none; border-radius: 6px; font-weight: 700; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                         Confirmar Impressão
                    </Button>
                    <Button variant="ghost" onclick="window.close()" style="padding: 10px 24px; cursor: pointer; background: white; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 6px; font-weight: 700; font-size: 13px;">
                        Fechar
                    </Button>
                </div>

                <div class="print-container">
                <div class="page">
                    <div class="top-accent"></div>
                    <div class="print-container">
                        <!-- Header -->
                        <div class="header">
                            <div class="company-info">
                                ${companySettings?.logo ? `<img src="${companySettings.logo}" alt="Logo" style="height: 70px; margin-bottom: 25px; object-fit: contain; filter: grayscale(100%);">` : ''}
                                <h2>${reportData.company.name}</h2>
                                <p>${reportData.company.address}</p>
                                <p>Tel: ${reportData.company.phone} • Email: ${reportData.company.email}</p>
                                <p class="tax-id">NUIT: ${reportData.company.taxId}</p>
                            </div>
                            <div class="document-info">
                                <div class="title">Inventário</div>
                                <div class="meta-grid">
                                    <div class="meta-item">
                                        <span class="meta-label">Emissão</span>
                                        <span class="meta-value">${reportData.generatedAt.split(',')[0]}</span>
                                    </div>
                                    <div class="meta-item">
                                        <span class="meta-label">Documento</span>
                                        <span class="meta-value">#INV-${new Date().getTime().toString().slice(-6)}</span>
                                    </div>
                                    <div class="meta-item">
                                        <span class="meta-label">Responsável</span>
                                        <span class="meta-value">Admin</span>
                                    </div>
                                    <div class="meta-item">
                                        <span class="meta-label">Página</span>
                                        <span class="meta-value">1 de 1</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Table -->
                        <table class="print-table">
                            <thead>
                                <tr>
                                    <th style="width: 100px;">Referência</th>
                                    <th style="width: 120px;">Cód. Barras</th>
                                    <th>Produto</th>
                                    <th style="width: 80px; text-align: right;">Qtd. (Un)</th>
                                    <th style="width: 80px; text-align: right;">Caixas</th>
                                    <th style="width: 130px; text-align: right;">Valor Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${reportData.products.map(product => `
                                    <tr>
                                        <td class="col-code">${product.sku || '-'}</td>
                                        <td class="col-code">${product.barcode || '-'}</td>
                                        <td>
                                            <div class="col-name">${product.name}</div>
                                        </td>
                                        <td class="col-number col-stock">
                                            ${product.displayStock}
                                        </td>
                                        <td class="col-number">
                                            ${product.boxes}
                                        </td>
                                        <td class="col-number col-total">${formatCurrency(product.totalValue)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>

                        <!-- Totals Dashboard -->
                        <div class="totals-dashboard">
                            <div class="total-card">
                                <span class="total-label">Total Produtos</span>
                                <span class="total-value">${reportData.totalProducts}</span>
                            </div>
                            <div class="total-card">
                                <span class="total-label">Total Caixas</span>
                                <span class="total-value">${reportData.grandTotalBoxes}</span>
                            </div>
                            <div class="total-card">
                                <span class="total-label">Total Unidades</span>
                                <span class="total-value">${reportData.grandTotalUnits}</span>
                            </div>
                            <div class="total-card highlight">
                                <span class="total-label">Valor do Inventário</span>
                                <span class="total-value grand-total">${formatCurrency(reportData.grandTotalValue)}</span>
                            </div>
                        </div>

                        <!-- Signatures -->
                        <div class="footer">
                            <div class="signature-grid">
                                <div class="signature-box">
                                    <div class="stamp-placeholder">Carimbo</div>
                                    <div class="signature-line"></div>
                                    <div class="signature-label">Responsável pelo Inventário</div>
                                </div>
                                <div class="signature-box">
                                    <div class="stamp-placeholder">Carimbo</div>
                                    <div class="signature-line"></div>
                                    <div class="signature-label">Verificação Financeira</div>
                                </div>
                                <div class="signature-box">
                                    <div class="stamp-placeholder">Carimbo</div>
                                    <div class="signature-line"></div>
                                    <div class="signature-label">Direcção Geral</div>
                                </div>
                            </div>
                        </div>

                        <div class="branding">
                            Multicore ERP Solutions · Rastreabilidade e Gestão de Stock · ${new Date().getFullYear()}
                        </div>
                    </div>
                </div>
                <div class="watermark">MULTICORE</div>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleExportExcel = () => {
        const headers = ['REF', 'Cód. Barras', 'Produto', 'Categoria', 'Stock (Unid)', 'Caixas', 'Preço Unit', 'Valor Total'];
        const rows = reportData.products.map(p => [
            p.sku || '',
            p.barcode || '',
            p.name,
            p.categoryLabel,
            p.displayStock,
            p.boxes,
            p.price,
            p.totalValue
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.join(';'))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `inventario_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Visualização do Inventário"
            size="xl"
            isLight
        >
            <div className="space-y-6">
                {/* Modal Header Actions */}
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Relatório Gerado</p>
                        <h3 className="text-lg font-black text-slate-900">Pré-visualização do Documento</h3>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="ghost" 
                            onClick={onClose} 
                            leftIcon={<HiOutlineXMark className="w-4 h-4" />}
                            className="!text-slate-500 hover:!bg-slate-100 font-bold uppercase text-[10px] tracking-widest"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant="primary"
                            onClick={handlePrint} 
                            leftIcon={<HiOutlinePrinter className="w-4 h-4" />}
                            className="border-none font-bold uppercase text-[10px] tracking-widest px-8"
                        >
                            Imprimir
                        </Button>
                    </div>
                </div>

                {/* On-screen Preview (Minimal version of the print layout) */}
                <div ref={printRef} className="bg-white border border-slate-200 rounded-xl shadow-inner overflow-hidden">
                    <div className="p-10 max-h-[65vh] overflow-y-auto">
                        {isLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">A processar dados...</p>
                            </div>
                        ) : productsList.length === 0 ? (
                            <div className="py-20 text-center">
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum dado disponível para os filtros selecionados</p>
                            </div>
                        ) : (
                            <div className="print-container" style={{ width: '100%', pointerEvents: 'none' }}>
                                {/* Header Simple */}
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900">{reportData.company.name}</h2>
                                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">Relatório de Inventário</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</p>
                                        <p className="text-xs font-bold text-slate-900">{reportData.generatedAt}</p>
                                    </div>
                                </div>

                                {/* Table Preview */}
                                <table className="w-full print-table" style={{ backgroundColor: 'white' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: 'white' }}>
                                            <th style={{ backgroundColor: 'white', color: '#0f172a', padding: '12px', fontSize: '10px', textAlign: 'left', fontWeight: '800', textTransform: 'uppercase' }}>REF</th>
                                            <th style={{ backgroundColor: 'white', color: '#0f172a', padding: '12px', fontSize: '10px', textAlign: 'left', fontWeight: '800', textTransform: 'uppercase' }}>CÓDIGO</th>
                                            <th style={{ backgroundColor: 'white', color: '#0f172a', padding: '12px', fontSize: '10px', textAlign: 'left', fontWeight: '800', textTransform: 'uppercase' }}>PRODUTO</th>
                                            <th style={{ backgroundColor: 'white', color: '#0f172a', padding: '12px', fontSize: '10px', textAlign: 'right', fontWeight: '800', textTransform: 'uppercase' }}>UNID</th>
                                            <th style={{ backgroundColor: 'white', color: '#0f172a', padding: '12px', fontSize: '10px', textAlign: 'right', fontWeight: '800', textTransform: 'uppercase' }}>CAIXAS</th>
                                            <th style={{ backgroundColor: 'white', color: '#0f172a', padding: '12px', fontSize: '10px', textAlign: 'right', fontWeight: '800', textTransform: 'uppercase' }}>VALOR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.products.map((product) => (
                                            <tr key={product.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: 'white' }}>
                                                <td style={{ padding: '12px', fontSize: '10px', fontFamily: 'monospace', fontWeight: '700', color: '#0f172a', backgroundColor: 'white' }}>{product.sku || '-'}</td>
                                                <td style={{ padding: '12px', fontSize: '10px', fontFamily: 'monospace', color: '#64748b', backgroundColor: 'white' }}>{product.barcode || '-'}</td>
                                                <td style={{ padding: '12px', backgroundColor: 'white' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase' }}>{product.name}</div>
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontSize: '11px', fontWeight: '900', color: '#0f172a', backgroundColor: 'white' }}>
                                                    {product.displayStock}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontSize: '11px', fontWeight: '700', color: '#475569', backgroundColor: 'white' }}>
                                                    {product.boxes}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontSize: '11px', fontWeight: '900', color: '#0f172a', backgroundColor: 'white' }}>
                                                    {formatCurrency(product.totalValue)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Summary Box Preview */}
                                <div className="mt-8 flex justify-end">
                                    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', border: '1px solid #e2e8f0', minWidth: '350px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Unidades</span>
                                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>{reportData.grandTotalUnits}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Total Caixas</span>
                                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>{reportData.grandTotalBoxes}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                                            <span style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase' }}>Valor Total</span>
                                            <span style={{ fontSize: '20px', fontWeight: '900', color: '#059669' }}>{formatCurrency(reportData.grandTotalValue)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <HiOutlinePrinter className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-amber-900 uppercase tracking-tight">Dica de Impressão</p>
                        <p className="text-xs text-amber-700 mt-0.5">Para melhores resultados, certifique-se de habilitar "Gráficos de Segundo Plano" nas configurações de impressão do seu navegador.</p>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
