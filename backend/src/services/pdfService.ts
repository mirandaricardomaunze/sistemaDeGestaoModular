import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export class PDFService {
    private uploadsDir = path.join(__dirname, '../../uploads/reports');

    constructor() {
        // Criar diretório se não existir
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
            logger.info('Created uploads/reports directory');
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
                const stream = fs.createWriteStream(filepath);

                doc.pipe(stream);

                // Header com Informações da Empresa
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
            inventory: 'Inventário',
            financial: 'Financeiro',
            customers: 'Clientes',
            daily: 'Diário',
            weekly: 'Semanal',
            monthly: 'Mensal',
            yearly: 'Anual'
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
            { label: 'Número de Transações', value: (data.count || 0).toString() },
            { label: 'Ticket Médio', value: this.formatCurrency(data.average || 0) }
        ];

        metrics.forEach(metric => {
            doc.fontSize(11).fillColor('#666666').text(metric.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${metric.value}`, { align: 'right' });
        });

        doc.moveDown(2);

        // Últimas vendas
        if (data.sales && data.sales.length > 0) {
            doc.fontSize(14).fillColor('#1e40af').text('Últimas Transações:', { underline: true });
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
            .text('📦 Resumo de Inventário', { underline: true });
        doc.moveDown();

        doc.fontSize(12).fillColor('#000000');

        const metrics = [
            { label: 'Total de Produtos', value: (data.totalProducts || 0).toString() },
            { label: 'Produtos com Stock Baixo', value: (data.lowStockCount || 0).toString() },
            { label: 'Valor Total em Stock', value: this.formatCurrency(data.totalValue || 0) }
        ];

        metrics.forEach(metric => {
            doc.fontSize(11).fillColor('#666666').text(metric.label, { continued: true });
            doc.fontSize(12).fillColor('#000000').text(`: ${metric.value}`, { align: 'right' });
        });

        doc.moveDown(2);

        if (data.lowStockProducts && data.lowStockProducts.length > 0) {
            doc.fontSize(14).fillColor('#dc2626').text('âš ï¸ Produtos com Stock Crítico:', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#000000');

            data.lowStockProducts.forEach((product: any) => {
                doc.text(
                    `• ${product.name} - ` +
                    `Stock Atual: ${product.currentStock} | ` +
                    `Mínimo: ${product.minStock} | ` +
                    `Preço: ${this.formatCurrency(product.price)}`
                );
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
            { label: 'Número de Transações', value: (data.transactions || 0).toString() },
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
