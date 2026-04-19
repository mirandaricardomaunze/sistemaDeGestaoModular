import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export class PDFService {
    private uploadsDir = path.join(__dirname, '../../uploads/reports');
    // Fonte Arial do Windows para suporte a UTF-8 (acentuação em Português)
    private primaryFont = 'C:\\Windows\\Fonts\\arial.ttf';

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
    async generateReport(data: any, type: string, companyInfo?: any): Promise<string> {
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
            quotation: 'Cotação / Orçamento',
            inventory_table: 'Tabela Geral de Inventrio',
            price_list: 'Catlogo de Preços'
        };
        return names[type] || type;
    }

    private addContentByType(doc: PDFKit.PDFDocument, data: any, type: string) {
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
            default:
                this.addGenericContent(doc, data);
        }
    }

    private addSalesContent(doc: PDFKit.PDFDocument, data: any) {
        doc.fontSize(16)
            .fillColor('#1e40af')
            .text('📊 Resumo de Vendas', { underline: true });
        doc.moveDown();

        // Métricas principais
        doc.fontSize(12).fillColor('#000000');

        const metrics = [
            { label: 'Total de Vendas', value: this.formatCurrency(data.total || 0) },
            { label: 'Número de Transaces', value: (data.count || 0).toString() },
            { label: 'Ticket Médio', value: this.formatCurrency(data.average || 0) }
        ];

        metrics.forEach(metric => {
            doc.fontSize(11).fillColor('#666666').text(metric.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${metric.value}`, { align: 'right' });
        });

        doc.moveDown(2);

        // Últimas vendas
        if (data.sales && data.sales.length > 0) {
            doc.fontSize(14).fillColor('#1e40af').text('Últimas Transaces:', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#000000');

            data.sales.slice(0, 10).forEach((sale: any, index: number) => {
                const date = new Date(sale.createdAt).toLocaleDateString('pt-MZ');
                doc.text(
                    `${index + 1}. Recibo: ${sale.receiptNumber || 'N/A'} | ` +
                    `Data: ${date} | ` +
                    `Total: ${this.formatCurrency(sale.total)}`
                );
            });
        }
    }

    private addInventoryContent(doc: PDFKit.PDFDocument, data: any) {
        doc.fontSize(16)
            .fillColor('#1e40af')
            .text('📦 Resumo de Inventrio', { underline: true });
        doc.moveDown();

        doc.fontSize(12).fillColor('#000000');

        const metrics = [
            { label: 'Total de Produtos em Stock', value: (data.totalProducts || 0).toString() },
            { label: 'Produtos com Stock Crítico', value: (data.lowStockCount || 0).toString() },
            { label: 'Custo Total do Inventrio', value: this.formatCurrency(data.totalCost || 0) },
            { label: 'Valor de Venda Potencial', value: this.formatCurrency(data.totalValue || 0) },
            { label: 'Lucro Bruto Potencial', value: this.formatCurrency(data.potentialProfit || 0) }
        ];

        metrics.forEach(metric => {
            doc.fontSize(11).fillColor('#666666').text(metric.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${metric.value}`, { align: 'right' });
        });

        doc.moveDown(2);

        // Top Moving Products
        if (data.topMovingProducts && data.topMovingProducts.length > 0) {
            doc.fontSize(14).fillColor('#1e40af').text('📈 Produtos com Maior Giro (Últimos 30 dias):', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#000000');

            data.topMovingProducts.forEach((p: any) => {
                doc.text(`• ${p.name} - Vendas: ${p.salesLast30Days} unid. | Stock Atual: ${p.stock}`);
            });
            doc.moveDown(2);
        }

        if (data.lowStockProducts && data.lowStockProducts.length > 0) {
            doc.fontSize(14).fillColor('#dc2626').text('⚠️ Produtos com Stock Crítico:', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#000000');

            data.lowStockProducts.forEach((product: any) => {
                doc.text(
                    `• ${product.name} (Ref: ${product.code || 'N/A'}${product.barcode ? ` | EAN: ${product.barcode}` : ''})`
                );
                doc.fontSize(9).fillColor('#666666').text(
                    `Stock Atual: ${product.currentStock} | Mínimo: ${product.minStock} | Preço: ${this.formatCurrency(product.price)}`,
                    { indent: 10 }
                );
                doc.fontSize(10).fillColor('#000000');
                doc.moveDown(0.2);
            });
        }
    }

    private addFinancialContent(doc: PDFKit.PDFDocument, data: any) {
        doc.fontSize(16)
            .fillColor('#1e40af')
            .text('💰 Resumo Financeiro', { underline: true });
        doc.moveDown();

        doc.fontSize(12).fillColor('#000000');

        const metrics = [
            { label: 'Receita Total', value: this.formatCurrency(data.revenue || 0) },
            { label: 'Número de Transaces', value: (data.transactions || 0).toString() },
            { label: 'Ticket Médio', value: this.formatCurrency(data.averageTicket || 0) }
        ];

        metrics.forEach(metric => {
            doc.fontSize(11).fillColor('#666666').text(metric.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${metric.value}`, { align: 'right' });
        });
    }

    private addCustomersContent(doc: PDFKit.PDFDocument, data: any) {
        doc.fontSize(16)
            .fillColor('#1e40af')
            .text('👥 Resumo de Clientes', { underline: true });
        doc.moveDown();

        doc.fontSize(12).fillColor('#000000');

        const metrics = [
            { label: 'Total de Clientes', value: (data.total || 0).toString() },
            { label: 'Clientes Ativos', value: (data.active || 0).toString() }
        ];

        metrics.forEach(metric => {
            doc.fontSize(11).fillColor('#666666').text(metric.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${metric.value}`, { align: 'right' });
        });

        doc.moveDown(2);

        if (data.customers && data.customers.length > 0) {
            doc.fontSize(14).fillColor('#1e40af').text('Lista de Clientes:', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#000000');

            data.customers.slice(0, 20).forEach((customer: any, index: number) => {
                doc.text(`${index + 1}. ${customer.name} - ${customer.email || customer.phone || 'Sem contacto'}`);
            });
        }
    }

    private addOrderCancellationContent(doc: PDFKit.PDFDocument, data: any) {
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

        if (data.items && data.items.length > 0) {
            doc.fontSize(14).fillColor('#1e40af').text('Itens Cancelados (Stock Restituído):', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#000000');

            data.items.forEach((item: any, index: number) => {
                doc.text(
                    `• ${item.quantity}x ${item.productName} - ` +
                    `Total: ${this.formatCurrency(item.total)}`
                );
            });

            doc.moveDown();
            doc.fontSize(12).fillColor('#000000').text(`Valor Total Cancelado: ${this.formatCurrency(data.total)}`, { align: 'right' });
        }

        doc.moveDown(2);
        doc.fontSize(10).fillColor('#999999').text('Este comprovativo atesta que a encomenda descrita foi cancelada e o respetivo stock reservado foi devidamente libertado.', { align: 'center' });
    }

    private addHRContent(doc: PDFKit.PDFDocument, data: any) {
        doc.fontSize(16)
            .fillColor('#1e40af')
            .text('👥 Resumo de Recursos Humanos', { underline: true });
        doc.moveDown();

        // 1. Quadro de Pessoal
        doc.fontSize(14).fillColor('#1e40af').text('Quadro de Pessoal:');
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor('#000000');
        
        const staffMetrics = [
            { label: 'Colaboradores Ativos', value: (data.employees?.active || 0).toString() },
            { label: 'Total de Registros', value: (data.employees?.total || 0).toString() },
            { label: 'Taxa de Ocupação', value: data.employees?.total > 0 ? `${((data.employees.active / data.employees.total) * 100).toFixed(1)}%` : '0%' }
        ];

        staffMetrics.forEach(m => {
            doc.fontSize(11).fillColor('#666666').text(m.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${m.value}`, { align: 'right' });
        });

        doc.moveDown(1.5);

        // 2. Resumo Financeiro (Folha de Pagamento)
        doc.fontSize(14).fillColor('#1e40af').text(`Folha de Pagamento (${data.payroll?.month}/${data.payroll?.year}):`);
        doc.moveDown(0.5);

        const payrollMetrics = [
            { label: 'Vencimentos Brutos', value: this.formatCurrency(data.payroll?.total_earnings || 0) },
            { label: 'Total de Descontos', value: this.formatCurrency(data.payroll?.total_deductions || 0) },
            { label: 'Salário Líquido Total', value: this.formatCurrency(data.payroll?.total_net || 0), bold: true }
        ];

        payrollMetrics.forEach(m => {
            doc.fontSize(11).fillColor('#666666').text(m.label, { continued: true });
            doc.fontSize(12).fillColor(m.bold ? '#1e40af' : '#000000').text(`: ${m.value}`, { align: 'right' });
        });

        doc.moveDown(1.5);

        // 3. Gestão de Férias e Ausências
        doc.fontSize(14).fillColor('#1e40af').text('Férias e Ausências:');
        doc.moveDown(0.5);
        
        doc.fontSize(11).fillColor('#666666').text('Pedidos de Férias Pendentes', { continued: true });
        doc.fontSize(12).fillColor(data.vacations?.pending > 0 ? '#dc2626' : '#000000').text(`: ${data.vacations?.pending || 0}`, { align: 'right' });

        doc.moveDown(2);
        doc.fontSize(10).fillColor('#999999').text('Este relatório contém dados agregados para análise executiva da gestão de capital humano.', { align: 'center' });
    }

    private addQuotationContent(doc: PDFKit.PDFDocument, data: any) {
        if (!data.quote) return;
        const quote = data.quote;

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

        (quote.items || []).forEach((item: any) => {
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

    private addInventoryTableContent(doc: PDFKit.PDFDocument, data: any) {
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

        (data.products || []).forEach((p: any) => {
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

    private addPriceListContent(doc: PDFKit.PDFDocument, data: any) {
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

        (data.products || []).forEach((p: any) => {
            if (doc.y > 720) doc.addPage().moveDown(2);

            const currentY = doc.y;
            doc.fontSize(10)
                .text(p.name, 50, currentY, { width: 350 })
                .text(this.formatCurrency(p.price), 400, currentY, { width: 145, align: 'right' });
            doc.moveDown(0.8);
        });
    }

    private addGenericContent(doc: PDFKit.PDFDocument, data: any) {
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
    async generateInvoicePDF(invoice: any, company: any): Promise<Buffer> {
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
                doc.fontSize(20).fillColor('#1e40af')
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

                const fmt = (d: string) => {
                    try { return new Date(d).toLocaleDateString('pt-MZ'); } catch { return d; }
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
                    .text('Qtd', 340, tableY + 5, { width: 40, align: 'right' })
                    .text('V. Unit.', 385, tableY + 5, { width: 60, align: 'right' })
                    .text('Total', 450, tableY + 5, { width: 90, align: 'right' });

                doc.strokeColor('#e5e7eb').lineWidth(0.5)
                    .moveTo(50, tableY + 18).lineTo(545, tableY + 18).stroke();

                if (fs.existsSync(this.primaryFont)) {
                    doc.font(this.primaryFont);
                } else {
                    doc.font('Helvetica');
                }
                
                let rowY = tableY + 22;
                for (const item of (invoice.items || [])) {
                    doc.fontSize(9).fillColor(black)
                        .text(item.description || item.productName || '-', 56, rowY, { width: 280 })
                        .text(String(item.quantity), 340, rowY, { width: 40, align: 'right' })
                        .text(formatN(Number(item.unitPrice)), 385, rowY, { width: 60, align: 'right' })
                        .text(formatN(Number(item.total)), 450, rowY, { width: 90, align: 'right' });
                    rowY += 18;
                    doc.strokeColor('#f1f5f9').lineWidth(0.3)
                        .moveTo(50, rowY - 2).lineTo(545, rowY - 2).stroke();
                }

                // ── TOTAIS ────────────────────────────────────────────────
                const totY = rowY + 10;
                doc.strokeColor('#1a1a1a').lineWidth(1)
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
                if (company?.bankAccounts?.length > 0) {
                    doc.moveDown(1.5);
                    doc.fontSize(8).font(fs.existsSync(this.primaryFont) ? this.primaryFont : 'Helvetica-Bold').fillColor(gray)
                        .text('DADOS BANCÁRIOS', 50);
                    
                    if (fs.existsSync(this.primaryFont)) {
                        doc.font(this.primaryFont);
                    } else {
                        doc.font('Helvetica');
                    }
                    
                    for (const bank of company.bankAccounts) {
                        doc.fontSize(8).fillColor(black)
                            .text(`${bank.bankName} | Conta: ${bank.accountNumber}${bank.nib ? ` | NIB: ${bank.nib}` : ''}`, 50);
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
