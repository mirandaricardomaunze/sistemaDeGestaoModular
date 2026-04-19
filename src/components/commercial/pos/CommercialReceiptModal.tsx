import { useRef } from 'react';
import { formatCurrency } from '../../../utils/helpers';
import { HiOutlineX, HiOutlinePrinter, HiOutlineMail } from 'react-icons/hi';
import type { PaymentEntry, PaymentMethodType } from './CommercialPaymentModal';
import { useCompanySettings } from '../../../stores/useStore';
import { getDrawerEscPosHtml, openCashDrawerSerial } from '../../../utils/hardware';

const METHOD_LABELS: Record<PaymentMethodType, string> = {
    cash: 'Dinheiro',
    mpesa: 'M-Pesa',
    emola: 'E-Mola',
    card: 'Cartão/TPA',
    credit: 'Crédito',
};

export interface ReceiptData {
    saleNumber: string;
    date: Date;
    customerName: string;
    customerPhone?: string;
    items: Array<{
        name: string;
        code: string;
        quantity: number;
        unitPrice: number;
        discountPct: number;
        total: number;
    }>;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    payments: PaymentEntry[];
    change: number;
    isCredit: boolean;
    creditDueDays?: number;
}

interface CommercialReceiptModalProps {
    isOpen: boolean;
    receipt: ReceiptData | null;
    onClose: () => void;
    onSendEmail?: () => void;
}

export function CommercialReceiptModal({ isOpen, receipt, onClose, onSendEmail }: CommercialReceiptModalProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const company = useCompanySettings();

    if (!isOpen || !receipt) return null;

    const displayName = company.tradeName || company.companyName || 'A Minha Empresa';

    const handlePrint = async () => {
        const content = printRef.current?.innerHTML;
        if (!content) return;

        // 1. Tenta abrir gaveta via Web Serial API (mais fiável)
        const openedViaSerial = await openCashDrawerSerial();

        // 2. Prepara janela de impressão
        const win = window.open('', '_blank', 'width=400,height=700');
        if (!win) return;

        // 3. Constrói o HTML da impressão - inclui ESC/POS como fallback
        //    para gavetas conectadas directamente à impressora trmica USB
        const drawerCmd = openedViaSerial ? '' : getDrawerEscPosHtml();

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo ${receipt.saleNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 11px; padding: 12px; max-width: 320px; margin: 0 auto; }
    h1 { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 2px; }
    h2 { font-size: 11px; text-align: center; color: #555; margin-bottom: 2px; }
    p.meta { font-size: 10px; text-align: center; color: #666; margin-bottom: 1px; }
    @media print { @page { margin: 4mm; } }
  </style>
</head>
<body>
  ${drawerCmd}
  ${content}
  <script>window.onload = function() { window.print(); window.close(); }<\/script>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        win.location.href = url;
        // Revoga o URL após a janela carregar
        win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 w-full max-w-sm mx-4 bg-white dark:bg-dark-800 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                            <HiOutlinePrinter className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-xs uppercase tracking-[0.2em]">Recibo Digital</h2>
                            <p className="text-white/40 text-[10px] font-bold">VENDA Nº {receipt.saleNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors">
                        <HiOutlineX className="w-4 h-4" />
                    </button>
                </div>

                {/* Receipt body */}
                <div className="overflow-y-auto flex-1 p-4">
                    <div ref={printRef} className="font-mono text-xs text-gray-800 dark:text-gray-200 space-y-1">

                        {/* ── Cabeçalho Customizado ── */}
                        {company.receiptHeader && (
                            <div className="text-center text-[10px] font-bold mb-2 whitespace-pre-wrap leading-tight">
                                {company.receiptHeader}
                            </div>
                        )}

                        {/* ── Nome da Empresa ── */}
                        <div className="text-center mb-4">
                            <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                                {displayName.toUpperCase()}
                            </h1>
                            {company.tradeName && company.companyName !== company.tradeName && (
                                <h2 className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">{company.companyName}</h2>
                            )}
                            <div className="flex flex-col gap-0.5 mt-3 opacity-70">
                                {company.taxId && (
                                    <p className="meta text-[9px] font-bold">NUIT: {company.taxId}</p>
                                )}
                                {company.address && (
                                    <p className="meta text-[9px]">{company.address}{company.city ? `, ${company.city}` : ''}</p>
                                )}
                                {(company.phone || company.email) && (
                                    <p className="meta text-[9px]">
                                        {[company.phone, company.email].filter(Boolean).join(' • ')}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="border-t border-dashed border-gray-400 my-2" />

                        {/* ── Dados da Venda ── */}
                        <div className="flex justify-between text-[10px]">
                            <span>Recibo:</span>
                            <span className="font-bold">#{receipt.saleNumber}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                            <span>Data:</span>
                            <span>{receipt.date.toLocaleDateString('pt-PT')} {receipt.date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                            <span>Cliente:</span>
                            <span className="font-bold truncate ml-2 text-right max-w-[160px]">{receipt.customerName || 'Consumidor Geral'}</span>
                        </div>
                        {receipt.customerPhone && (
                            <div className="flex justify-between text-[10px]">
                                <span>Tel:</span>
                                <span>{receipt.customerPhone}</span>
                            </div>
                        )}

                        <div className="border-t border-dashed border-gray-400 my-2" />

                        {/* ── Itens ── */}
                        {receipt.items.map((item, i) => (
                            <div key={i} className="mb-1.5">
                                <div className="font-bold text-[10px] truncate">{item.name}</div>
                                <div className="flex justify-between text-[10px] text-gray-500">
                                    <span>
                                        {item.quantity}x {Number(item.unitPrice).toLocaleString()} MTn
                                        {item.discountPct > 0 ? ` (-${item.discountPct}%)` : ''}
                                    </span>
                                    <span className="font-bold text-gray-800 dark:text-gray-200">
                                        {formatCurrency(item.total)}
                                    </span>
                                </div>
                            </div>
                        ))}

                        <div className="border-t border-dashed border-gray-400 my-2" />

                        {/* ── Totais ── */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                                <span>Subtotal</span>
                                <span>{formatCurrency(receipt.subtotal)}</span>
                            </div>
                            {receipt.discount > 0 && (
                                <div className="flex justify-between text-[10px] text-red-600">
                                    <span>Desconto</span>
                                    <span>âˆ' {formatCurrency(receipt.discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-[10px] text-gray-500">
                                <span>IVA ({company.ivaRate ?? 16}%)</span>
                                <span>+ {formatCurrency(receipt.tax)}</span>
                            </div>
                            <div className="flex justify-between font-black text-sm mt-1 pt-1 border-t border-dashed border-gray-400">
                                <span>TOTAL</span>
                                <span>{formatCurrency(receipt.total)}</span>
                            </div>
                        </div>

                        <div className="border-t border-dashed border-gray-400 my-2" />

                        {/* ── Pagamentos ── */}
                        <div className="space-y-0.5">
                            {receipt.payments.map((p, i) => (
                                <div key={i} className="flex justify-between text-[10px]">
                                    <span>
                                        {METHOD_LABELS[p.method]}
                                        {p.reference ? ` (${p.reference})` : ''}
                                    </span>
                                    <span className="font-bold">{formatCurrency(p.amount)}</span>
                                </div>
                            ))}
                            {receipt.change > 0.01 && (
                                <div className="flex justify-between text-[10px] font-black text-green-700">
                                    <span>Troco</span>
                                    <span>{formatCurrency(receipt.change)}</span>
                                </div>
                            )}
                            {receipt.isCredit && (
                                <div className="flex justify-between text-[10px] font-black text-amber-700">
                                    <span>A Crédito - vence em {receipt.creditDueDays} dias</span>
                                    <span>{formatCurrency(receipt.total)}</span>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-dashed border-gray-400 my-3" />

                        {/* ── Rodap ── */}
                        <div className="text-center pt-4 opacity-50">
                            <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 mx-auto rounded-full mb-4" />
                            <div className="text-[9px] uppercase tracking-widest font-bold space-y-1">
                                {company.receiptFooter ? (
                                    <div className="whitespace-pre-wrap leading-relaxed">
                                        {company.receiptFooter}
                                    </div>
                                ) : (
                                    <>
                                        <p>Obrigado pela preferência</p>
                                        <p>Volte Sempre</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-4 py-3 border-t dark:border-dark-700 flex gap-2 flex-shrink-0">
                    {onSendEmail && (
                        <button
                            onClick={onSendEmail}
                            className="flex-1 py-2.5 rounded-lg border-2 border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-400 font-black text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <HiOutlineMail className="w-4 h-4" />
                            Email
                        </button>
                    )}
                    <button
                        onClick={handlePrint}
                        className="flex-1 py-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors shadow-lg"
                    >
                        <HiOutlinePrinter className="w-4 h-4" />
                        Imprimir
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest transition-colors shadow-lg shadow-blue-500/20"
                    >
                        Nova Venda
                    </button>
                </div>
            </div>
        </div>
    );
}
