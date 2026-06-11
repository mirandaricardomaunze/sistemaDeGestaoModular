import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import type { Prisma } from '@prisma/client';
import { formatQuantity, unitAbbrev } from '../constants/unitOfMeasure';

// Numeric payloads coming from Prisma may be Decimal; the routes also pass
// numbers/strings/undefined. Use `Number(value)` before any math.
type Money = number | string | Prisma.Decimal | null | undefined;

// Reports come from many different services with bespoke shapes, so the
// generator accepts any object and reads optional fields defensively.
type ReportData = Record<string, unknown>;
type CompanyInfo = {
    name?: string | null;
    address?: string | null;
    nuit?: string | null;
    phone?: string | null;
    email?: string | null;
    tradeName?: string | null;
    companyName?: string | null;
    taxId?: string | null;
    ivaRate?: Money;
    bankAccounts?: Array<{ bankName: string; accountNumber: string; nib?: string | null }> | Prisma.JsonValue;
};

type SaleSummary = { createdAt: string | Date; receiptNumber?: string; total: number | string };
type ProductSummary = {
    name: string;
    code?: string;
    barcode?: string;
    currentStock?: number | Prisma.Decimal;
    minStock?: number | Prisma.Decimal;
    price?: number;
    salesLast30Days?: number;
    stock?: number | Prisma.Decimal;
    batchNumber?: string;
    expiryDate?: string | Date;
    daysToExpiry?: number;
};
type CustomerSummary = { name: string; email?: string; phone?: string };
type CancellationItem = { quantity: number | Prisma.Decimal; productName: string; total: number };
type QuoteItem = { productName: string; quantity: number | Prisma.Decimal; price: number; total: number };
type SaleItem = {
    productName: string;
    quantity: number | Prisma.Decimal;
    unitPrice: number;
    total: number;
    posologyLabel?: string;
    batch?: { batchNumber?: string };
};
type InvoiceItem = {
    description?: string | null;
    productName?: string | null;
    quantity: number | Prisma.Decimal;
    unitPrice: Money;
    total: Money;
    posologyLabel?: string | null;
    batch?: { batchNumber?: string | null; expiryDate?: string | Date | null } | null;
    product?: { unit?: string | null } | null;
};
type InvoicePayload = {
    invoiceNumber: string;
    orderNumber?: string | null;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerDocument?: string | null;
    issueDate: string | Date;
    dueDate: string | Date;
    status?: string | null;
    items?: InvoiceItem[];
    subtotal: Money;
    discount?: Money;
    tax: Money;
    total: Money;
    amountPaid?: Money;
    amountDue?: Money;
    notes?: string | null;
    originModule?: string | null;
    saleNumber?: string | null;
};

export class PDFService {
    private uploadsDir = path.join(__dirname, '../../uploads/reports');
    // Fonte Arial do Windows para suporte a UTF-8 (acentuação em Português)
    private primaryFont = 'C:\\Windows\\Fonts\\arial.ttf';
    private PHARMACY_COLOR = '#0d9488'; // Professional Medical Teal
    private PRIMARY_BLUE = '#1e40af';

    constructor() {
        // Criar diretório se não existir
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
            logger.info('Created uploads/reports directory');
        }
    }

    private setupFont(doc: PDFKit.PDFDocument) {
        if (fs.existsSync(this.primaryFont)) {
            doc.font(this.primaryFont);
        } else {
            logger.warn('Fonte Arial não encontrada. Usando Helvetica (pode haver erros de acentuação).');
            doc.font('Helvetica');
        }
    }

    /**
     * Gera relatório em PDF
     */
    async generateReport(data: ReportData, type: string, companyInfo?: CompanyInfo | null): Promise<string> {
        const filename = `report-${type}-${Date.now()}.pdf`;
        const filepath = path.join(this.uploadsDir, filename);

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    margin: 50,
                    size: 'A4'
                });
                
                this.setupFont(doc);
                
                const stream = fs.createWriteStream(filepath);

                doc.pipe(stream);

                // Header com Informaces da Empresa
                if (companyInfo) {
                    doc.fontSize(20)
                        .fillColor('#1e40af')
                        .text(companyInfo.name || 'Multicore', { align: 'left' });

                    doc.fontSize(10)
                        .fillColor('#666666')
                        .text(companyInfo.address || '', { align: 'left' })
                        .text(`NUIT: ${companyInfo.nuit || 'N/A'} | Tel: ${companyInfo.phone || 'N/A'}`)
                        .text(`Email: ${companyInfo.email || ''}`);
                } else {
                    doc.fontSize(24)
                        .fillColor('#1e40af')
                        .text('Multicore', { align: 'center' });
                }

                doc.moveDown(1);
                doc.fontSize(16)
                    .fillColor('#000000')
                    .text(`${this.getReportTypeName(type)}`, { align: 'right' });

                doc.fontSize(10)
                    .fillColor('#666666')
                    .text(`Data de Emissão: ${new Date().toLocaleDateString('pt-MZ', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                    })}`, { align: 'right' });

                // Pharmacy branding icon if applicable
                if (type.startsWith('pharmacy') || type.includes('medication')) {
                    this.drawMedicalCross(doc, 500, 45, 20);
                }

                // Linha separadora
                doc.moveDown(1);
                doc.strokeColor('#e5e7eb')
                    .lineWidth(1)
                    .moveTo(50, doc.y)
                    .lineTo(545, doc.y)
                    .stroke();

                doc.moveDown(2);

                // Content baseado no tipo
                this.addContentByType(doc, data, type);

                // Footer
                const bottomY = 750;
                doc.fontSize(8)
                    .fillColor('#999999')
                    .text(
                        `Gerado automaticamente pelo Sistema ERP em ${new Date().toLocaleString('pt-MZ')}`,
                        50,
                        bottomY,
                        { align: 'center', width: 495 }
                    );

                doc.end();

                stream.on('finish', () => {
                    logger.info(`PDF generated: ${filename}`);
                    resolve(`/uploads/reports/${filename}`);
                });

                stream.on('error', (error) => {
                    logger.error('PDF generation error:', error);
                    reject(error);
                });
            } catch (error) {
                logger.error('PDF creation error:', error);
                reject(error);
            }
        });
    }

    private getReportTypeName(type: string): string {
        const names: Record<string, string> = {
            sales: 'Vendas',
            inventory: 'Inventrio',
            financial: 'Financeiro',
            customers: 'Clientes',
            daily: 'Diário',
            weekly: 'Semanal',
            monthly: 'Mensal',
            yearly: 'Anual',
            hr: 'Recursos Humanos',
            order_cancellation: 'Documento de Cancelamento de Encomenda',
            quotation: 'Cotação',
            inventory_table: 'Tabela Geral de Inventário',
            price_list: 'Catálogo de Preços',
            pharmacy_inventory: 'Relatório de Stock Farmacêutico',
            pharmacy_sale: 'Comprovativo de Venda de Medicamentos'
        };
        return names[type] || type;
    }

    private addContentByType(doc: PDFKit.PDFDocument, data: ReportData, type: string) {
        switch (type) {
            case 'sales':
                this.addSalesContent(doc, data);
                break;
            case 'inventory':
                this.addInventoryContent(doc, data);
                break;
            case 'financial':
                this.addFinancialContent(doc, data);
                break;
            case 'customers':
                this.addCustomersContent(doc, data);
                break;
            case 'order_cancellation':
                this.addOrderCancellationContent(doc, data);
                break;
            case 'hr':
                this.addHRContent(doc, data);
                break;
            case 'quotation':
                this.addQuotationContent(doc, data);
                break;
            case 'inventory_table':
                this.addInventoryTableContent(doc, data);
                break;
            case 'price_list':
                this.addPriceListContent(doc, data);
                break;
            case 'pharmacy_inventory':
                this.addPharmacyInventoryContent(doc, data);
                break;
            case 'pharmacy_sale':
                this.addPharmacySaleContent(doc, data);
                break;
            default:
                this.addGenericContent(doc, data);
        }
    }

    private drawMedicalCross(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
        doc.save();
        doc.translate(x, y);
        doc.fillColor(this.PHARMACY_COLOR).opacity(0.15);
        // Vertical bar
        doc.rect(-size / 4, -size / 2, size / 2, size).fill();
        // Horizontal bar
        doc.rect(-size / 2, -size / 4, size, size / 2).fill();
        doc.restore();
    }

    private addSalesContent(doc: PDFKit.PDFDocument, data: ReportData) {
        doc.fontSize(16)
            .fillColor('#1e40af')
            .text('📊 Resumo de Vendas', { underline: true });
        doc.moveDown();

        // Métricas principais
        doc.fontSize(12).fillColor('#000000');

        const metrics = [
            { label: 'Total de Vendas', value: this.formatCurrency(Number(data.total) || 0) },
            { label: 'Número de Transaces', value: String(Number(data.count) || 0) },
            { label: 'Ticket Médio', value: this.formatCurrency(Number(data.average) || 0) }
        ];

        metrics.forEach(metric => {
            doc.fontSize(11).fillColor('#666666').text(metric.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${metric.value}`, { align: 'right' });
        });

        doc.moveDown(2);

        // Últimas vendas
        if (Array.isArray(data.sales) && data.sales.length > 0) {
            doc.fontSize(14).fillColor('#1e40af').text('Últimas Transaces:', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#000000');

            (data.sales as SaleSummary[]).slice(0, 10).forEach((sale, index: number) => {
                const date = new Date(sale.createdAt).toLocaleDateString('pt-MZ');
                doc.text(
                    `${index + 1}. Recibo: ${sale.receiptNumber || 'N/A'} | ` +
                    `Data: ${date} | ` +
                    `Total: ${this.formatCurrency(Number(sale.total))}`
                );
            });
        }
    }

    private addInventoryContent(doc: PDFKit.PDFDocument, data: ReportData) {
        doc.fontSize(16)
            .fillColor('#1e40af')
            .text('📦 Resumo de Inventrio', { underline: true });
        doc.moveDown();

        doc.fontSize(12).fillColor('#000000');

        const metrics = [
            { label: 'Total de Produtos em Stock', value: String(Number(data.totalProducts) || 0) },
            { label: 'Produtos com Stock Crítico', value: String(Number(data.lowStockCount) || 0) },
            { label: 'Custo Total do Inventrio', value: this.formatCurrency(Number(data.totalCost) || 0) },
            { label: 'Valor de Venda Potencial', value: this.formatCurrency(Number(data.totalValue) || 0) },
            { label: 'Lucro Bruto Potencial', value: this.formatCurrency(Number(data.potentialProfit) || 0) }
        ];

        metrics.forEach(metric => {
            doc.fontSize(11).fillColor('#666666').text(metric.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${metric.value}`, { align: 'right' });
        });

        doc.moveDown(2);

        // Top Moving Products
        if (Array.isArray(data.topMovingProducts) && data.topMovingProducts.length > 0) {
            doc.fontSize(14).fillColor('#1e40af').text('📈 Produtos com Maior Giro (Últimos 30 dias):', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#000000');

            (data.topMovingProducts as ProductSummary[]).forEach((p) => {
                doc.text(`• ${p.name} - Vendas: ${p.salesLast30Days} unid. | Stock Atual: ${p.stock}`);
            });
            doc.moveDown(2);
        }

        if (Array.isArray(data.lowStockProducts) && data.lowStockProducts.length > 0) {
            doc.fontSize(14).fillColor('#dc2626').text('⚠️ Produtos com Stock Crítico:', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#000000');

            (data.lowStockProducts as ProductSummary[]).forEach((product) => {
                doc.text(
                    `• ${product.name} (Ref: ${product.code || 'N/A'}${product.barcode ? ` | EAN: ${product.barcode}` : ''})`
                );
                doc.fontSize(9).fillColor('#666666').text(
                    `Stock Atual: ${product.currentStock} | Mínimo: ${product.minStock} | Preço: ${this.formatCurrency(Number(product.price))}`,
                    { indent: 10 }
                );
                doc.fontSize(10).fillColor('#000000');
                doc.moveDown(0.2);
            });
        }
    }

    private addFinancialContent(doc: PDFKit.PDFDocument, data: ReportData) {
        doc.fontSize(16)
            .fillColor('#1e40af')
            .text('💰 Resumo Financeiro', { underline: true });
        doc.moveDown();

        doc.fontSize(12).fillColor('#000000');

        const metrics = [
            { label: 'Receita Total', value: this.formatCurrency(Number(data.revenue) || 0) },
            { label: 'Número de Transaces', value: String(Number(data.transactions) || 0) },
            { label: 'Ticket Médio', value: this.formatCurrency(Number(data.averageTicket) || 0) }
        ];

        metrics.forEach(metric => {
            doc.fontSize(11).fillColor('#666666').text(metric.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${metric.value}`, { align: 'right' });
        });
    }

    private addCustomersContent(doc: PDFKit.PDFDocument, data: ReportData) {
        doc.fontSize(16)
            .fillColor('#1e40af')
            .text('👥 Resumo de Clientes', { underline: true });
        doc.moveDown();

        doc.fontSize(12).fillColor('#000000');

        const metrics = [
            { label: 'Total de Clientes', value: String(Number(data.total) || 0) },
            { label: 'Clientes Ativos', value: String(Number(data.active) || 0) }
        ];

        metrics.forEach(metric => {
            doc.fontSize(11).fillColor('#666666').text(metric.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${metric.value}`, { align: 'right' });
        });

        doc.moveDown(2);

        if (Array.isArray(data.customers) && data.customers.length > 0) {
            doc.fontSize(14).fillColor('#1e40af').text('Lista de Clientes:', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#000000');

            (data.customers as CustomerSummary[]).slice(0, 20).forEach((customer, index: number) => {
                doc.text(`${index + 1}. ${customer.name} - ${customer.email || customer.phone || 'Sem contacto'}`);
            });
        }
    }

    private addOrderCancellationContent(doc: PDFKit.PDFDocument, data: ReportData) {
        doc.fontSize(16)
            .fillColor('#dc2626')
            .text('🚫 Comprovativo de Cancelamento', { underline: true });
        doc.moveDown();

        doc.fontSize(12).fillColor('#000000');

        const details = [
            { label: 'Encomenda Nº', value: data.orderNumber || 'N/A' },
            { label: 'Cliente', value: data.customerName || 'N/A' },
            { label: 'Data de Cancelamento', value: new Date().toLocaleString('pt-MZ') },
            { label: 'Responsável', value: data.responsibleName || 'Sistema' }
        ];

        details.forEach(detail => {
            doc.fontSize(11).fillColor('#666666').text(detail.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${detail.value}`);
        });

        doc.moveDown(1);
        if (data.notes) {
            doc.fontSize(11).fillColor('#666666').text('Motivo:', { continued: true });
            doc.fontSize(12).fillColor('#dc2626').text(` ${data.notes}`);
        }

        doc.moveDown(2);

        if (Array.isArray(data.items) && data.items.length > 0) {
            doc.fontSize(14).fillColor('#1e40af').text('Itens Cancelados (Stock Restituído):', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#000000');

            (data.items as CancellationItem[]).forEach((item) => {
                doc.text(
                    `• ${item.quantity}x ${item.productName} - ` +
                    `Total: ${this.formatCurrency(item.total)}`
                );
            });

            doc.moveDown();
            doc.fontSize(12).fillColor('#000000').text(`Valor Total Cancelado: ${this.formatCurrency(Number(data.total))}`, { align: 'right' });
        }

        doc.moveDown(2);
        doc.fontSize(10).fillColor('#999999').text('Este comprovativo atesta que a encomenda descrita foi cancelada e o respetivo stock reservado foi devidamente libertado.', { align: 'center' });
    }

    private addHRContent(doc: PDFKit.PDFDocument, data: ReportData) {
        type HRData = {
            employees?: { active?: number; total?: number };
            payroll?: { month?: number; year?: number; total_earnings?: number; total_deductions?: number; total_net?: number };
            vacations?: { pending?: number };
        };
        const hr = data as HRData;

        doc.fontSize(16)
            .fillColor('#1e40af')
            .text('👥 Resumo de Recursos Humanos', { underline: true });
        doc.moveDown();

        // 1. Quadro de Pessoal
        doc.fontSize(14).fillColor('#1e40af').text('Quadro de Pessoal:');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');

        const activeStaff = hr.employees?.active ?? 0;
        const totalStaff = hr.employees?.total ?? 0;
        const staffMetrics = [
            { label: 'Colaboradores Ativos', value: activeStaff.toString() },
            { label: 'Total de Registros', value: totalStaff.toString() },
            { label: 'Taxa de Ocupação', value: totalStaff > 0 ? `${((activeStaff / totalStaff) * 100).toFixed(1)}%` : '0%' }
        ];

        staffMetrics.forEach(m => {
            doc.fontSize(11).fillColor('#666666').text(m.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${m.value}`, { align: 'right' });
        });

        doc.moveDown(1.5);

        // 2. Resumo Financeiro (Folha de Pagamento)
        doc.fontSize(14).fillColor('#1e40af').text(`Folha de Pagamento (${hr.payroll?.month}/${hr.payroll?.year}):`);
        doc.moveDown(0.5);

        const payrollMetrics = [
            { label: 'Vencimentos Brutos', value: this.formatCurrency(hr.payroll?.total_earnings || 0) },
            { label: 'Total de Descontos', value: this.formatCurrency(hr.payroll?.total_deductions || 0) },
            { label: 'Salário Líquido Total', value: this.formatCurrency(hr.payroll?.total_net || 0), bold: true }
        ];

        payrollMetrics.forEach(m => {
            doc.fontSize(11).fillColor('#666666').text(m.label, { continued: true });
            doc.fontSize(12).fillColor(m.bold ? '#1e40af' : '#000000').text(`: ${m.value}`, { align: 'right' });
        });

        doc.moveDown(1.5);

        // 3. Gestão de Férias e Ausências
        doc.fontSize(14).fillColor('#1e40af').text('Férias e Ausências:');
        doc.moveDown(0.5);

        const pendingVac = hr.vacations?.pending ?? 0;
        doc.fontSize(11).fillColor('#666666').text('Pedidos de Férias Pendentes', { continued: true });
        doc.fontSize(12).fillColor(pendingVac > 0 ? '#dc2626' : '#000000').text(`: ${pendingVac}`, { align: 'right' });

        doc.moveDown(2);
        doc.fontSize(10).fillColor('#999999').text('Este relatório contém dados agregados para análise executiva da gestão de capital humano.', { align: 'center' });
    }

    private addQuotationContent(doc: PDFKit.PDFDocument, data: ReportData) {
        type QuoteData = {
            quote?: {
                customerName: string;
                orderNumber: string;
                deliveryDate?: string | Date;
                items?: QuoteItem[];
                total: number;
                notes?: string;
            };
        };
        const quoteData = data as QuoteData;
        if (!quoteData.quote) return;
        const quote = quoteData.quote;

        doc.fontSize(14).fillColor('#000000').text(`Cliente: ${quote.customerName}`);
        doc.fontSize(10).fillColor('#666666')
            .text(`Referência: ${quote.orderNumber}`)
            .text(`Válida até: ${quote.deliveryDate ? new Date(quote.deliveryDate).toLocaleDateString('pt-MZ') : 'N/A'}`);
        
        doc.moveDown(1.5);

        // Linha de Cabeçalho da Tabela
        const tableTop = doc.y;
        doc.fontSize(10).fillColor('#1e40af').font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold')
            .text('Descrição', 50, tableTop)
            .text('Qtd', 350, tableTop, { width: 40, align: 'right' })
            .text('Preço Unit.', 400, tableTop, { width: 70, align: 'right' })
            .text('Total', 480, tableTop, { width: 65, align: 'right' });

        doc.moveDown(0.5);
        doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        
        doc.font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica').fillColor('#000000');

        (quote.items || []).forEach((item) => {
            const currentY = doc.y;
            doc.text(item.productName, 50, currentY, { width: 280 })
                .text(item.quantity.toString(), 350, currentY, { width: 40, align: 'right' })
                .text(this.formatCurrency(item.price), 400, currentY, { width: 70, align: 'right' })
                .text(this.formatCurrency(item.total), 480, currentY, { width: 65, align: 'right' });
            doc.moveDown(0.8);
        });

        doc.moveDown();
        doc.strokeColor('#1e40af').lineWidth(1.5).moveTo(350, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        doc.fontSize(12).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold')
            .text(`TOTAL FINAL: ${this.formatCurrency(quote.total)}`, { align: 'right' });

        if (quote.notes) {
            doc.moveDown(2);
            doc.fontSize(10).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica').fillColor('#666666')
                .text('Observaces / Condições:', { underline: true })
                .text(quote.notes.replace('__QUOTE__', '').trim());
        }
    }

    private addInventoryTableContent(doc: PDFKit.PDFDocument, data: ReportData) {
        doc.fontSize(16).fillColor('#1e40af').text('📋 Inventrio Detalhado de Produtos', { underline: true });
        doc.moveDown();

        const tableTop = doc.y;
        doc.fontSize(9).fillColor('#1e40af').font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold')
            .text('Ref / Código', 50, tableTop, { width: 80 })
            .text('Nome do Produto', 135, tableTop, { width: 220 })
            .text('Cód. Barras', 360, tableTop, { width: 100 })
            .text('Stock', 470, tableTop, { width: 75, align: 'right' });

        doc.moveDown(0.5);
        doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        doc.font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica').fillColor('#000000');

        ((data.products as ProductSummary[]) || []).forEach((p) => {
            if (doc.y > 700) doc.addPage().moveDown(2); // Auto-pagination

            const currentY = doc.y;
            doc.fontSize(8)
                .text(p.code || 'N/A', 50, currentY, { width: 80 })
                .text(p.name, 135, currentY, { width: 220 })
                .text(p.barcode || '---', 360, currentY, { width: 100 })
                .text(String(p.currentStock || 0), 470, currentY, { width: 75, align: 'right' });
            doc.moveDown(0.5);
        });
    }

    private addPriceListContent(doc: PDFKit.PDFDocument, data: ReportData) {
        doc.fontSize(16).fillColor('#1e40af').text('🏷️ Catlogo de Preços Público', { underline: true });
        doc.moveDown();

        const tableTop = doc.y;
        doc.fontSize(10).fillColor('#1e40af').font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold')
            .text('Descrição do Produto', 50, tableTop, { width: 350 })
            .text('Preço Unitrio', 400, tableTop, { width: 145, align: 'right' });

        doc.moveDown(0.5);
        doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        doc.font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica').fillColor('#000000');

        ((data.products as ProductSummary[]) || []).forEach((p) => {
            if (doc.y > 720) doc.addPage().moveDown(2);

            const currentY = doc.y;
            doc.fontSize(10)
                .text(p.name, 50, currentY, { width: 350 })
                .text(this.formatCurrency(Number(p.price)), 400, currentY, { width: 145, align: 'right' });
            doc.moveDown(0.8);
        });
    }

    private addPharmacyInventoryContent(doc: PDFKit.PDFDocument, data: ReportData) {
        doc.fontSize(16).fillColor(this.PHARMACY_COLOR).text('📋 Relatório de Stock Farmacêutico', { underline: true });
        doc.moveDown();

        // Safety Header
        doc.fontSize(9).fillColor('#666666').font('Helvetica-Oblique')
           .text('Aviso: Verifique as datas de validade regularmente para garantir a segurança dos pacientes.', { align: 'center' });
        doc.font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica'); // Reset font
        doc.moveDown();

        const tableTop = doc.y;
        doc.fontSize(9).fillColor(this.PHARMACY_COLOR).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold')
            .text('Medicamento', 50, tableTop, { width: 180 })
            .text('Lote', 240, tableTop, { width: 80 })
            .text('Validade', 330, tableTop, { width: 80 })
            .text('Stock', 420, tableTop, { width: 60, align: 'right' })
            .text('Preço', 490, tableTop, { width: 55, align: 'right' });

        doc.moveDown(0.5);
        doc.strokeColor(this.PHARMACY_COLOR).lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        doc.font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica').fillColor('#000000');

        ((data.products_summary || data.products || []) as ProductSummary[]).forEach((p) => {
            if (doc.y > 720) doc.addPage().moveDown(2);

            const currentY = doc.y;
            const isExpiring = p.daysToExpiry && p.daysToExpiry <= 90;

            doc.fontSize(8)
                .fillColor(isExpiring ? '#dc2626' : '#000000')
                .text(p.name, 50, currentY, { width: 180 })
                .fillColor('#000000')
                .text(p.batchNumber || 'N/A', 240, currentY, { width: 80 })
                .text(p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('pt-MZ') : '---', 330, currentY, { width: 80 })
                .text(String(p.currentStock || 0), 420, currentY, { width: 60, align: 'right' })
                .text(this.formatCurrency(Number(p.price || 0)), 490, currentY, { width: 55, align: 'right' });

            doc.moveDown(0.6);
            doc.strokeColor('#f1f5f9').lineWidth(0.3).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
            doc.moveDown(0.4);
        });
    }

    private addPharmacySaleContent(doc: PDFKit.PDFDocument, data: ReportData) {
        type PharmacySaleData = {
            sale?: PharmacySalePayload;
        } & PharmacySalePayload;
        type PharmacySalePayload = {
            saleNumber?: string;
            createdAt?: string | Date;
            customerName?: string;
            prescription?: { prescriptionNo?: string };
            items?: SaleItem[];
            total: number | string;
        };
        const wrapper = data as PharmacySaleData;

        doc.fontSize(16).fillColor(this.PHARMACY_COLOR).text('💊 Comprovativo de Dispensa', { underline: true });
        doc.moveDown();

        const sale = wrapper.sale || wrapper;
        
        doc.fontSize(10).fillColor('#000000');
        doc.text(`Venda Nº: ${sale.saleNumber}`, { continued: true });
        doc.text(` | Data: ${sale.createdAt ? new Date(sale.createdAt).toLocaleString('pt-MZ') : ''}`, { align: 'right' });
        doc.text(`Paciente: ${sale.customerName || 'Cliente Balcão'}`);
        if (sale.prescription?.prescriptionNo) {
            doc.fillColor(this.PHARMACY_COLOR).text(`Receita: ${sale.prescription.prescriptionNo}`);
        }
        doc.moveDown();

        const tableTop = doc.y;
        doc.fontSize(9).fillColor(this.PHARMACY_COLOR).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold')
            .text('Medicamento / Lote', 50, tableTop, { width: 250 })
            .text('Qtd', 310, tableTop, { width: 40, align: 'right' })
            .text('Unit.', 360, tableTop, { width: 80, align: 'right' })
            .text('Subtotal', 450, tableTop, { width: 95, align: 'right' });

        doc.moveDown(0.5);
        doc.strokeColor(this.PHARMACY_COLOR).lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);

        doc.font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica').fillColor('#000000');

        (sale.items || []).forEach((item) => {
            const currentY = doc.y;
            doc.fontSize(9).text(`${item.productName} \nLote: ${item.batch?.batchNumber || 'N/A'}`, 50, currentY, { width: 250 });
            doc.text(String(item.quantity), 310, currentY, { width: 40, align: 'right' });
            doc.text(this.formatCurrency(item.unitPrice), 360, currentY, { width: 80, align: 'right' });
            doc.text(this.formatCurrency(item.total), 450, currentY, { width: 95, align: 'right' });
            
            if (item.posologyLabel) {
                doc.moveDown(1.5);
                doc.fontSize(8).fillColor(this.PHARMACY_COLOR).font('Helvetica-Oblique').text(`Posologia: ${item.posologyLabel}`, 60);
                doc.font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica'); // Reset font
            }
            doc.moveDown(1);
        });

        doc.moveDown();
        doc.strokeColor(this.PHARMACY_COLOR).lineWidth(1.5).moveTo(350, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fontSize(14).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold')
           .text(`TOTAL: ${this.formatCurrency(Number(sale.total))}`, { align: 'right' });

        doc.moveDown(3);
        doc.fontSize(8).fillColor('#999999').text('Este documento serve apenas como comprovativo de dispensa farmacêutica.', { align: 'center' });
    }

    private addGenericContent(doc: PDFKit.PDFDocument, data: ReportData) {
        doc.fontSize(12).fillColor('#000000');
        doc.text(JSON.stringify(data, null, 2));
    }

    private formatCurrency(value: number): string {
        return new Intl.NumberFormat('pt-MZ', {
            style: 'currency',
            currency: 'MZN',
            minimumFractionDigits: 2
        }).format(value);
    }

    /**
     * Gera PDF de uma Fatura -- retorna Buffer pronto para HTTP
     */
    async generateInvoicePDF(invoice: InvoicePayload, company: CompanyInfo): Promise<Buffer> {
        const isPharmacy = invoice.originModule === 'pharmacy' || invoice.saleNumber?.startsWith('PH-');
        const themeColor = isPharmacy ? this.PHARMACY_COLOR : this.PRIMARY_BLUE;

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, size: 'A4' });
                
                this.setupFont(doc);
                
                const chunks: Buffer[] = [];
                doc.on('data', (chunk: Buffer) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                const ivaRate = Number(company?.ivaRate ?? 16);
                const formatN = (v: number) => this.formatCurrency(v);
                const gray = '#64748b';
                const black = '#1a1a1a';

                // ── CABEÇALHO ──────────────────────────────────────────────
                if (isPharmacy) {
                    this.drawMedicalCross(doc, 520, 60, 40);
                }

                doc.fontSize(20).fillColor(themeColor)
                    .text(company?.tradeName || company?.companyName || 'Empresa', 50, 50);
                doc.fontSize(9).fillColor(gray)
                    .text(company?.address || '', 50)
                    .text(`NUIT: ${company?.taxId || 'N/A'} | Tel: ${company?.phone || 'N/A'}`)
                    .text(company?.email || '');

                // FATURA title (right side)
                doc.fontSize(24).fillColor(black)
                    .text('FATURA', 400, 50, { align: 'right', width: 145 });
                doc.fontSize(10).fillColor(gray)
                    .text(invoice.invoiceNumber, 400, 82, { align: 'right', width: 145 });
                if (invoice.orderNumber) {
                    doc.fontSize(8).text(`Ref: ${invoice.orderNumber}`, 400, 97, { align: 'right', width: 145 });
                }

                // Linha separadora
                doc.moveDown(0.5);
                const lineY = doc.y + 4;
                doc.strokeColor('#1a1a1a').lineWidth(1.5)
                    .moveTo(50, lineY).lineTo(545, lineY).stroke();

                // ── DADOS CLIENTE / DATAS ──────────────────────────────────
                const colY = lineY + 14;
                doc.fontSize(7).fillColor(gray).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold')
                    .text('DADOS DO CLIENTE', 50, colY).text('INFORMAÇÕES GERAIS', 320, colY);
                
                if (fs.existsSync(this.primaryFont)) {
                    doc.font(this.primaryFont);
                } else {
                    doc.font('Helvetica');
                }

                const fmt = (d: string | Date) => {
                    try { return new Date(d).toLocaleDateString('pt-MZ'); } catch { return String(d); }
                };

                const clientY = colY + 12;
                doc.fontSize(9).fillColor(black)
                    .text(`Nome: ${invoice.customerName}`, 50, clientY)
                    .text(`Tel: ${invoice.customerPhone || '-'}`, 50)
                    .text(`Email: ${invoice.customerEmail || '-'}`, 50)
                    .text(`NUIT: ${invoice.customerDocument || '-'}`, 50);

                doc.fontSize(9).fillColor(black)
                    .text(`Emissão: ${fmt(invoice.issueDate)}`, 320, clientY)
                    .text(`Vencimento: ${fmt(invoice.dueDate)}`, 320)
                    .text(`Moeda: MZN`, 320)
                    .text(`Estado: ${invoice.status?.toUpperCase() || 'EMITIDA'}`, 320);

                // ── TABELA DE ITENS ────────────────────────────────────────
                doc.moveDown(1);
                const tableY = doc.y;
                doc.fillColor('#f8fafc').rect(50, tableY, 495, 18).fill();
                doc.fontSize(8).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold').fillColor(black)
                    .text('Descrição', 56, tableY + 5)
                    .text(isPharmacy ? 'Lote/Val.' : '', 240, tableY + 5, { width: 90 })
                    .text('Qtd', 340, tableY + 5, { width: 40, align: 'right' })
                    .text('V. Unit.', 385, tableY + 5, { width: 60, align: 'right' })
                    .text('Total', 450, tableY + 5, { width: 90, align: 'right' });

                doc.strokeColor(themeColor).lineWidth(1)
                    .moveTo(50, tableY + 18).lineTo(545, tableY + 18).stroke();

                if (fs.existsSync(this.primaryFont)) {
                    doc.font(this.primaryFont);
                } else {
                    doc.font('Helvetica');
                }
                
                let rowY = tableY + 22;
                for (const item of (invoice.items || [])) {
                    const itemName = item.description || item.productName || '-';
                    const batchInfo = isPharmacy && item.batch ? 
                        `${item.batch.batchNumber || 'N/A'} \nExp: ${item.batch.expiryDate ? new Date(item.batch.expiryDate).toLocaleDateString('pt-MZ') : '-'}` : '';

                    doc.fontSize(9).fillColor(black)
                        .text(itemName, 56, rowY, { width: 180 })
                        .fontSize(7).fillColor(gray).text(batchInfo, 240, rowY, { width: 90 })
                        .fontSize(9).fillColor(black)
                        .text(formatQuantity(Number(item.quantity), item.product?.unit || 'un'), 340, rowY, { width: 40, align: 'right' })
                        .text(formatN(Number(item.unitPrice)) + (item.product?.unit ? `/${unitAbbrev(item.product.unit)}` : ''), 385, rowY, { width: 60, align: 'right' })
                        .text(formatN(Number(item.total)), 450, rowY, { width: 90, align: 'right' });
                    
                    // Posology if pharmacy
                    if (isPharmacy && item.posologyLabel) {
                        rowY += 14;
                        doc.fontSize(7).fillColor(themeColor).font('Helvetica-Oblique')
                           .text(`Modo de uso: ${item.posologyLabel}`, 65, rowY);
                        doc.font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica'); // Reset font
                    }

                    rowY += 18;
                    doc.strokeColor('#f1f5f9').lineWidth(0.3)
                        .moveTo(50, rowY - 2).lineTo(545, rowY - 2).stroke();
                }

                // ── TOTAIS ────────────────────────────────────────────────
                const totY = rowY + 10;
                doc.strokeColor(themeColor).lineWidth(1)
                    .moveTo(360, totY).lineTo(545, totY).stroke();

                const subtotal = Number(invoice.subtotal);
                const discount = Number(invoice.discount ?? 0);
                const tax = Number(invoice.tax);
                const total = Number(invoice.total);
                const amountPaid = Number(invoice.amountPaid ?? 0);
                const amountDue = Number(invoice.amountDue ?? 0);

                let ty = totY + 8;
                const totRow = (label: string, value: string, bold = false) => {
                    doc.fontSize(9).font(bold ? (fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold') : (fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica')).fillColor(black)
                        .text(label, 360, ty, { width: 100 })
                        .text(value, 460, ty, { width: 85, align: 'right' });
                    ty += 14;
                };

                totRow('Subtotal:', formatN(subtotal));
                if (discount > 0) totRow('Desconto:', `-${formatN(discount)}`);
                totRow(`IVA (${ivaRate}%):`, formatN(tax));
                doc.strokeColor('#1a1a1a').lineWidth(0.8)
                    .moveTo(360, ty).lineTo(545, ty).stroke();
                ty += 4;
                totRow('TOTAL A PAGAR:', formatN(total), true);
                if (amountPaid > 0) totRow('Total Pago:', formatN(amountPaid));
                if (amountDue > 0) {
                    doc.fillColor('#dc2626');
                    totRow('Saldo Pendente:', formatN(amountDue), true);
                }

                // ── DADOS BANCÁRIOS ────────────────────────────────────────
                const banks = Array.isArray(company?.bankAccounts)
                    ? (company!.bankAccounts as Array<{ bankName?: unknown; accountNumber?: unknown; nib?: unknown }>)
                    : [];
                if (banks.length > 0) {
                    doc.moveDown(1.5);
                    doc.fontSize(8).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold').fillColor(gray)
                        .text('DADOS BANCÁRIOS', 50);

                    if (fs.existsSync(this.primaryFont)) {
                        doc.font(this.primaryFont);
                    } else {
                        doc.font('Helvetica');
                    }

                    for (const bank of banks) {
                        const bankName = String(bank?.bankName ?? '');
                        const accountNumber = String(bank?.accountNumber ?? '');
                        const nib = bank?.nib ? String(bank.nib) : '';
                        doc.fontSize(8).fillColor(black)
                            .text(`${bankName} | Conta: ${accountNumber}${nib ? ` | NIB: ${nib}` : ''}`, 50);
                    }
                }

                // ── OBSERVAÇÕES ────────────────────────────────────────────
                if (invoice.notes) {
                    doc.moveDown(0.5);
                    doc.fontSize(8).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold').fillColor(gray).text('OBSERVAÇÕES', 50);
                    
                    if (fs.existsSync(this.primaryFont)) {
                        doc.font(this.primaryFont);
                    } else {
                        doc.font('Helvetica');
                    }
                    
                    doc.fontSize(8).fillColor(black).text(invoice.notes, 50);
                }

                // ── ASSINATURAS ────────────────────────────────────────────
                const sigY = 720;
                doc.fontSize(8).fillColor(gray)
                    .text('_______________________________', 50, sigY)
                    .text('Emitido por', 50, sigY + 10)
                    .text('_______________________________', 320, sigY)
                    .text('Recebido por', 320, sigY + 10);

                // ── RODAPÉ ────────────────────────────────────────────────
                doc.fontSize(7).fillColor('#9ca3af')
                    .text(`Documento gerado automaticamente em ${new Date().toLocaleString('pt-MZ')}`, 50, 780, { align: 'center', width: 495 });

                doc.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Gera PDF de uma Nota de Crédito ou Nota de Débito.
     * Layout partilhado: muda só cor do tema, etiqueta do documento e do total.
     */
    async generateNotePDF(
        note: {
            number: string;
            originalInvoiceNumber?: string | null;
            customerName: string;
            customerId?: string | null;
            customerPhone?: string | null;
            customerEmail?: string | null;
            issueDate: string | Date;
            status?: string | null;
            reason: string;
            items: Array<{ description: string; quantity: number | Prisma.Decimal; unitPrice: Money; total: Money }>;
            subtotal: Money;
            tax: Money;
            total: Money;
            notes?: string | null;
        },
        type: 'credit' | 'debit',
        company: CompanyInfo,
    ): Promise<Buffer> {
        const isCredit = type === 'credit';
        const themeColor = isCredit ? '#b91c1c' : '#b45309';
        const themeBg = isCredit ? '#fee2e2' : '#fef3c7';
        const docLabel = isCredit ? 'NOTA DE CRÉDITO' : 'NOTA DE DÉBITO';
        const totalLabel = isCredit ? 'TOTAL REEMBOLSADO' : 'TOTAL ADICIONAL';
        const signSymbol = isCredit ? '-' : '+';

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, size: 'A4' });
                this.setupFont(doc);

                const chunks: Buffer[] = [];
                doc.on('data', (chunk: Buffer) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                const ivaRate = Number(company?.ivaRate ?? 16);
                const formatN = (v: number) => this.formatCurrency(v);
                const gray = '#64748b';
                const black = '#1a1a1a';
                const fmt = (d: string | Date) => {
                    try { return new Date(d).toLocaleDateString('pt-MZ'); } catch { return String(d); }
                };

                // Cabeçalho — empresa
                doc.fontSize(20).fillColor(themeColor)
                    .text(company?.tradeName || company?.companyName || 'Empresa', 50, 50);
                doc.fontSize(9).fillColor(gray)
                    .text(company?.address || '', 50)
                    .text(`NUIT: ${company?.taxId || 'N/A'} | Tel: ${company?.phone || 'N/A'}`)
                    .text(company?.email || '');

                // Etiqueta + número (direita)
                doc.fillColor(themeBg).rect(400, 50, 145, 18).fill();
                doc.fontSize(9).fillColor(themeColor)
                    .text(docLabel, 400, 55, { align: 'center', width: 145 });
                doc.fontSize(20).fillColor(black)
                    .text(note.number, 400, 72, { align: 'right', width: 145 });
                if (note.originalInvoiceNumber) {
                    doc.fontSize(8).fillColor(gray)
                        .text(`Ref. Fatura: ${note.originalInvoiceNumber}`, 400, 96, { align: 'right', width: 145 });
                }

                // Linha separadora
                doc.moveDown(0.5);
                const lineY = doc.y + 4;
                doc.strokeColor('#1a1a1a').lineWidth(1.5).moveTo(50, lineY).lineTo(545, lineY).stroke();

                // Dados do cliente / detalhes
                const colY = lineY + 14;
                doc.fontSize(7).fillColor(gray).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold')
                    .text('DADOS DO CLIENTE', 50, colY)
                    .text('DETALHES DA EMISSÃO', 320, colY);
                if (fs.existsSync(this.primaryFont)) doc.font(this.primaryFont); else doc.font('Helvetica');

                const clientY = colY + 12;
                doc.fontSize(9).fillColor(black)
                    .text(`Nome: ${note.customerName}`, 50, clientY)
                    .text(`Tel: ${note.customerPhone || '-'}`, 50)
                    .text(`Email: ${note.customerEmail || '-'}`, 50);

                doc.fontSize(9).fillColor(black)
                    .text(`Data: ${fmt(note.issueDate)}`, 320, clientY)
                    .text(`Estado: ${(note.status || 'emitida').toUpperCase()}`, 320)
                    .text(`Motivo: ${note.reason}`, 320, undefined, { width: 220 });

                // Tabela de itens
                doc.moveDown(1.5);
                const tableY = doc.y;
                doc.fillColor('#f8fafc').rect(50, tableY, 495, 18).fill();
                doc.fontSize(8).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold').fillColor(black)
                    .text('Descrição', 56, tableY + 5)
                    .text('Qtd', 340, tableY + 5, { width: 40, align: 'right' })
                    .text('V. Unit.', 385, tableY + 5, { width: 60, align: 'right' })
                    .text('Total', 450, tableY + 5, { width: 90, align: 'right' });

                doc.strokeColor(themeColor).lineWidth(1)
                    .moveTo(50, tableY + 18).lineTo(545, tableY + 18).stroke();

                if (fs.existsSync(this.primaryFont)) doc.font(this.primaryFont); else doc.font('Helvetica');

                let rowY = tableY + 22;
                for (const item of note.items || []) {
                    if (rowY > 680) { doc.addPage(); rowY = 60; }
                    doc.fontSize(9).fillColor(black)
                        .text(item.description, 56, rowY, { width: 280 })
                        .text(formatQuantity(Number(item.quantity), (item as any).product?.unit || 'un'), 340, rowY, { width: 40, align: 'right' })
                        .text(formatN(Number(item.unitPrice)) + ((item as any).product?.unit ? `/${unitAbbrev((item as any).product.unit)}` : ''), 385, rowY, { width: 60, align: 'right' })
                        .text(formatN(Number(item.total)), 450, rowY, { width: 90, align: 'right' });
                    rowY += 18;
                    doc.strokeColor('#f1f5f9').lineWidth(0.3)
                        .moveTo(50, rowY - 2).lineTo(545, rowY - 2).stroke();
                }

                // Totais
                const totY = rowY + 10;
                doc.strokeColor(themeColor).lineWidth(1).moveTo(360, totY).lineTo(545, totY).stroke();

                const subtotal = Number(note.subtotal);
                const tax = Number(note.tax);
                const total = Number(note.total);

                let ty = totY + 8;
                const totRow = (label: string, value: string, bold = false, color = black) => {
                    doc.fontSize(9)
                        .font(bold ? (fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold') : (fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica'))
                        .fillColor(color)
                        .text(label, 360, ty, { width: 100 })
                        .text(value, 460, ty, { width: 85, align: 'right' });
                    ty += 14;
                };

                totRow('Subtotal:', formatN(subtotal));
                totRow(`IVA (${ivaRate}%):`, formatN(tax));
                doc.strokeColor('#1a1a1a').lineWidth(0.8).moveTo(360, ty).lineTo(545, ty).stroke();
                ty += 4;
                totRow(`${totalLabel}:`, `${signSymbol}${formatN(total)}`, true, themeColor);

                // Observações
                if (note.notes) {
                    doc.moveDown(2);
                    doc.fontSize(8).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold').fillColor(gray).text('OBSERVAÇÕES', 50);
                    if (fs.existsSync(this.primaryFont)) doc.font(this.primaryFont); else doc.font('Helvetica');
                    doc.fontSize(8).fillColor(black).text(note.notes, 50);
                }

                // Assinaturas + rodapé
                const sigY = 720;
                doc.fontSize(8).fillColor(gray)
                    .text('_______________________________', 50, sigY)
                    .text('Responsável', 50, sigY + 10)
                    .text('_______________________________', 320, sigY)
                    .text('Cliente', 320, sigY + 10);

                doc.fontSize(7).fillColor('#9ca3af')
                    .text(`Documento gerado automaticamente em ${new Date().toLocaleString('pt-MZ')}`, 50, 780, { align: 'center', width: 495 });

                doc.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Limpa relatórios antigos (mais de 7 dias)
     */
    async cleanOldReports(): Promise<number> {
        try {
            const files = fs.readdirSync(this.uploadsDir);
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            let deletedCount = 0;

            files.forEach(file => {
                const filepath = path.join(this.uploadsDir, file);
                const stats = fs.statSync(filepath);

                if (stats.mtimeMs < sevenDaysAgo) {
                    fs.unlinkSync(filepath);
                    deletedCount++;
                }
            });

            logger.info(`Cleaned ${deletedCount} old reports`);
            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning old reports:', error);
            return 0;
        }
    }
}

export const pdfService = new PDFService();
