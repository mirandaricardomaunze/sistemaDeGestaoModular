import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


// Professional Header Helper
// Professional Header Helper
export const addProfessionalHeader = (doc: jsPDF, title: string, companyInfo: any, period?: string) => {
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;

    // Logo Support
    if (companyInfo?.logo) {
        try {
            doc.addImage(companyInfo.logo, 'PNG', 15, 12, 25, 25);
            // If logo exists, move company text to the right of logo
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text(companyInfo?.companyName || 'Multicore', 45, y);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(companyInfo?.address || 'Endereço não configurado', 45, y + 6);
            doc.text(`NUIT: ${companyInfo?.taxId || 'N/A'}`, 45, y + 11);
            doc.text(`Tel: ${companyInfo?.phone || 'N/A'} | Email: ${companyInfo?.email || 'N/A'}`, 45, y + 16);
        } catch (e) {
            console.warn('Failed to add logo to PDF', e);
            // Fallback to no logo layout below
        }
    } else {
        // Company Information (Left Aligned - No Logo)
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.text(companyInfo?.companyName || 'Multicore', 15, y);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text(companyInfo?.address || 'Endereço não configurado', 15, y + 6);
        doc.text(`NUIT: ${companyInfo?.taxId || 'N/A'}`, 15, y + 11);
        doc.text(`Tel: ${companyInfo?.phone || 'N/A'} | Email: ${companyInfo?.email || 'N/A'}`, 15, y + 16);
    }

    // Document Titles (Right Aligned)
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title.toUpperCase(), pageWidth - 15, 20, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    if (period) {
        doc.text(`Período: ${period}`, pageWidth - 15, 28, { align: 'right' });
    }
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-MZ')}`, pageWidth - 15, 34, { align: 'right' });

    // Divider Line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(15, 42, pageWidth - 15, 42);
};

// Professional Footer Helper - Enhanced with Multicore branding
export const addProfessionalFooter = (doc: jsPDF, companyInfo: any) => {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const pageCount = (doc as any).internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // Footer separator line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(15, pageHeight - 28, pageWidth - 15, pageHeight - 28);

        // Company info line (left aligned)
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        const companyName = companyInfo?.companyName || 'Multicore';
        const companyPhone = companyInfo?.phone ? ` | Tel: ${companyInfo.phone}` : '';
        const companyEmail = companyInfo?.email ? ` | ${companyInfo.email}` : '';
        doc.text(`${companyName}${companyPhone}${companyEmail}`, 15, pageHeight - 23);

        // Multicore branding watermark (center)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(59, 130, 246); // Primary blue
        doc.text('Processado por Multicore', pageWidth / 2, pageHeight - 15, { align: 'center' });

        // Timestamp and legal text (center)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(150, 150, 150);
        doc.text(`Documento gerado automaticamente em ${new Date().toLocaleString('pt-MZ')}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

        // Page number (right aligned)
        doc.setFontSize(7);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 15, pageHeight - 15, { align: 'right' });

        // Year (right aligned)
        doc.text(`© ${new Date().getFullYear()}`, pageWidth - 15, pageHeight - 10, { align: 'right' });
    }
};

export const generateGuiaRemessa = (transfer: any, companyInfo?: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    addProfessionalHeader(doc, 'GUIA DE REMESSA', companyInfo);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Guia Nº: ${transfer.number}`, 15, 52);
    doc.text(`Data da Operação: ${new Date(transfer.createdAt).toLocaleDateString()}`, 15, 57);
    doc.text(`Emitido por: ${transfer.responsible || 'Multicore'}`, 15, 62);

    // Warehouses Info Box
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(15, 72, 85, 25, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.text('ORIGEM', 20, 78);
    doc.setFont('helvetica', 'normal');
    doc.text(transfer.sourceWarehouse?.name || '---', 20, 84);
    doc.setFontSize(8);
    doc.text(transfer.sourceWarehouse?.location || 'Mocambique', 20, 90);

    doc.setFontSize(10);
    doc.roundedRect(110, 72, 85, 25, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.text('DESTINO', 115, 78);
    doc.setFont('helvetica', 'normal');
    doc.text(transfer.targetWarehouse?.name || '---', 115, 84);
    doc.setFontSize(8);
    doc.text(transfer.targetWarehouse?.location || 'Mocambique', 115, 90);

    // Items Table
    const tableData = transfer.items.map((item: any) => [
        item.product?.code || '---',
        item.product?.name || '---',
        item.quantity,
        item.product?.unit || 'Un'
    ]);

    autoTable(doc, {
        startY: 105,
        head: [['Código', 'Descrição do Produto', 'Qtd.', 'Unidade']],
        body: tableData,
        headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: 15, right: 15 }
    });

    // Footer / Signatures
    const finalY = (doc as any).lastAutoTable.finalY + 30;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, finalY, 80, finalY);
    doc.setFontSize(8);
    doc.text('CARIMBO E ASSINATURA (EMISSOR)', 15, finalY + 5);

    doc.line(pageWidth - 80, finalY, pageWidth - 15, finalY);
    doc.text('CONFIRMAÇÃO DE RECEPÇÃO (DESTINO)', pageWidth - 80, finalY + 5);

    addProfessionalFooter(doc, companyInfo);
    doc.save(`Guia_${transfer.number}.pdf`);
};

export const generateBookingReceipt = (booking: any, companyInfo: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    addProfessionalHeader(doc, 'RECIBO DE ESTADIA', companyInfo);

    // Guest Info Section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO HÓSPEDE', 15, 50);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${booking.customerName}`, 15, 57);
    doc.text(`Acompanhantes: ${booking.guestCount}`, 15, 62);
    doc.text(`Quarto: ${booking.room?.number || '--'} (${booking.room?.type || '--'})`, 15, 67);

    // Booking Table
    autoTable(doc, {
        startY: 75,
        head: [['Descrição do Serviço', 'Check-in', 'Check-out', 'Valor Total']],
        body: [[
            `Alojamento - Quarto ${booking.room?.number}`,
            new Date(booking.checkIn).toLocaleDateString(),
            booking.checkOut ? new Date(booking.checkOut).toLocaleDateString() : '---',
            `${booking.totalPrice.toLocaleString()} MT`
        ]],
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 10 },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL PAGO: ${booking.totalPrice.toLocaleString()} MT`, pageWidth - 15, finalY, { align: 'right' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Obrigado pela sua preferência!', pageWidth / 2, finalY + 20, { align: 'center' });
    doc.text('Documento processado por computador', pageWidth / 2, finalY + 25, { align: 'center' });

    addProfessionalFooter(doc, companyInfo);
    doc.save(`Recibo_Booking_${booking.id?.slice(-8)}.pdf`);
};

export const generatePharmacyExpirationReport = (products: any[], companyInfo?: any) => {
    const doc = new jsPDF();

    addProfessionalHeader(doc, 'RELATÓRIO DE VALIDADES', companyInfo);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString()}`, 15, 52);
    doc.text(`Total de Produtos em Risco: ${products.length}`, 15, 57);

    // Items Table
    const tableData = products.map((item: any) => [
        item.code || '---',
        item.name || '---',
        item.batchNumber || '---',
        new Date(item.expiryDate).toLocaleDateString(),
        `${item.currentStock} ${item.unit || 'un'}`
    ]);

    autoTable(doc, {
        startY: 70,
        head: [['Código', 'Produto', 'Lote', 'Expiração', 'Stock Atual']],
        body: tableData,
        headStyles: { fillColor: [220, 38, 38] as [number, number, number], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        margin: { left: 15, right: 15 }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Este documento é um alerta gerado automaticamente pelo sistema de inventário.', 15, finalY);

    addProfessionalFooter(doc, companyInfo);
    doc.save(`Relatorio_Validades_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateHospitalityReport = (data: any, companyInfo: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    addProfessionalHeader(doc, 'RELATÓRIO DE HOTELARIA', companyInfo, data.period);

    // Summary Box
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO FINANCEIRO', 15, 55);

    const summaryData = [
        ['Descrição', 'Valor'],
        ['Receita Total', `${data.summary.totalRevenue.toLocaleString()} MT`],
        ['Receita Alojamento', `${data.summary.totalRoomRevenue.toLocaleString()} MT`],
        ['Receita Consumos', `${data.summary.totalConsumptionRevenue.toLocaleString()} MT`],
        ['Total de Reservas', data.summary.totalBookings.toString()],
        ['Taxa de Ocupação', `${data.summary.occupancyRate}%`]
    ];

    autoTable(doc, {
        startY: 60,
        head: [summaryData[0]],
        body: summaryData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { right: pageWidth / 2 + 5 }
    });

    // Room Stats side box
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('OCUPAÇÃO ATUAL', pageWidth / 2 + 10, 55);

    const roomStatsData = [
        ['Status', 'Qtd.'],
        ['Livres', data.roomStats.available.toString()],
        ['Ocupados', data.roomStats.occupied.toString()],
        ['Limpeza', data.roomStats.dirty.toString()],
        ['Manutenção', data.roomStats.maintenance.toString()]
    ];

    autoTable(doc, {
        startY: 60,
        head: [roomStatsData[0]],
        body: roomStatsData.slice(1),
        theme: 'plain',
        headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85] },
        styles: { fontSize: 9 },
        margin: { left: pageWidth / 2 + 10 }
    });

    // Bookings Table
    const tableData = data.bookings.map((b: any) => [
        new Date(b.checkIn).toLocaleDateString(),
        `Q-${b.roomNumber}`,
        b.customerName,
        `${b.totalRevenue.toLocaleString()} MT`,
        b.status.replace('_', ' ').toUpperCase()
    ]);

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [['Data', 'Quarto', 'Hóspede', 'Total', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 8 },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
    });

    addProfessionalFooter(doc, companyInfo);
    doc.save(`Relatorio_Hotelaria_${data.period.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// =============================================================================
// PHARMACY PDF REPORTS
// =============================================================================

export const generatePharmacyStockReport = (data: { items: any[]; summary: any }, companyInfo?: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    addProfessionalHeader(doc, 'RELATÓRIO DE STOCK', companyInfo);

    // Date & Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-MZ')}`, 15, 55);
    doc.text(`Hora: ${new Date().toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })}`, 15, 60);

    // Summary Box
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 68, pageWidth - 30, 35, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('RESUMO DO INVENTÁRIO', 20, 77);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const col1 = 20, col2 = 75, col3 = 130;
    doc.text(`Total Produtos: ${data.summary.totalProducts}`, col1, 86);
    doc.text(`Total Unidades: ${data.summary.totalStock.toLocaleString()}`, col2, 86);
    doc.text(`Baixo Stock: ${data.summary.lowStockCount}`, col3, 86);

    doc.setFont('helvetica', 'bold');
    doc.text(`Valor Total: ${Number(data.summary.totalValue).toLocaleString()} MT`, col1, 96);
    doc.text(`Custo Total: ${Number(data.summary.totalCost).toLocaleString()} MT`, col2, 96);
    doc.setTextColor(16, 185, 129);
    doc.text(`Lucro Potencial: ${(Number(data.summary.totalValue) - Number(data.summary.totalCost)).toLocaleString()} MT`, col3, 96);

    // Table
    doc.setTextColor(0, 0, 0);
    const tableData = data.items.slice(0, 40).map((item: any) => [
        item.productCode,
        item.productName.substring(0, 30),
        item.dci || '-',
        item.totalStock.toString(),
        item.isLowStock ? 'âš ï¸' : '✓',
        `${Number(item.totalValue).toLocaleString()} MT`
    ]);

    autoTable(doc, {
        startY: 110,
        head: [['Código', 'Medicamento', 'DCI', 'Stock', 'Status', 'Valor']],
        body: tableData,
        headStyles: { fillColor: [16, 185, 129] as [number, number, number], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 55 },
            2: { cellWidth: 35 },
            3: { halign: 'center', cellWidth: 18 },
            4: { halign: 'center', cellWidth: 15 },
            5: { halign: 'right', cellWidth: 30 }
        },
        margin: { left: 15, right: 15 }
    });

    // Footer
    const footerY = pageHeight - 20;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gerado automaticamente pelo Multicore • ${new Date().toLocaleString('pt-MZ')}`, pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Página 1 de 1`, pageWidth - 15, footerY, { align: 'right' });

    addProfessionalFooter(doc, companyInfo);
    doc.save(`Farmacia_Stock_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generatePharmacySalesReport = (sales: any[], period: string, companyInfo?: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    addProfessionalHeader(doc, 'RELATÓRIO DE VENDAS', companyInfo, period);

    // Calculate totals
    const totalSales = sales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalItems = sales.reduce((sum, s) => sum + (s.items?.length || 0), 0);

    // Summary Box
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 50, pageWidth - 30, 28, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('RESUMO DO PERÍODO', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Total Vendas: ${sales.length}`, 20, 70);
    doc.text(`Total Itens: ${totalItems}`, 80, 70);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text(`Receita Total: ${totalSales.toLocaleString()} MT`, pageWidth - 20, 70, { align: 'right' });

    // Table
    doc.setTextColor(0, 0, 0);
    const tableData = sales.slice(0, 35).map((sale: any) => [
        sale.saleNumber,
        new Date(sale.createdAt).toLocaleDateString('pt-MZ'),
        sale.customerName || 'Cliente Balcão',
        sale.paymentMethod === 'cash' ? 'Dinheiro' : sale.paymentMethod === 'card' ? 'Cartão' : sale.paymentMethod,
        sale.items?.length || 0,
        `${Number(sale.total).toLocaleString()} MT`
    ]);

    autoTable(doc, {
        startY: 90,
        head: [['Nº Venda', 'Data', 'Cliente', 'Pagamento', 'Itens', 'Total']],
        body: tableData,
        headStyles: { fillColor: [59, 130, 246] as [number, number, number], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 25 },
            2: { cellWidth: 45 },
            3: { cellWidth: 25 },
            4: { halign: 'center', cellWidth: 18 },
            5: { halign: 'right', fontStyle: 'bold', cellWidth: 30 }
        },
        margin: { left: 15, right: 15 }
    });

    // Footer
    const footerY = pageHeight - 20;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Relatório gerado em ${new Date().toLocaleString('pt-MZ')} • Multicore`, pageWidth / 2, footerY, { align: 'center' });

    addProfessionalFooter(doc, companyInfo);
    doc.save(`Farmacia_Vendas_${period.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generatePharmacyExpiringReport = (data: { items: any[]; summary: any }, companyInfo?: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    addProfessionalHeader(doc, 'ALERTA DE VALIDADES', companyInfo);

    // Summary Box
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(15, 50, pageWidth - 30, 28, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(185, 28, 28);
    doc.text('⚠️ AÇÃO URGENTE NECESSÁRIA', 20, 60);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Expirados: ${data.summary.expiredCount}`, 20, 70);
    doc.text(`A Expirar (90 dias): ${data.summary.expiringCount}`, 70, 70);
    doc.text(`Total Itens: ${data.summary.totalItems}`, 130, 70);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`Valor em Risco: ${Number(data.summary.totalValue).toLocaleString()} MT`, pageWidth - 20, 70, { align: 'right' });

    // Table
    doc.setTextColor(0, 0, 0);
    const tableData = data.items.slice(0, 40).map((item: any) => [
        item.productCode || '-',
        (item.productName || '-').substring(0, 28),
        item.batchNumber || '-',
        new Date(item.expiryDate).toLocaleDateString('pt-MZ'),
        item.daysToExpiry <= 0 ? 'EXPIRADO' : `${item.daysToExpiry} dias`,
        item.quantity.toString(),
        `${Number(item.value).toLocaleString()} MT`
    ]);

    autoTable(doc, {
        startY: 90,
        head: [['Código', 'Medicamento', 'Lote', 'Expira', 'Status', 'Qtd', 'Valor']],
        body: tableData,
        headStyles: { fillColor: [220, 38, 38] as [number, number, number], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [254, 242, 242] },
        didParseCell: (data: any) => {
            if (data.column.index === 4 && data.cell.raw === 'EXPIRADO') {
                data.cell.styles.textColor = [185, 28, 28];
                data.cell.styles.fontStyle = 'bold';
            }
        },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 45 },
            2: { cellWidth: 23 },
            3: { cellWidth: 23 },
            4: { halign: 'center', cellWidth: 22 },
            5: { halign: 'center', cellWidth: 15 },
            6: { halign: 'right', cellWidth: 28 }
        },
        margin: { left: 15, right: 15 }
    });

    // Footer
    const footerY = pageHeight - 20;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento gerado automaticamente • ${new Date().toLocaleString('pt-MZ')}`, pageWidth / 2, footerY, { align: 'center' });

    addProfessionalFooter(doc, companyInfo);
    doc.save(`Farmacia_Validades_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generatePOSReceipt = (sale: any, companyInfo: any) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, 200], // Thermal receipt size
    });

    let y = 10;
    const lineHeight = 5;
    const centerX = 40;

    // Company Logo in PDF
    if (companyInfo?.logo) {
        try {
            // Add logo centered
            doc.addImage(companyInfo.logo, 'PNG', centerX - 10, y, 20, 20);
            y += 25;
        } catch (e) {
            console.warn('Failed to add logo to PDF', e);
        }
    }

    // Company Header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo?.name || 'Empresa', centerX, y, { align: 'center' });
    y += lineHeight;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(companyInfo?.address || '', centerX, y, { align: 'center' });
    y += lineHeight;
    if (companyInfo?.phone) {
        doc.text(`Tel: ${companyInfo.phone}`, centerX, y, { align: 'center' });
        y += lineHeight;
    }
    if (companyInfo?.taxId) {
        doc.text(`NUIT: ${companyInfo.taxId}`, centerX, y, { align: 'center' });
        y += lineHeight * 2;
    }

    // Separator
    doc.line(5, y, 75, y);
    y += lineHeight;

    // Receipt info
    doc.setFont('helvetica', 'bold');
    doc.text(`RECIBO #${sale.receiptNumber || sale.saleNumber}`, centerX, y, { align: 'center' });
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(sale.createdAt).toLocaleString('pt-MZ'), centerX, y, { align: 'center' });
    y += lineHeight;

    // Customer info
    if (sale.customerName && sale.customerName !== 'Cliente Balcão') {
        y += lineHeight;
        doc.text(`Cliente: ${sale.customerName}`, 5, y);
        y += lineHeight;
    }

    // Separator
    doc.line(5, y, 75, y);
    y += lineHeight;

    // Items header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('ITEM', 5, y);
    doc.text('QTD', 45, y, { align: 'center' });
    doc.text('TOTAL', 75, y, { align: 'right' });
    y += lineHeight;

    // Items
    doc.setFont('helvetica', 'normal');
    sale.items.forEach((item: any) => {
        // Item name (may wrap, simplified for thermal)
        const name = (item.productName || item.product?.name || 'Item').substring(0, 25);
        doc.text(name, 5, y);
        y += lineHeight - 1;
        doc.text(item.quantity.toString(), 45, y, { align: 'center' });
        doc.text(`${Number(item.total).toLocaleString()} MT`, 75, y, { align: 'right' });
        y += lineHeight;
    });

    // Separator
    doc.line(5, y, 75, y);
    y += lineHeight;

    // Totals
    doc.setFontSize(7);
    doc.text('Subtotal:', 5, y);
    doc.text(`${Number(sale.subtotal).toLocaleString()} MT`, 75, y, { align: 'right' });
    y += lineHeight;

    if (sale.discount > 0) {
        doc.text('Desconto:', 5, y);
        doc.text(`-${Number(sale.discount).toLocaleString()} MT`, 75, y, { align: 'right' });
        y += lineHeight;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('TOTAL:', 5, y);
    doc.text(`${Number(sale.total).toLocaleString()} MT`, 75, y, { align: 'right' });
    y += lineHeight * 2;

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('Obrigado pela preferência!', centerX, y, { align: 'center' });
    y += lineHeight;
    doc.text('Documento processado por computador', centerX, y, { align: 'center' });

    // Save PDF
    doc.save(`Recibo_${sale.receiptNumber || sale.saleNumber}.pdf`);
};

// =============================================================================
// HOTEL FINANCE PDF REPORT
// =============================================================================

export const generateHotelFinanceReport = (data: {
    period: string;
    summary: {
        totalRevenue: number;
        totalExpenses: number;
        netProfit: number;
        profitMargin: number;
    };
    monthlyTrend: Array<{ month: string; revenue: number; expense: number; profit: number }>;
    revenueByCategory: Record<string, number>;
    expensesByCategory: Record<string, number>;
    companyInfo: any;
}) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const { companyInfo } = data;

    addProfessionalHeader(doc, 'RELATÓRIO FINANCEIRO', companyInfo, data.period);

    // Summary Section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('RESUMO EXECUTIVO', 15, 55);

    const summaryData = [
        ['Descrição', 'Valor'],
        ['Receitas Totais', `${data.summary.totalRevenue.toLocaleString()} MT`],
        ['Despesas Totais', `${data.summary.totalExpenses.toLocaleString()} MT`],
        ['Lucro Líquido', `${data.summary.netProfit.toLocaleString()} MT`],
        ['Margem de Lucro', `${data.summary.profitMargin.toFixed(1)}%`]
    ];

    autoTable(doc, {
        startY: 60,
        head: [summaryData[0]],
        body: summaryData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    });

    // Monthly Trend
    const currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TENDÊNCIA MENSAL', 15, currentY);

    const monthlyTableData = data.monthlyTrend.map(item => [
        item.month,
        `${item.revenue.toLocaleString()} MT`,
        `${item.expense.toLocaleString()} MT`,
        `${item.profit.toLocaleString()} MT`
    ]);

    autoTable(doc, {
        startY: currentY + 5,
        head: [['Mês', 'Receitas', 'Despesas', 'Lucro']],
        body: monthlyTableData,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 9 },
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right', fontStyle: 'bold' }
        }
    });

    // Sub-tables: Categories
    let nextY = (doc as any).lastAutoTable.finalY + 15;

    // Check if we need a new page
    if (nextY > 230) {
        doc.addPage();
        nextY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DISTRIBUIÇÃO POR CATEGORIA', 15, nextY);

    const revenueTableData = Object.entries(data.revenueByCategory).map(([category, value]) => [
        category === 'accommodation' ? 'Hospedagem' : category === 'consumption' ? 'Consumos' : category,
        `${Number(value).toLocaleString()} MT`
    ]);

    autoTable(doc, {
        startY: nextY + 5,
        head: [['Receitas por Categoria', 'Valor']],
        body: revenueTableData,
        theme: 'plain',
        headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } },
        margin: { right: pageWidth / 2 + 5 }
    });

    const expenseTableData = Object.entries(data.expensesByCategory)
        .sort((a, b) => b[1] - a[1]) // Sort by value
        .map(([category, value]) => [
            category,
            `${Number(value).toLocaleString()} MT`
        ]);

    autoTable(doc, {
        startY: nextY + 5,
        head: [['Despesas por Categoria', 'Valor']],
        body: expenseTableData,
        theme: 'plain',
        headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: { 1: { halign: 'right' } },
        margin: { left: pageWidth / 2 + 5 }
    });

    addProfessionalFooter(doc, companyInfo);
    doc.save(`Financeiro_Hotel_${data.period.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

// =============================================================================
// BOTTLE STORE PDF REPORTS
// =============================================================================

export const generateBottleStoreReport = (data: {
    title: string;
    period: string;
    summary: { label: string; value: string; color?: string }[];
    tables: {
        title: string;
        head: string[][];
        body: any[][];
        columnStyles?: any;
    }[];
}, companyInfo: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    addProfessionalHeader(doc, data.title, companyInfo, data.period);

    let currentY = 55;

    // Summary Boxes (Small cards)
    doc.setFontSize(10);
    const boxWidth = (pageWidth - 30) / data.summary.length;
    data.summary.forEach((item, index) => {
        const x = 15 + (index * boxWidth);
        doc.setDrawColor(230, 230, 230);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, currentY, boxWidth - 5, 20, 2, 2, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(item.label, x + 5, currentY + 7);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(item.value, x + 5, currentY + 15);
    });

    currentY += 30;

    // Tables
    data.tables.forEach((table) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(51, 65, 85);
        doc.text(table.title.toUpperCase(), 15, currentY);

        autoTable(doc, {
            startY: currentY + 5,
            head: table.head,
            body: table.body,
            theme: 'striped',
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
            styles: { fontSize: 9 },
            columnStyles: table.columnStyles,
            margin: { left: 15, right: 15 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Check for new page
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }
    });

    addProfessionalFooter(doc, companyInfo);
    doc.save(`${data.title.replace(/\s/g, '_')}_${data.period.replace(/\s/g, '_')}.pdf`);
};

// =============================================================================
// HR PAYROLL PDF REPORTS
// =============================================================================

interface PayrollReportEmployee {
    name: string;
    role: string;
    department?: string;
    baseSalary: number;
    inssDeduction: number;
    irtDeduction: number;
    bonus: number;
    allowances: number;
    totalEarnings: number;
    totalDeductions: number;
    netSalary: number;
    status: 'draft' | 'processed' | 'paid';
}

interface PayrollReportData {
    period: string;
    month: number;
    year: number;
    employees: PayrollReportEmployee[];
    totals: {
        totalNet: number;
        totalINSS: number;
        totalIRPS: number;
        totalGross: number;
    };
    inssRate: number;
}

/**
 * Generates a professional monthly payroll summary report PDF
 * Shows all employees with their salary breakdown and totals
 */
export const generateHRPayrollSummaryReport = (data: PayrollReportData, companyInfo: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    addProfessionalHeader(doc, 'RELATÓRIO MENSAL DE SALÁRIOS', companyInfo, data.period);

    // Summary Section
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 50, pageWidth - 30, 35, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('RESUMO DO MÊS', 20, 60);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const col1 = 20, col2 = 75, col3 = 130;
    doc.text(`Total Funcionários: ${data.employees.length}`, col1, 70);
    doc.text(`Taxa INSS: ${data.inssRate}%`, col2, 70);

    // Totals
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Bruto: ${data.totals.totalGross.toLocaleString()} MT`, col1, 78);
    doc.text(`INSS Retido: ${data.totals.totalINSS.toLocaleString()} MT`, col2, 78);
    doc.text(`IRPS Retido: ${data.totals.totalIRPS.toLocaleString()} MT`, col3, 78);

    doc.setTextColor(16, 185, 129);
    doc.setFontSize(11);
    doc.text(`Total Líquido: ${data.totals.totalNet.toLocaleString()} MT`, col3, 70);

    // Status summary
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    const processedCount = data.employees.filter(e => e.status === 'processed').length;
    const paidCount = data.employees.filter(e => e.status === 'paid').length;
    const draftCount = data.employees.filter(e => e.status === 'draft').length;
    doc.text(`Rascunho: ${draftCount} | Processado: ${processedCount} | Pago: ${paidCount}`, 20, 82);

    // Employees Table
    const tableData = data.employees.map((emp) => [
        emp.name.substring(0, 22),
        emp.department || emp.role.substring(0, 15),
        `${emp.baseSalary.toLocaleString()}`,
        `${emp.bonus.toLocaleString()}`,
        `${emp.inssDeduction.toLocaleString()}`,
        `${emp.irtDeduction.toLocaleString()}`,
        `${emp.netSalary.toLocaleString()}`,
        emp.status === 'paid' ? '✓ Pago' : emp.status === 'processed' ? '⏳ Proc.' : '📝 Rasc.'
    ]);

    autoTable(doc, {
        startY: 95,
        head: [['Funcionário', 'Dept/Cargo', 'Base', 'Bónus', 'INSS', 'IRPS', 'Líquido', 'Estado']],
        body: tableData,
        headStyles: {
            fillColor: [51, 65, 85] as [number, number, number],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 7
        },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 25 },
            2: { halign: 'right', cellWidth: 22 },
            3: { halign: 'right', cellWidth: 18 },
            4: { halign: 'right', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 20 },
            6: { halign: 'right', cellWidth: 25, fontStyle: 'bold' },
            7: { halign: 'center', cellWidth: 18 }
        },
        margin: { left: 15, right: 15 },
        didParseCell: (hookData: any) => {
            if (hookData.column.index === 7) {
                const text = hookData.cell.raw as string;
                if (text.includes('Pago')) {
                    hookData.cell.styles.textColor = [22, 163, 74];
                } else if (text.includes('Proc')) {
                    hookData.cell.styles.textColor = [234, 179, 8];
                }
            }
        }
    });

    // Totals Row
    const finalY = (doc as any).lastAutoTable.finalY + 5;
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.5);
    doc.line(15, finalY, pageWidth - 15, finalY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAIS:', 17, finalY + 7);
    doc.text(`${data.totals.totalINSS.toLocaleString()} MT`, 125, finalY + 7);
    doc.text(`${data.totals.totalIRPS.toLocaleString()} MT`, 145, finalY + 7);
    doc.setTextColor(16, 185, 129);
    doc.text(`${data.totals.totalNet.toLocaleString()} MT`, 168, finalY + 7);

    // Signature area
    const signY = finalY + 25;
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(200, 200, 200);
    doc.line(15, signY, 80, signY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Responsável RH', 15, signY + 5);

    doc.line(pageWidth - 80, signY, pageWidth - 15, signY);
    doc.text('Director Financeiro', pageWidth - 80, signY + 5);

    addProfessionalFooter(doc, companyInfo);
    doc.save(`Folha_Salarial_${data.period.replace(/\s/g, '_')}.pdf`);
};

interface PaymentConfirmationData {
    employee: {
        name: string;
        code: string;
        role: string;
        department?: string;
        nuit?: string;
        socialSecurityNumber?: string;
    };
    payroll: {
        month: number;
        year: number;
        baseSalary: number;
        bonus: number;
        allowances: number;
        otAmount: number;
        inssDeduction: number;
        irtDeduction: number;
        advances: number;
        totalEarnings: number;
        totalDeductions: number;
        netSalary: number;
    };
    payment: {
        method: 'bank_transfer' | 'cash' | 'check';
        date: Date;
        reference?: string;
        paidBy: string;
        notes?: string;
    };
}

/**
 * Generates a payment confirmation receipt for a paid salary
 * Includes payment method, date, and confirmation reference
 */
export const generatePaymentConfirmation = (data: PaymentConfirmationData, companyInfo: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const period = `${months[data.payroll.month - 1]} ${data.payroll.year}`;

    addProfessionalHeader(doc, 'CONFIRMAÇÃO DE PAGAMENTO', companyInfo, period);

    // Confirmation Reference Box
    doc.setDrawColor(22, 163, 74);
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(15, 50, pageWidth - 30, 25, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(22, 163, 74);
    doc.text('✓ PAGAMENTO CONFIRMADO', 20, 60);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Referência: ${data.payment.reference || `PAY-${Date.now().toString().slice(-8)}`}`, 20, 68);
    doc.text(`Data: ${data.payment.date.toLocaleDateString('pt-MZ')}`, 120, 68);

    // Employee Details
    let y = 85;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DADOS DO FUNCIONÁRIO', 15, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Nome: ${data.employee.name}`, 15, y);
    doc.text(`Código: ${data.employee.code}`, 120, y);
    y += 6;
    doc.text(`Cargo: ${data.employee.role}`, 15, y);
    if (data.employee.department) {
        doc.text(`Departamento: ${data.employee.department}`, 120, y);
    }
    y += 6;
    if (data.employee.nuit) doc.text(`NUIT: ${data.employee.nuit}`, 15, y);
    if (data.employee.socialSecurityNumber) doc.text(`INSS: ${data.employee.socialSecurityNumber}`, 120, y);

    // Salary Breakdown Table
    y += 15;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('COMPOSIÇÃO SALARIAL', 15, y);

    const salaryData = [
        ['Salário Base', `${data.payroll.baseSalary.toLocaleString()} MT`, ''],
        ['Subsídios', `${data.payroll.allowances.toLocaleString()} MT`, ''],
        ['Bónus', `${data.payroll.bonus.toLocaleString()} MT`, ''],
        ['Horas Extras', `${data.payroll.otAmount.toLocaleString()} MT`, ''],
        ['INSS (3%)', '', `${data.payroll.inssDeduction.toLocaleString()} MT`],
        ['IRPS', '', `${data.payroll.irtDeduction.toLocaleString()} MT`],
        ['Adiantamentos', '', `${data.payroll.advances.toLocaleString()} MT`],
    ];

    autoTable(doc, {
        startY: y + 5,
        head: [['Descrição', 'Ganhos', 'Descontos']],
        body: salaryData,
        headStyles: {
            fillColor: [51, 65, 85] as [number, number, number],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        styles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { halign: 'right', cellWidth: 45 },
            2: { halign: 'right', cellWidth: 45 }
        },
        margin: { left: 15, right: 15 }
    });

    // Totals
    const tableY = (doc as any).lastAutoTable.finalY;

    doc.setFillColor(248, 250, 252);
    doc.rect(15, tableY, pageWidth - 30, 20, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Total Ganhos:', 20, tableY + 8);
    doc.text(`${data.payroll.totalEarnings.toLocaleString()} MT`, 95, tableY + 8, { align: 'right' });
    doc.text('Total Descontos:', 110, tableY + 8);
    doc.text(`${data.payroll.totalDeductions.toLocaleString()} MT`, pageWidth - 20, tableY + 8, { align: 'right' });

    doc.setFillColor(22, 163, 74);
    doc.setTextColor(255, 255, 255);
    doc.rect(15, tableY + 12, pageWidth - 30, 10, 'F');
    doc.setFontSize(12);
    doc.text('VALOR LÍQUIDO PAGO:', 20, tableY + 19);
    doc.text(`${data.payroll.netSalary.toLocaleString()} MT`, pageWidth - 20, tableY + 19, { align: 'right' });

    // Payment Details
    doc.setTextColor(0, 0, 0);
    const paymentY = tableY + 35;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DETALHES DO PAGAMENTO', 15, paymentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const paymentMethods: Record<string, string> = {
        'bank_transfer': 'Transferência Bancária',
        'cash': 'Dinheiro',
        'check': 'Cheque'
    };

    doc.text(`Método: ${paymentMethods[data.payment.method] || data.payment.method}`, 15, paymentY + 8);
    doc.text(`Data de Pagamento: ${data.payment.date.toLocaleDateString('pt-MZ')}`, 15, paymentY + 14);
    doc.text(`Processado por: ${data.payment.paidBy}`, 15, paymentY + 20);

    if (data.payment.notes) {
        doc.text(`Observações: ${data.payment.notes.substring(0, 60)}`, 15, paymentY + 26);
    }

    // Signatures
    const signY = paymentY + 45;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, signY, 80, signY);
    doc.setFontSize(8);
    doc.text('Assinatura do Funcionário', 15, signY + 5);
    doc.text('Data: ____/____/____', 15, signY + 10);

    doc.line(pageWidth - 80, signY, pageWidth - 15, signY);
    doc.text('Carimbo e Assinatura da Empresa', pageWidth - 80, signY + 5);

    addProfessionalFooter(doc, companyInfo);

    const filename = `Confirmacao_Pagamento_${data.employee.name.replace(/\s/g, '_')}_${period.replace(/\s/g, '_')}.pdf`;
    doc.save(filename);

    return filename;
};
