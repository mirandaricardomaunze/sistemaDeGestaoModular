import { useMemo, useRef, useEffect } from 'react';
import { useStore } from '../../stores/useStore';
import { useBatches } from '../../hooks/useBatches';
import { Button, Modal } from '../ui';
import { HiOutlinePrinter, HiOutlineXMark as HiOutlineXMark, HiOutlineTableCells, HiOutlineDocumentText } from 'react-icons/hi2';

interface BatchPrintReportProps {
    isOpen: boolean;
    onClose: () => void;
    productId?: string;
    status?: string;
    search?: string;
    autoAction?: 'print' | 'excel';
}

const STATUS_LABELS: Record<string, string> = {
    active: 'ACTIVO',
    expiring_soon: 'A EXPIRAR',
    expired: 'EXPIRADO',
    depleted: 'ESGOTADO',
    quarantine: 'QUARENTENA',
};

export default function BatchPrintReport({ isOpen, onClose, productId, status, search, autoAction }: BatchPrintReportProps) {
    const { companySettings, loadCompanySettings } = useStore();
    const { data: batchesData, isLoading } = useBatches({ 
        productId, 
        status, 
        search,
        page: 1,
        limit: 1000 
    });
    
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadCompanySettings();
        }
    }, [isOpen, loadCompanySettings]);

    const batches = useMemo(
        () => Array.isArray(batchesData?.data) ? batchesData.data : [],
        [batchesData?.data]
    );

    // Handle autoAction
    useEffect(() => {
        if (isOpen && !isLoading && autoAction && batches.length > 0) {
            if (autoAction === 'excel') {
                handleExportExcel();
                onClose();
            } else if (autoAction === 'print') {
                handlePrint();
                onClose();
            }
        }
    }, [isOpen, isLoading, autoAction, batches.length]);

    const reportData = useMemo(() => {
        const sortedBatches = [...batches].sort((a, b) => {
            if (!a.expiryDate) return 1;
            if (!b.expiryDate) return -1;
            return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        });

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
            batches: sortedBatches,
            totalBatches: batches.length,
            totalQuantity: batches.reduce((acc: number, b: { quantity?: number | string }) => acc + (Number(b.quantity) || 0), 0),
            generatedAt: new Date().toLocaleString('pt-BR'),
            company,
        };
    }, [batches, companySettings]);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Lotes - ${reportData.company.name}</title>
                <meta charset="utf-8">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Inter', sans-serif;
                        padding: 40px; 
                        background-color: white !important;
                        color: #0f172a !important;
                    }
                    .header { 
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 40px;
                        border-bottom: 2px solid #f1f5f9;
                        padding-bottom: 20px;
                    }
                    .company-info h2 { font-size: 22px; font-weight: 900; margin-bottom: 4px; }
                    .company-info p { font-size: 11px; color: #64748b; margin-bottom: 2px; }
                    .document-info { text-align: right; }
                    .document-info .title { font-size: 28px; font-weight: 900; letter-spacing: -0.02em; }
                    
                    table.print-table { width: 100%; border-collapse: collapse; margin-top: 20px; background: #ffffff !important; }
                    .print-table th, .print-table td { background: #ffffff !important; color: #0f172a !important; }
                    th { 
                        text-align: left; 
                        padding: 12px 10px; 
                        font-size: 10px; 
                        font-weight: 800; 
                        text-transform: uppercase;
                        border-bottom: 2px solid #e2e8f0;
                    }
                    td { 
                        padding: 10px; 
                        font-size: 11px; 
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .col-batch { font-family: monospace; font-weight: 700; color: #4f46e5; }
                    .col-product { font-weight: 800; text-transform: uppercase; }
                    .status-badge {
                        font-size: 9px;
                        font-weight: 800;
                        padding: 2px 6px;
                        border-radius: 4px;
                        text-transform: uppercase;
                    }
                    .footer { margin-top: 50px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; }
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="no-print" style="position: fixed; top: 20px; right: 20px; display: flex; gap: 10px;">
                    <Button variant="ghost" onclick="window.print()" style="padding: 10px 20px; background: #0f172a; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 700;">Imprimir</Button>
                    <Button variant="ghost" onclick="window.close()" style="padding: 10px 20px; background: white; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer;">Fechar</Button>
                </div>
                <div class="header">
                    <div class="company-info">
                        <h2>${reportData.company.name}</h2>
                        <p>${reportData.company.address}</p>
                        <p>NUIT: ${reportData.company.taxId}</p>
                    </div>
                    <div class="document-info">
                        <div class="title">RELATÓRIO DE LOTES</div>
                        <p style="font-size: 10px; color: #64748b; font-weight: 700; margin-top: 5px;">EMITIDO EM: ${reportData.generatedAt}</p>
                    </div>
                </div>
                <table class="print-table">
                    <thead>
                        <tr>
                            <th>Lote</th>
                            <th>Produto</th>
                            <th style="text-align: right;">Qtd</th>
                            <th>Entrada</th>
                            <th>Validade</th>
                            <th>Armazém</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportData.batches.map(b => `
                            <tr>
                                <td class="col-batch">${b.batchNumber}</td>
                                <td class="col-product">${b.product?.name || '---'}</td>
                                <td style="text-align: right; font-weight: 700;">${b.quantity}</td>
                                <td>${b.receivedDate ? new Date(b.receivedDate).toLocaleDateString('pt-BR') : '---'}</td>
                                <td style="font-weight: 700; color: ${new Date(b.expiryDate || '') < new Date() ? '#ef4444' : 'inherit'}">
                                    ${b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('pt-BR') : '---'}
                                </td>
                                <td>${b.warehouse?.name || '---'}</td>
                                <td><span class="status-badge">${STATUS_LABELS[b.status] || b.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase;">Total de Lotes Listados: ${reportData.totalBatches}</span>
                    <span style="font-size: 14px; font-weight: 900; color: #0f172a;">Qtd. Total: ${reportData.totalQuantity} unidades</span>
                </div>
                <div class="footer">Este documento é um relatório oficial de controlo de validade e lotes • Multicore ERP</div>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleExportExcel = () => {
        const headers = ['Lote', 'Produto', 'Quantidade', 'Data Entrada', 'Validade', 'Armazém', 'Estado'];
        const rows = reportData.batches.map(b => [
            b.batchNumber,
            b.product?.name || '',
            b.quantity,
            b.receivedDate ? new Date(b.receivedDate).toLocaleDateString('pt-BR') : '',
            b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('pt-BR') : '',
            b.warehouse?.name || '',
            STATUS_LABELS[b.status] || b.status
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.join(';'))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio_lotes_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Impressão de Lotes & Validades" size="xl" isLight>
            <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documento Profissional</p>
                        <h3 className="text-lg font-black text-slate-900">Relatório de Rastreabilidade</h3>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="ghost" 
                            onClick={onClose} 
                            leftIcon={<HiOutlineXMark className="w-4 h-4" />} 
                            className="text-[10px] font-black uppercase tracking-widest"
                        >
                            Cancelar
                        </Button>
                        
                        <Button 
                            variant="outline" 
                            onClick={handleExportExcel}
                            leftIcon={<HiOutlineTableCells className="w-4 h-4 text-emerald-500" />}
                            className="text-[10px] font-black uppercase tracking-widest text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        >
                            Excel
                        </Button>

                        <Button 
                            variant="outline" 
                            onClick={handlePrint}
                            leftIcon={<HiOutlineDocumentText className="w-4 h-4 text-blue-500" />}
                            className="text-[10px] font-black uppercase tracking-widest text-blue-600 border-blue-200 hover:bg-blue-50"
                        >
                            PDF
                        </Button>

                        <Button 
                            variant="primary" 
                            onClick={handlePrint}
                            leftIcon={<HiOutlinePrinter className="w-4 h-4" />}
                            className="text-[10px] font-black uppercase tracking-widest px-6"
                        >
                            Imprimir Agora
                        </Button>
                    </div>
                </div>

                <div ref={printRef} className="bg-white border border-slate-200 rounded-xl shadow-inner overflow-hidden">
                    <div className="p-10 max-h-[60vh] overflow-y-auto">
                        {isLoading ? (
                            <div className="py-20 flex flex-col items-center justify-center space-y-4">
                                <div className="w-10 h-10 border-4 border-slate-100 border-t-primary-500 rounded-full animate-spin" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">A carregar dados...</p>
                            </div>
                        ) : batches.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 font-bold uppercase text-xs">Nenhum lote encontrado</div>
                        ) : (
                            <div className="space-y-8">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900">{reportData.company.name}</h2>
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mt-1">Controlo de Lotes e Validades</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-400 uppercase">Emissão</p>
                                        <p className="text-xs font-bold text-slate-900">{reportData.generatedAt}</p>
                                    </div>
                                </div>

                                <table className="w-full text-left print-table">
                                    <thead>
                                        <tr className="border-b-2 border-slate-100">
                                            <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lote</th>
                                            <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                                            <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Qtd</th>
                                            <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Validade</th>
                                            <th className="py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {reportData.batches.slice(0, 50).map(b => (
                                            <tr key={b.id}>
                                                <td className="py-3 font-mono text-[11px] font-bold text-primary-600">{b.batchNumber}</td>
                                                <td className="py-3 text-[11px] font-black text-slate-900 uppercase">{b.product?.name}</td>
                                                <td className="py-3 text-[11px] font-black text-slate-900 text-right">{b.quantity}</td>
                                                <td className="py-3 text-[11px] font-bold text-slate-600">{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('pt-BR') : '-'}</td>
                                                <td className="py-3">
                                                    <span className="text-[9px] font-black bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase">{STATUS_LABELS[b.status] || b.status}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {batches.length > 50 && <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">... e mais {batches.length - 50} lotes</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
