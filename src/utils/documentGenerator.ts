import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';


// Professional Header Helper
const addProfessionalHeader = (doc: jsPDF, title: string, companyInfo: any, period?: string) => {
    const pageWidth = doc.internal.pageSize.width;

    // Company Information (Left Aligned)
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(companyInfo?.companyName || 'Minha Empresa', 15, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(companyInfo?.address || 'Endereço não configurado', 15, 26);
    doc.text(`NUIT: ${companyInfo?.taxId || 'N/A'}`, 15, 31);
    doc.text(`Tel: ${companyInfo?.phone || 'N/A'} | Email: ${companyInfo?.email || 'N/A'}`, 15, 36);

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

export const generateGuiaRemessa = (transfer: any, companyInfo?: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    addProfessionalHeader(doc, 'GUIA DE REMESSA', companyInfo);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Guia Nº: ${transfer.number}`, 15, 52);
    doc.text(`Data da Operação: ${new Date(transfer.createdAt).toLocaleDateString()}`, 15, 57);
    doc.text(`Emitido por: ${transfer.responsible || 'Sistema'}`, 15, 62);

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

    doc.save(`Guia_${transfer.number}.pdf`);
};

export const generateBookingReceipt = (booking: any, companyInfo: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Company Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(companyInfo?.companyName || 'Empresa', 15, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text(companyInfo?.address || '', 15, 26);
    doc.text(`NUIT: ${companyInfo?.taxId || ''} | Tel: ${companyInfo?.phone || ''}`, 15, 31);

    // Receipt Info (Right aligned)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('RECIBO DE ESTADIA', pageWidth - 15, 20, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Recibo Nº: ${booking.id?.slice(-8).toUpperCase()}`, pageWidth - 15, 27, { align: 'right' });
    doc.text(`Data: ${new Date().toLocaleDateString('pt-MZ')}`, pageWidth - 15, 32, { align: 'right' });

    doc.setDrawColor(229, 231, 235);
    doc.line(15, 40, pageWidth - 15, 40);

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

    doc.save(`Relatorio_Validades_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateHospitalityReport = (data: any, companyInfo: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Company Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(companyInfo?.companyName || 'Empresa', 15, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text(companyInfo?.address || '', 15, 26);
    doc.text(`NUIT: ${companyInfo?.taxId || ''} | Tel: ${companyInfo?.phone || ''}`, 15, 31);

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('RELATÓRIO DE HOTELARIA', pageWidth - 15, 20, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${data.period}`, pageWidth - 15, 27, { align: 'right' });
    doc.text(`Data: ${new Date().toLocaleDateString('pt-MZ')}`, pageWidth - 15, 32, { align: 'right' });

    doc.setDrawColor(229, 231, 235);
    doc.line(15, 40, pageWidth - 15, 40);

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
        item.isLowStock ? '⚠️' : '✓',
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
    doc.text(`Gerado automaticamente pelo Sistema de Gestão de Farmácia • ${new Date().toLocaleString('pt-MZ')}`, pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Página 1 de 1`, pageWidth - 15, footerY, { align: 'right' });

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
    doc.text(`Relatório gerado em ${new Date().toLocaleString('pt-MZ')} • Sistema de Gestão de Farmácia`, pageWidth / 2, footerY, { align: 'center' });

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

    // Header - Professional & Simple
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(companyInfo?.companyName || 'Empresa', 15, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);
    doc.text(companyInfo?.address || '', 15, 26);
    doc.text(`NUIT: ${companyInfo?.taxId || ''} | Tel: ${companyInfo?.phone || ''}`, 15, 31);
    doc.text(companyInfo?.email || '', 15, 36);

    // Right-aligned report title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('RELATÓRIO FINANCEIRO', pageWidth - 15, 20, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${data.period}`, pageWidth - 15, 27, { align: 'right' });
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-MZ')}`, pageWidth - 15, 32, { align: 'right' });

    doc.setDrawColor(229, 231, 235);
    doc.line(15, 42, pageWidth - 15, 42);

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

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            `Documento gerado pelo Sistema de Gestão Comercial - Página ${i} de ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }

    doc.save(`Financeiro_Hotel_${data.period.replace(' ', '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};

