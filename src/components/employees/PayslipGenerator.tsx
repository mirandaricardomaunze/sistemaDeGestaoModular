
import { jsPDF } from 'jspdf';
import { HiOutlinePrinter, HiOutlineDownload } from 'react-icons/hi';
import { Button } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePayroll } from '../../hooks/useData';
import { addProfessionalHeader, addProfessionalFooter } from '../../utils/documentGenerator';
import type { PayrollRecord, Employee } from '../../types';
import toast from 'react-hot-toast';

interface PayslipGeneratorProps {
    record: PayrollRecord & { employee: Employee };
}

export default function PayslipGenerator({ record }: PayslipGeneratorProps) {
    const { companySettings } = useStore();
    const { user } = useAuthStore();
    const { addAuditLog } = usePayroll();

    /**
     * Generates a professional salary slip PDF.
     * @param action - 'download' saves the file, 'print' opens it in a new tab for printing.
     */
    const generatePDF = async (action: 'download' | 'print') => {
        const doc = new jsPDF();

        addProfessionalHeader(doc, 'Recibo de Vencimento', companySettings, `${record.month}/${record.year}`);

        // Employee Info Section
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        let y = 55;

        // Employee Info
        doc.setFont('helvetica', 'bold');
        doc.text('Dados do Funcionário', 15, y);
        y += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Nome: ${record.employee.name}`, 15, y);
        doc.text(`Cargo: ${record.employee.role}`, 110, y);
        y += 7;
        doc.text(`ID: ${record.employee.code}`, 15, y);
        doc.text(`Dept: ${record.employee.department}`, 110, y);
        y += 7;
        if (record.employee.socialSecurityNumber) doc.text(`INSS: ${record.employee.socialSecurityNumber}`, 15, y);
        if (record.employee.nuit) doc.text(`NUIT: ${record.employee.nuit}`, 110, y);

        y += 15;

        // Table Header
        doc.setFillColor(243, 244, 246);
        doc.rect(15, y - 5, 180, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.text('Descrição', 20, y);
        doc.text('Ganhos', 130, y, { align: 'right' });
        doc.text('Descontos', 180, y, { align: 'right' });
        y += 10;

        // Earnings
        doc.setFont('helvetica', 'normal');

        const addRow = (label: string, earning?: number, deduction?: number) => {
            if (!earning && !deduction) return;
            doc.text(label, 20, y);
            if (earning) doc.text(formatCurrency(earning), 130, y, { align: 'right' });
            if (deduction) doc.text(formatCurrency(deduction), 180, y, { align: 'right' });
            y += 7;
        };

        addRow('Salário Base', record.baseSalary);
        addRow('Subsídios (Alim/Transp)', record.allowances);
        addRow('Bônus', record.bonus);
        addRow('Horas Extras', record.otAmount);

        // Deductions
        addRow('INSS (3%)', undefined, record.inssDeduction);
        addRow('IRPS (Imposto)', undefined, record.irtDeduction);
        addRow('Adiantamentos', undefined, record.advances);

        y += 5;
        // Totals line
        doc.setDrawColor(200, 200, 200);
        doc.line(15, y, 195, y);
        y += 7;

        doc.setFont('helvetica', 'bold');
        doc.text('Totais', 20, y);
        doc.text(formatCurrency(record.totalEarnings), 130, y, { align: 'right' });
        doc.text(formatCurrency(record.totalDeductions), 180, y, { align: 'right' });

        y += 15;

        // Net Pay Box
        doc.setFillColor(240, 253, 244); // Green 50
        doc.setDrawColor(22, 163, 74); // Green 600
        doc.roundedRect(120, y, 75, 25, 3, 3, 'FD');

        doc.setTextColor(22, 163, 74);
        doc.setFontSize(12);
        doc.text('Valor Líquido a Receber', 157.5, y + 8, { align: 'center' });
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(formatCurrency(record.netSalary), 157.5, y + 18, { align: 'center' });

        addProfessionalFooter(doc, companySettings);

        // Audit Log - Record who generated/printed the slip
        if (!record.id.startsWith('draft-')) {
            addAuditLog(
                record.id,
                'printed',
                user?.id || 'system',
                user?.name || 'Sistema',
                `Recibo ${action === 'print' ? 'impresso' : 'descarregado'}`
            );
        }

        if (action === 'download') {
            doc.save(`Recibo_${record.employee.name}_${record.month}_${record.year}.pdf`);
            toast.success('Recibo descarregado!');
        } else {
            // Open in new tab for printing
            const pdfBlob = doc.output('blob');
            const blobUrl = URL.createObjectURL(pdfBlob);
            window.open(blobUrl, '_blank');
            toast.success('PDF aberto para impressão!');
        }
    };

    return (
        <div className="flex items-center gap-0.5">
            <Button size="sm" variant="ghost" onClick={() => generatePDF('download')} title="Descarregar Recibo">
                <HiOutlineDownload className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => generatePDF('print')} title="Imprimir Recibo">
                <HiOutlinePrinter className="w-4 h-4" />
            </Button>
        </div>
    );
}
