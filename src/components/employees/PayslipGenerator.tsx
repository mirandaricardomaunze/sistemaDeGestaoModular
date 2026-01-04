
import { jsPDF } from 'jspdf';
import { HiOutlinePrinter } from 'react-icons/hi';
import { Button } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import { useStore } from '../../stores/useStore';
import type { PayrollRecord, Employee } from '../../types';
import toast from 'react-hot-toast';

interface PayslipGeneratorProps {
    record: PayrollRecord & { employee: Employee };
}

export default function PayslipGenerator({ record }: PayslipGeneratorProps) {
    const { companySettings } = useStore();

    const generatePDF = () => {
        const doc = new jsPDF();

        // Header Background
        doc.setFillColor(28, 100, 242);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);

        // Add Logo if available
        if (companySettings?.logo) {
            try {
                // Determine file extension or assume PNG/JPEG. jsPDF auto-detects from base64 usually.
                // We'll trust the browser to handle the image format or jsPDF's tolerance.
                const logoHeight = 25;
                const logoWidth = 25;
                const x = 15;
                const y = 7.5;
                doc.addImage(companySettings.logo, 'PNG', x, y, logoWidth, logoHeight);

                // Adjust text position if logo is present
                doc.setFontSize(24);
                doc.text('Recibo de Vencimento', 50, 25);
            } catch (e) {
                // Fallback if logo fails
                doc.setFontSize(24);
                doc.text('Recibo de Vencimento', 15, 25);
            }
        } else {
            doc.setFontSize(24);
            doc.text('Recibo de Vencimento', 15, 25);
        }

        doc.setFontSize(10);
        doc.text(`Período: ${record.month}/${record.year}`, 200, 25, { align: 'right' });
        doc.text(companySettings?.companyName || 'Empresa', 200, 32, { align: 'right' });

        // Info Section
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

        // Footer
        y += 40;
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Documento processado por computador.', 105, 280, { align: 'center' });
        doc.text(companySettings?.companyName || 'Empresa', 105, 284, { align: 'center' });

        doc.save(`Payslip_${record.employee.name}_${record.month}_${record.year}.pdf`);
        toast.success('Recibo baixado!');
    };

    return (
        <Button size="sm" variant="ghost" onClick={generatePDF} title="Baixar Recibo">
            <HiOutlinePrinter className="w-4 h-4" />
        </Button>
    );
}
