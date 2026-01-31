import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Response } from 'express';
import { prisma } from '../lib/prisma';

export interface ExportOptions {
    title: string;
    subtitle?: string;
    columns: { header: string; key: string; width?: number }[];
    data: any[];
    companyId: string;
    module?: string;
}

export class DocumentService {
    /**
     * Generates a professional PDF with letterhead
     */
    static async generatePDF(res: Response, options: ExportOptions) {
        const company = await prisma.companySettings.findUnique({
            where: { companyId: options.companyId }
        });

        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        // Stream to response
        doc.pipe(res);

        // --- Header ---
        if (company?.logo) {
            // In a real app, we'd handle logo buffering, for now placeholder
            doc.fontSize(20).text(company.companyName, { align: 'left' });
        } else {
            doc.fontSize(20).fillColor('#1a365d').text(company?.companyName || 'Empresa', { align: 'left' });
        }

        doc.fontSize(10).fillColor('#4a5568').text(company?.address || '', { align: 'left' });
        doc.text(`NUIT: ${company?.nuit || 'N/A'}`);
        doc.text(`Tel: ${company?.phone || ''} | Email: ${company?.email || ''}`);

        doc.moveDown();
        doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // --- Title ---
        doc.fontSize(16).fillColor('#2d3748').text(options.title.toUpperCase(), { align: 'center' });
        if (options.subtitle) {
            doc.fontSize(10).fillColor('#718096').text(options.subtitle, { align: 'center' });
        }
        doc.moveDown();

        // --- Table ---
        const tableTop = doc.y;
        doc.fontSize(10).fillColor('#2d3748');

        // Draw Header
        let currentX = 50;
        options.columns.forEach(col => {
            doc.text(col.header, currentX, tableTop, { width: col.width || 100, bold: true } as any);
            currentX += col.width || 100;
        });

        doc.moveDown();
        doc.strokeColor('#cbd5e0').lineWidth(0.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        // Draw Rows
        options.data.forEach(row => {
            currentX = 50;
            const rowY = doc.y;
            let maxHeight = 0;

            options.columns.forEach(col => {
                const val = row[col.key]?.toString() || '';
                doc.text(val, currentX, rowY, { width: col.width || 100 } as any);
                currentX += col.width || 100;
            });
            doc.moveDown();

            if (doc.y > 700) doc.addPage();
        });

        // --- Footer ---
        const pageCount = (doc as any)._pageBuffer.length;
        // PDFKit footer is complex, simplified for now
        doc.fontSize(8).fillColor('#a0aec0').text(
            `Gerado em ${new Date().toLocaleString()} | Multicore`,
            50, 780, { align: 'center', width: 500 }
        );

        doc.end();
    }

    /**
     * Generates a professional Excel file
     */
    static async generateExcel(res: Response, options: ExportOptions, filename: string) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(options.title);

        // Styling
        sheet.columns = options.columns.map(col => ({
            header: col.header,
            key: col.key,
            width: (col.width || 100) / 5
        }));

        // Add Header Style
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2E8F0' }
        };

        // Add Data
        sheet.addRows(options.data);

        // Stream to response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    }
}
