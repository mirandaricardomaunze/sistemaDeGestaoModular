import { useRef } from 'react';
import {
    HiOutlinePrinter,
    HiOutlineCheck,
} from 'react-icons/hi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button, Modal } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { Product } from '../../types';
import toast from 'react-hot-toast';

interface OrderItem {
    product: Product;
    quantity: number;
}

interface OrderData {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    deliveryDate: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    items: OrderItem[];
    notes?: string;
    total: number;
}

interface OrderPrintPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    order: OrderData;
    onMarkAsPrinted: () => void;
}

const priorityLabels = {
    low: 'Baixa',
    normal: 'Normal',
    high: 'Alta',
    urgent: 'URGENTE',
};

const priorityColors = {
    low: 'text-gray-600',
    normal: 'text-blue-600',
    high: 'text-orange-600',
    urgent: 'text-red-600 font-bold',
};

export default function OrderPrintPreview({
    isOpen,
    onClose,
    order,
    onMarkAsPrinted,
}: OrderPrintPreviewProps) {
    const { companySettings: company } = useStore();
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;

        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) {
            toast.error('Falha ao abrir janela de impressão');
            return;
        }

        const logoHtml = company.logo
            ? `<div style="text-align:center; margin-bottom:10px;"><img src="${company.logo}" style="max-height: 60px;" /></div>`
            : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Pedido ${order.orderNumber}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            padding: 20px;
                            max-width: 800px;
                            margin: 0 auto;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px solid #000;
                            padding-bottom: 15px;
                            margin-bottom: 20px;
                        }
                        .company-name {
                            font-size: 18px;
                            font-weight: bold;
                            margin-bottom: 5px;
                            text-transform: uppercase;
                        }
                        .header h1 {
                            margin: 10px 0 0 0;
                            font-size: 24px;
                        }
                        .header p {
                            margin: 5px 0;
                            color: #666;
                        }
                        .barcode {
                            text-align: center;
                            font-family: 'Libre Barcode 39', monospace;
                            font-size: 48px;
                            margin: 20px 0;
                        }
                        .barcode-text {
                            text-align: center;
                            font-size: 14px;
                            letter-spacing: 2px;
                        }
                        .info {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 20px;
                        }
                        .info-box {
                            flex: 1;
                            padding: 10px;
                            border: 1px solid #ddd;
                            margin: 0 5px;
                        }
                        .info-box:first-child { margin-left: 0; }
                        .info-box:last-child { margin-right: 0; }
                        .info-box label {
                            font-size: 12px;
                            color: #666;
                            display: block;
                        }
                        .info-box span {
                            font-size: 14px;
                            font-weight: bold;
                        }
                        .priority-urgent {
                            background: #fee;
                            border-color: #f00;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 20px 0;
                        }
                        th, td {
                            border: 1px solid #ddd;
                            padding: 10px;
                            text-align: left;
                        }
                        th {
                            background: #f5f5f5;
                            font-weight: bold;
                        }
                        .location {
                            font-family: monospace;
                            background: #eee;
                            padding: 2px 6px;
                            border-radius: 4px;
                        }
                        .notes {
                            background: #fffde7;
                            padding: 15px;
                            border: 1px solid #ffc107;
                            border-radius: 4px;
                            margin-top: 20px;
                        }
                        .notes h3 {
                            margin: 0 0 10px 0;
                            font-size: 14px;
                        }
                        .footer {
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 1px dashed #ccc;
                            display: flex;
                            justify-content: space-between;
                        }
                        .signature {
                            width: 200px;
                            text-align: center;
                        }
                        .signature-line {
                            border-top: 1px solid #000;
                            margin-top: 40px;
                            padding-top: 5px;
                        }
                        @media print {
                            body { padding: 10px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${logoHtml}
                        <div class="company-name">${company.tradeName || company.companyName}</div>
                        <h1>PEDIDO DE SEPARAÇÃO</h1>
                        <p>Documento Interno</p>
                    </div>
                     ${content.innerHTML.split('<div class="header text-center border-b-2 border-black pb-4 mb-6">')[1] || content.innerHTML}
                </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();

        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);

        toast.success('Pedido enviado para impressão!');
    };

    const handleMarkAsPrinted = () => {
        onMarkAsPrinted();
        toast.success('Pedido marcado como impresso!');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Preview de Impressão" size="xl">
            <div className="space-y-4">
                {/* Print Preview */}
                <div
                    ref={printRef}
                    className="bg-white p-8 rounded-xl border border-gray-200 text-black"
                >
                    {/* Header */}
                    <div className="header text-center border-b-2 border-black pb-4 mb-6">
                        {company.logo && (
                            <img src={company.logo} alt="Logo" className="h-12 mx-auto mb-2" />
                        )}
                        <h2 className="text-xl font-bold uppercase mb-1">{company.tradeName || company.companyName}</h2>
                        <h1 className="text-2xl font-bold">PEDIDO DE SEPARAÇÃO</h1>
                        <p className="text-gray-600">Documento Interno</p>
                    </div>

                    {/* Barcode */}
                    <div className="barcode text-center my-6">
                        <div className="text-5xl font-mono tracking-wider">
                            ||||| {order.orderNumber} |||||
                        </div>
                        <p className="barcode-text text-sm tracking-widest mt-1">
                            {order.orderNumber}
                        </p>
                    </div>

                    {/* Info Boxes */}
                    <div className="info grid grid-cols-3 gap-4 mb-6">
                        <div className="info-box p-3 border border-gray-300 rounded">
                            <label className="text-xs text-gray-500 block">Cliente</label>
                            <span className="font-bold">{order.customerName}</span>
                            <p className="text-sm text-gray-600">{order.customerPhone}</p>
                        </div>
                        <div className="info-box p-3 border border-gray-300 rounded">
                            <label className="text-xs text-gray-500 block">Entrega</label>
                            <span className="font-bold">
                                {format(new Date(order.deliveryDate), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                        </div>
                        <div className={`info-box p-3 border rounded ${order.priority === 'urgent' ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}>
                            <label className="text-xs text-gray-500 block">Prioridade</label>
                            <span className={`font-bold ${priorityColors[order.priority]}`}>
                                {priorityLabels[order.priority]}
                            </span>
                        </div>
                    </div>

                    {/* Items Table */}
                    <table className="w-full border-collapse mb-6">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-300 px-3 py-2 text-left">Código</th>
                                <th className="border border-gray-300 px-3 py-2 text-left">Produto</th>
                                <th className="border border-gray-300 px-3 py-2 text-center">Qtd</th>
                                <th className="border border-gray-300 px-3 py-2 text-left">Localização</th>
                                <th className="border border-gray-300 px-3 py-2 text-center">✓</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.items.map((item, index) => (
                                <tr key={index}>
                                    <td className="border border-gray-300 px-3 py-2 font-mono">
                                        {item.product.code}
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2">
                                        {item.product.name}
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-center font-bold text-lg">
                                        {item.quantity}
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2">
                                        <span className="location bg-gray-100 px-2 py-1 rounded font-mono text-sm">
                                            {item.product.location || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-center">
                                        <div className="w-6 h-6 border-2 border-gray-400 rounded mx-auto" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50">
                                <td colSpan={2} className="border border-gray-300 px-3 py-2 font-bold text-right">
                                    Total de itens:
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center font-bold">
                                    {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 font-bold text-right">
                                    Valor:
                                </td>
                                <td className="border border-gray-300 px-3 py-2 font-bold">
                                    {formatCurrency(order.total)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Notes */}
                    {order.notes && (
                        <div className="notes bg-yellow-50 p-4 border border-yellow-300 rounded">
                            <h3 className="font-bold text-sm mb-2">📝 Observações:</h3>
                            <p className="text-sm">{order.notes}</p>
                        </div>
                    )}

                    {/* Footer with signatures */}
                    <div className="footer mt-8 pt-6 border-t border-dashed border-gray-300 grid grid-cols-2 gap-8">
                        <div className="signature text-center">
                            <div className="signature-line border-t border-black mt-10 pt-2">
                                Separador
                            </div>
                        </div>
                        <div className="signature text-center">
                            <div className="signature-line border-t border-black mt-10 pt-2">
                                Conferente
                            </div>
                        </div>
                    </div>

                    {/* Print timestamp */}
                    <p className="text-xs text-gray-400 text-center mt-6">
                        Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-dark-700">
                    <Button variant="ghost" onClick={onClose}>
                        Fechar
                    </Button>
                    <Button variant="outline" onClick={handleMarkAsPrinted}>
                        <HiOutlineCheck className="w-5 h-5 mr-2" />
                        Marcar como Impresso
                    </Button>
                    <Button onClick={handlePrint}>
                        <HiOutlinePrinter className="w-5 h-5 mr-2" />
                        Imprimir
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
