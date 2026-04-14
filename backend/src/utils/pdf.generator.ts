import PDFDocument from 'pdfkit';
import { Response } from 'express';

export const generateDeliveryPDF = (res: Response, delivery: any, companyInfo: any) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Guia-Transporte-${delivery.trackingNumber}.pdf"`);

    // Pipe the PDF directly to the response
    doc.pipe(res);

    // Document styling
    const pageWidth = doc.page.width;
    const rightColX = pageWidth - 200;

    // ----- HEADER -----
    doc.fontSize(24).font('Helvetica-Bold').text('GUIA DE TRANSPORTE', 50, 50);

    doc.fontSize(10).font('Helvetica');
    doc.text(companyInfo.name || 'Empresa Emissora', 50, 85);
    if (companyInfo.address) doc.text(companyInfo.address, 50, 100);
    if (companyInfo.nuit) doc.text(`NUIT: ${companyInfo.nuit}`, 50, 115);
    if (companyInfo.phone) doc.text(`Tel: ${companyInfo.phone}`, 50, 130);

    // Delivery Meta
    doc.fontSize(10).font('Helvetica-Bold').text(`Documento Nº:`, rightColX, 85);
    doc.font('Helvetica').text(delivery.trackingNumber, rightColX + 80, 85);

    doc.font('Helvetica-Bold').text(`Data de Emissão:`, rightColX, 100);
    doc.font('Helvetica').text(new Date(delivery.createdAt).toLocaleDateString(), rightColX + 80, 100);

    doc.font('Helvetica-Bold').text(`Estado Atual:`, rightColX, 115);
    doc.font('Helvetica').text(delivery.status.toUpperCase(), rightColX + 80, 115);

    // ----- CUSTOMER INFO & ROUTE -----
    doc.moveDown(3);
    const boxY = doc.y;
    
    // Origin Box
    doc.rect(50, boxY, 230, 80).stroke('#cccccc');
    doc.font('Helvetica-Bold').text('DADOS DA CARGA (ORIGEM)', 60, boxY + 10);
    doc.font('Helvetica').text(`Condutor: ${delivery.driverName || 'N/A'}`, 60, boxY + 30);
    doc.text(`Veículo: ${delivery.vehiclePlate || 'N/A'}`, 60, boxY + 45);

    // Destination Box
    doc.rect(300, boxY, 245, 80).stroke('#cccccc');
    doc.font('Helvetica-Bold').text('MORADA DE DESCARGA (DESTINO)', 310, boxY + 10);
    doc.font('Helvetica').text(`Destinatário: ${delivery.customerName || 'N/A'}`, 310, boxY + 30);
    doc.text(`Endereço: ${delivery.destination}`, 310, boxY + 45);

    // ----- OBSERVATIONS -----
    doc.moveDown(5);
    doc.font('Helvetica-Bold').fontSize(12).text('Detalhes e Observações da Entrega', 50, doc.y);
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10).text(delivery.notes || 'Sem observações adicionais.', 50, doc.y, { width: pageWidth - 100 });

    // ----- SIGNATURES -----
    const sigY = doc.page.height - 150;
    
    doc.moveTo(50, sigY).lineTo(200, sigY).stroke();
    doc.font('Helvetica-Bold').fontSize(10).text('A Entidade Emissora', 50, sigY + 10, { width: 150, align: 'center' });

    doc.moveTo(250, sigY).lineTo(400, sigY).stroke();
    doc.text('O Condutor / Transportador', 250, sigY + 10, { width: 150, align: 'center' });

    doc.moveTo(450, sigY).lineTo(pageWidth - 50, sigY).stroke();
    doc.text('O Cliente / Recebedor', 450, sigY + 10, { width: pageWidth - 500, align: 'center' });

    // Footer
    doc.font('Helvetica').fontSize(8).text(
        'Documento gerado automaticamente pelo sistema MultiCore ERP',
        50,
        doc.page.height - 50,
        { align: 'center', width: pageWidth - 100 }
    );

    // Finalize PDF file
    doc.end();
};
