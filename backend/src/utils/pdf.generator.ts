import PDFDocument from 'pdfkit';
import { Response } from 'express';

export type DeliveryPdfItem = {
    barcode?: string | null;
    reference?: string | null;
    description: string;
    expiry?: Date | string | null;
    quantity: number;
    unit?: string | null;
    value: number;   // line value (unitPrice × quantity)
    weight: number;  // line weight in kg (unitWeight × quantity)
};

type DeliveryPdfInput = {
    trackingNumber: string;
    createdAt: Date | string;
    status: string;
    kind?: string | null;
    driverName?: string | null;
    vehiclePlate?: string | null;
    customerName?: string | null;
    destination: string;
    sourceWarehouseName?: string | null;
    targetWarehouseName?: string | null;
    notes?: string | null;
    items?: DeliveryPdfItem[];
};

type CompanyInfoInput = {
    name?: string;
    address?: string;
    nuit?: string;
    phone?: string;
};

// ── Formatting helpers (locale-independent, safe in any Node build) ──────────
const fmtMoney = (n: number) =>
    (Number(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' MT';
const fmtNum = (n: number) => {
    const v = Number(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, '');
};
const fmtDate = (d: Date | string) => {
    const dt = new Date(d);
    const p = (x: number) => String(x).padStart(2, '0');
    return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
};
const fmtShortDate = (d: Date | string | null | undefined) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    const p = (x: number) => String(x).padStart(2, '0');
    return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${String(dt.getFullYear()).slice(-2)}`;
};

// ── Compact items table column layout (A4, 40pt margins → 515pt usable) ──────
const COLS = [
    { key: 'barcode', label: 'Cód. Barras', x: 40, w: 80, align: 'left' as const },
    { key: 'reference', label: 'Ref.', x: 120, w: 55, align: 'left' as const },
    { key: 'description', label: 'Descrição', x: 175, w: 140, align: 'left' as const },
    { key: 'expiry', label: 'Validade', x: 315, w: 50, align: 'center' as const },
    { key: 'quantity', label: 'Qtd', x: 365, w: 40, align: 'right' as const },
    { key: 'value', label: 'Valor', x: 405, w: 60, align: 'right' as const },
    { key: 'weight', label: 'Peso(kg)', x: 465, w: 50, align: 'right' as const },
];
const TABLE_LEFT = 40;
const TABLE_RIGHT = 515;
const ROW_H = 16;

export const generateDeliveryPDF = (res: Response, delivery: DeliveryPdfInput, companyInfo: CompanyInfoInput) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const isTransfer = delivery.kind === 'warehouse_transfer';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Guia-${delivery.trackingNumber}.pdf"`);
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const rightColX = pageWidth - 210;

    // ----- HEADER (condensed) -----
    doc.fontSize(18).font('Helvetica-Bold')
        .text(isTransfer ? 'GUIA DE TRANSFERÊNCIA' : 'GUIA DE TRANSPORTE', 40, 40);

    doc.fontSize(9).font('Helvetica');
    let y = 66;
    doc.font('Helvetica-Bold').text(companyInfo.name || 'Empresa Emissora', 40, y);
    doc.font('Helvetica');
    if (companyInfo.address) { y += 12; doc.text(companyInfo.address, 40, y); }
    if (companyInfo.nuit) { y += 12; doc.text(`NUIT: ${companyInfo.nuit}`, 40, y); }
    if (companyInfo.phone) { y += 12; doc.text(`Tel: ${companyInfo.phone}`, 40, y); }

    // Document meta (right column)
    const meta: Array<[string, string]> = [
        ['Documento Nº:', delivery.trackingNumber],
        ['Data de Emissão:', fmtDate(delivery.createdAt)],
        ['Estado:', delivery.status.toUpperCase()],
    ];
    if (isTransfer) {
        meta.push(['Origem:', delivery.sourceWarehouseName || '—']);
        meta.push(['Destino:', delivery.targetWarehouseName || '—']);
    } else {
        meta.push(['Destinatário:', delivery.customerName || '—']);
        meta.push(['Morada:', delivery.destination || '—']);
    }
    let my = 66;
    doc.fontSize(9);
    for (const [label, value] of meta) {
        doc.font('Helvetica-Bold').text(label, rightColX, my, { width: 80 });
        doc.font('Helvetica').text(value, rightColX + 82, my, { width: 88 });
        my += 13;
    }

    // Transport line (driver/vehicle) — compact
    let cursorY = Math.max(y, my) + 14;
    doc.fontSize(9).font('Helvetica')
        .text(`Condutor: ${delivery.driverName || 'N/A'}    |    Veículo: ${delivery.vehiclePlate || 'N/A'}`, 40, cursorY);
    cursorY += 18;

    // ----- ITEMS TABLE -----
    const items = delivery.items ?? [];

    const drawTableHeader = (top: number) => {
        doc.rect(TABLE_LEFT, top, TABLE_RIGHT - TABLE_LEFT, ROW_H).fill('#e5e7eb');
        doc.fillColor('#111827').fontSize(8).font('Helvetica-Bold');
        for (const c of COLS) {
            doc.text(c.label, c.x + 2, top + 5, { width: c.w - 4, align: c.align });
        }
        doc.fillColor('#000000');
        return top + ROW_H;
    };

    let rowY = drawTableHeader(cursorY);

    const cell = (text: string, c: typeof COLS[number], top: number) => {
        doc.text(text, c.x + 2, top + 4, { width: c.w - 4, align: c.align, lineBreak: false, ellipsis: true });
    };

    let totalValue = 0;
    let totalWeight = 0;
    let totalQty = 0;
    doc.fontSize(8).font('Helvetica');

    items.forEach((it, idx) => {
        // Pagination: repeat header on a new page.
        if (rowY + ROW_H > doc.page.height - 120) {
            doc.addPage();
            rowY = drawTableHeader(40);
            doc.fontSize(8).font('Helvetica');
        }
        if (idx % 2 === 1) {
            doc.rect(TABLE_LEFT, rowY, TABLE_RIGHT - TABLE_LEFT, ROW_H).fill('#f9fafb');
            doc.fillColor('#000000');
        }
        totalValue += Number(it.value) || 0;
        totalWeight += Number(it.weight) || 0;
        totalQty += Number(it.quantity) || 0;

        cell(it.barcode || '—', COLS[0], rowY);
        cell(it.reference || '—', COLS[1], rowY);
        cell(it.description || '—', COLS[2], rowY);
        cell(fmtShortDate(it.expiry), COLS[3], rowY);
        cell(`${fmtNum(it.quantity)} ${it.unit || ''}`.trim(), COLS[4], rowY);
        cell(fmtMoney(it.value), COLS[5], rowY);
        cell(fmtNum(it.weight), COLS[6], rowY);
        rowY += ROW_H;
    });

    if (items.length === 0) {
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#6b7280')
            .text('Sem itens registados nesta guia.', TABLE_LEFT + 2, rowY + 4);
        doc.fillColor('#000000');
        rowY += ROW_H;
    }

    // Top border + totals row
    doc.moveTo(TABLE_LEFT, rowY).lineTo(TABLE_RIGHT, rowY).strokeColor('#9ca3af').stroke();
    doc.rect(TABLE_LEFT, rowY, TABLE_RIGHT - TABLE_LEFT, ROW_H).fill('#f3f4f6');
    doc.fillColor('#111827').fontSize(8).font('Helvetica-Bold');
    doc.text(`Total de itens: ${items.length}`, COLS[0].x + 2, rowY + 5);
    doc.text(`Qtd: ${fmtNum(totalQty)}`, COLS[4].x - 30, rowY + 5, { width: COLS[4].w + 28, align: 'right' });
    doc.text(fmtMoney(totalValue), COLS[5].x + 2, rowY + 5, { width: COLS[5].w - 4, align: 'right' });
    doc.text(`${fmtNum(totalWeight)} kg`, COLS[6].x + 2, rowY + 5, { width: COLS[6].w - 4, align: 'right' });
    doc.fillColor('#000000');
    rowY += ROW_H + 12;

    // ----- OBSERVATIONS -----
    if (delivery.notes) {
        doc.font('Helvetica-Bold').fontSize(9).text('Observações:', 40, rowY);
        doc.font('Helvetica').fontSize(9).text(delivery.notes, 40, rowY + 12, { width: TABLE_RIGHT - 40 });
    }

    // ----- SIGNATURES (compact, fixed to bottom) -----
    const sigY = doc.page.height - 90;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
    doc.moveTo(40, sigY).lineTo(190, sigY).stroke();
    doc.text('A Entidade Emissora', 40, sigY + 6, { width: 150, align: 'center' });
    doc.moveTo(225, sigY).lineTo(375, sigY).stroke();
    doc.text('O Condutor / Transportador', 225, sigY + 6, { width: 150, align: 'center' });
    doc.moveTo(410, sigY).lineTo(TABLE_RIGHT, sigY).stroke();
    doc.text(isTransfer ? 'Recebido no Destino' : 'O Cliente / Recebedor', 410, sigY + 6, { width: TABLE_RIGHT - 410, align: 'center' });

    doc.font('Helvetica').fontSize(7).fillColor('#6b7280').text(
        'Documento gerado automaticamente pelo sistema MultiCore ERP',
        40, doc.page.height - 40, { align: 'center', width: pageWidth - 80 }
    );

    doc.end();
};
