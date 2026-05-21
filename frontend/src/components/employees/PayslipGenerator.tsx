
import { HiOutlinePrinter } from 'react-icons/hi2';
import { Button } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePayroll } from '../../hooks/useData';
import type { PayrollRecord, Employee } from '../../types';
import toast from 'react-hot-toast';

interface PayslipGeneratorProps {
    record: PayrollRecord & { employee: Employee };
    variant?: 'ghost' | 'outline' | 'primary';
    showLabel?: boolean;
}

export default function PayslipGenerator({ record, variant = 'ghost', showLabel = false }: PayslipGeneratorProps) {
    const { companySettings } = useStore();
    const { user } = useAuthStore();
    const { addAuditLog } = usePayroll();

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const companyName = companySettings?.companyName || 'Multicore Enterprise';
        const address = companySettings?.address || 'Moçambique';
        const phone = companySettings?.phone || 'N/A';
        const email = companySettings?.email || 'N/A';
        const taxId = companySettings?.taxId || 'N/A';
        const logo = companySettings?.logo || '';

        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Recibo de Vencimento - ${record.employee.name}</title>
                <meta charset="utf-8">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                    
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Inter', system-ui, sans-serif; 
                        color: #0f172a; 
                        background: white;
                        line-height: 1.5;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .page {
                        width: 210mm;
                        padding: 15mm;
                        margin: 0 auto;
                        position: relative;
                    }
                    
                    /* Header Section */
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 40px;
                        border-bottom: 2px solid #f1f5f9;
                        padding-bottom: 25px;
                    }
                    .company-info h1 {
                        font-size: 22px;
                        font-weight: 900;
                        letter-spacing: -1px;
                        text-transform: uppercase;
                        margin-bottom: 6px;
                    }
                    .company-info p {
                        font-size: 10px;
                        color: #64748b;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 2px;
                    }
                    .document-title {
                        text-align: right;
                    }
                    .document-title h2 {
                        font-size: 24px;
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: -1px;
                        color: #6366f1;
                        margin-bottom: 4px;
                    }
                    .document-title span {
                        font-size: 11px;
                        font-weight: 800;
                        color: #94a3b8;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                    }

                    /* Employee Data Box */
                    .details-grid {
                        display: grid;
                        grid-template-columns: 1.5fr 1fr;
                        gap: 40px;
                        margin-bottom: 40px;
                    }
                    .section-title {
                        font-size: 10px;
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: 1.5px;
                        color: #94a3b8;
                        margin-bottom: 12px;
                    }
                    .info-row {
                        display: flex;
                        margin-bottom: 8px;
                        font-size: 12px;
                    }
                    .info-label {
                        font-weight: 700;
                        color: #64748b;
                        width: 100px;
                    }
                    .info-value {
                        font-weight: 600;
                        color: #1e293b;
                    }

                    /* Payslip Table */
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 30px;
                    }
                    th {
                        background: #f8fafc;
                        font-size: 10px;
                        font-weight: 900;
                        text-transform: uppercase;
                        letter-spacing: 1.5px;
                        color: #64748b;
                        text-align: left;
                        padding: 14px 20px;
                    }
                    td {
                        padding: 12px 20px;
                        font-size: 12px;
                        font-weight: 600;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .text-right { text-align: right; }
                    .earning { color: #059669; }
                    .deduction { color: #dc2626; }

                    /* Totals Footer */
                    .totals-section {
                        display: flex;
                        justify-content: flex-end;
                        margin-bottom: 50px;
                    }
                    .totals-box {
                        width: 300px;
                        background: #f8fafc;
                        border-radius: 16px;
                        padding: 20px;
                    }
                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 10px;
                        font-size: 12px;
                    }
                    .total-label { font-weight: 700; color: #64748b; }
                    .total-value { font-weight: 800; color: #1e293b; }
                    .net-pay {
                        margin-top: 15px;
                        padding-top: 15px;
                        border-top: 2px dashed #e2e8f0;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .net-label { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #6366f1; }
                    .net-amount { font-size: 22px; font-weight: 900; color: #1e293b; letter-spacing: -1px; }

                    /* Signatures */
                    .signatures {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 80px;
                        padding-top: 20px;
                    }
                    .sig-box {
                        width: 250px;
                        text-align: center;
                        border-top: 1px solid #cbd5e1;
                        padding-top: 10px;
                        font-size: 11px;
                        font-weight: 700;
                        color: #64748b;
                        text-transform: uppercase;
                    }

                    /* Watermark */
                    .watermark {
                        position: absolute;
                        bottom: 40px;
                        right: 40px;
                        font-size: 10px;
                        font-weight: 900;
                        color: #e2e8f0;
                        text-transform: uppercase;
                        letter-spacing: 3px;
                        transform: rotate(-90deg);
                        transform-origin: bottom right;
                    }

                    @media print {
                        body { background: white; }
                        .page { padding: 10mm; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="header">
                        <div class="company-info">
                            ${logo ? `<img src="${logo}" style="height: 50px; margin-bottom: 15px; display: block;">` : ''}
                            <h1>${companyName}</h1>
                            <p>${address}</p>
                            <p>NUIT: ${taxId}</p>
                            <p>TEL: ${phone} | ${email}</p>
                        </div>
                        <div class="document-title">
                            <h2>RECIBO</h2>
                            <span>${record.month}/${record.year}</span>
                        </div>
                    </div>

                    <div class="details-grid">
                        <div>
                            <div class="section-title">Dados do Colaborador</div>
                            <div class="info-row">
                                <span class="info-label">Nome:</span>
                                <span class="info-value">${record.employee.name}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Função:</span>
                                <span class="info-value">${record.employee.role}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Código:</span>
                                <span class="info-value">${record.employee.code}</span>
                            </div>
                        </div>
                        <div>
                            <div class="section-title">Informação Fiscal</div>
                            <div class="info-row">
                                <span class="info-label">NUIT:</span>
                                <span class="info-value">${record.employee.nuit || ''}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">INSS:</span>
                                <span class="info-value">${record.employee.socialSecurityNumber || ''}</span>
                            </div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Descrição das Verbas</th>
                                <th class="text-right">Vencimento</th>
                                <th class="text-right">Descontos</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Salário Base</td>
                                <td class="text-right">${formatCurrency(record.baseSalary)}</td>
                                <td class="text-right">-</td>
                            </tr>
                            ${record.allowances > 0 ? `
                                <tr>
                                    <td>Subsídios (Alimentação/Transp)</td>
                                    <td class="text-right">${formatCurrency(record.allowances)}</td>
                                    <td class="text-right">-</td>
                                </tr>
                            ` : ''}
                            ${record.bonus > 0 ? `
                                <tr>
                                    <td>Bónus / Comissões</td>
                                    <td class="text-right">${formatCurrency(record.bonus)}</td>
                                    <td class="text-right">-</td>
                                </tr>
                            ` : ''}
                            ${record.otAmount > 0 ? `
                                <tr>
                                    <td>Horas Extraordinárias</td>
                                    <td class="text-right">${formatCurrency(record.otAmount)}</td>
                                    <td class="text-right">-</td>
                                </tr>
                            ` : ''}
                            
                            <!-- Deductions -->
                            ${record.inssDeduction > 0 ? `
                                <tr>
                                    <td>Retenção INSS (3%)</td>
                                    <td class="text-right">-</td>
                                    <td class="text-right deduction">${formatCurrency(record.inssDeduction)}</td>
                                </tr>
                            ` : ''}
                            ${record.irtDeduction > 0 ? `
                                <tr>
                                    <td>Retenção IRPS</td>
                                    <td class="text-right">-</td>
                                    <td class="text-right deduction">${formatCurrency(record.irtDeduction)}</td>
                                </tr>
                            ` : ''}
                            ${record.advances > 0 ? `
                                <tr>
                                    <td>Adiantamentos / Outros</td>
                                    <td class="text-right">-</td>
                                    <td class="text-right deduction">${formatCurrency(record.advances)}</td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>

                    <div class="totals-section">
                        <div class="totals-box">
                            <div class="total-row">
                                <span class="total-label">Ganhos Brutos</span>
                                <span class="total-value">${formatCurrency(record.totalEarnings)}</span>
                            </div>
                            <div class="total-row">
                                <span class="total-label">Total Descontos</span>
                                <span class="total-value deduction">${formatCurrency(record.totalDeductions)}</span>
                            </div>
                            <div class="net-pay">
                                <span class="net-label">Líquido a Receber</span>
                                <span class="net-amount">${formatCurrency(record.netSalary)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="signatures">
                        <div class="sig-box">O Colaborador</div>
                        <div class="sig-box">A Administração</div>
                    </div>

                    <div class="watermark">MULTICORE ERP • DOCUMENTO DE USO INTERNO • ${new Date().getFullYear()}</div>
                </div>

                <script>
                    window.onload = () => {
                        window.print();
                        // Close window after print dialog is closed
                        // window.onfocus = () => window.close();
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(content);
        printWindow.document.close();

        // Audit Log
        if (!record.id.startsWith('draft-')) {
            addAuditLog(
                record.id,
                'printed',
                user?.id || 'system',
                user?.name || 'Sistema',
                `Recibo impresso (Padrão Enterprise)`
            );
        }

        toast.success('Gerando documento profissional...');
    };

    return (
        <div className="flex items-center gap-1">
            <Button 
                size="sm" 
                variant={variant} 
                onClick={handlePrint} 
                title="Imprimir Recibo Profissional"
                className="group"
            >
                <HiOutlinePrinter className="w-4 h-4" />
                {showLabel && <span className="ml-2">Imprimir Recibo</span>}
            </Button>
        </div>
    );
}
