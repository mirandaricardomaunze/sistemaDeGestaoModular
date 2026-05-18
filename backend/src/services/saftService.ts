import { prisma } from '../lib/prisma';
import { createSAFTDocument, escapeXml, formatDecimal, formatSAFTDate } from '../utils/xmlBuilder';
import type { SAFTParams } from '../validation/saft.validation';
import { Decimal } from '@prisma/client/runtime/library';

/** Converte Decimal do Prisma ou number para number JS */
function toNum(v: Decimal | number | null | undefined): number {
    if (v === null || v === undefined) return 0;
    if (v instanceof Decimal) return v.toNumber();
    return Number(v);
}

export class SAFTService {

    /**
     * Gera o ficheiro SAF-T XML completo para um período e empresa.
     * Todos os dados são lidos numa única janela temporal para garantir
     * consistência do ficheiro exportado.
     */
    async generateSAFT(companyId: string, params: SAFTParams): Promise<string> {
        const { startDate, endDate, fiscalYear } = params;

        // 1. Dados da empresa
        const company = await prisma.company.findUniqueOrThrow({
            where: { id: companyId },
            select: { name: true, nuit: true, address: true },
        });

        // 2. Clientes
        const customers = await prisma.customer.findMany({
            where: { companyId },
            select: { id: true, name: true, document: true, address: true },
        });

        // 3. Produtos
        const products = await prisma.product.findMany({
            where: { companyId },
            select: { id: true, name: true, code: true, price: true },
        });

        // 4. Faturas no período (excluir rascunhos e canceladas)
        const invoices = await prisma.invoice.findMany({
            where: {
                companyId,
                issueDate: { gte: new Date(startDate), lte: new Date(endDate) },
                status: { notIn: ['draft', 'cancelled'] },
            },
            include: {
                items: {
                    include: {
                        product: { select: { name: true, code: true } },
                    },
                },
                customer: { select: { id: true, name: true } },
            },
            orderBy: { issueDate: 'asc' },
        });

        // 5. Construir o documento XML
        const root = createSAFTDocument();

        this._buildHeader(root, company, fiscalYear, startDate, endDate, invoices.length);

        const masterFiles = root.ele('MasterFiles');
        this._buildCustomers(masterFiles, customers);
        this._buildProducts(masterFiles, products);

        const sourceDocs = root.ele('SourceDocuments');
        this._buildSalesInvoices(sourceDocs, invoices);

        return root.end({ prettyPrint: true });
    }

    // ─── Secções privadas ─────────────────────────────────────────────────────

    private _buildHeader(
        root: ReturnType<typeof createSAFTDocument>,
        company: { name: string; nuit?: string | null; address?: string | null },
        fiscalYear: string,
        startDate: string,
        endDate: string,
        invoiceCount: number,
    ) {
        const header = root.ele('Header');
        header.ele('AuditFileVersion').txt('1.00');
        header.ele('CompanyID').txt(escapeXml(company.nuit ?? 'N/A'));
        header.ele('TaxRegistrationNumber').txt(escapeXml(company.nuit ?? '000000000'));
        header.ele('TaxAccountingBasis').txt('F'); // F = Faturação
        header.ele('CompanyName').txt(escapeXml(company.name));
        header.ele('BusinessName').txt(escapeXml(company.name));
        const addr = header.ele('CompanyAddress');
        addr.ele('StreetName').txt(escapeXml(company.address ?? ''));
        addr.ele('Country').txt('MZ');
        header.ele('FiscalYear').txt(fiscalYear);
        header.ele('StartDate').txt(startDate);
        header.ele('EndDate').txt(endDate);
        header.ele('CurrencyCode').txt('MZN');
        header.ele('DateCreated').txt(formatSAFTDate(new Date()));
        header.ele('TaxEntity').txt('Global');
        header.ele('ProductCompanyTaxID').txt('MULTICORE-ERP');
        header.ele('SoftwareValidationNumber').txt('N/A');
        header.ele('ProductID').txt('Multicore ERP');
        header.ele('ProductVersion').txt('2.0');
        header.ele('NumberOfEntries').txt(String(invoiceCount));
    }

    private _buildCustomers(
        masterFiles: ReturnType<typeof createSAFTDocument>,
        customers: Array<{ id: string; name: string; document?: string | null; address?: string | null }>,
    ) {
        for (const c of customers) {
            const node = masterFiles.ele('Customer');
            node.ele('CustomerID').txt(c.id);
            node.ele('AccountID').txt('31'); // Conta Clientes no SNC-MZ
            node.ele('CustomerTaxID').txt(escapeXml(c.document ?? '000000000'));
            node.ele('CompanyName').txt(escapeXml(c.name));
            const addr = node.ele('BillingAddress');
            addr.ele('StreetName').txt(escapeXml(c.address ?? ''));
            addr.ele('Country').txt('MZ');
            node.ele('SelfBillingIndicator').txt('0');
        }
    }

    private _buildProducts(
        masterFiles: ReturnType<typeof createSAFTDocument>,
        products: Array<{ id: string; name: string; code: string; price: Decimal }>,
    ) {
        for (const p of products) {
            const node = masterFiles.ele('Product');
            node.ele('ProductType').txt('P'); // P = Produto, S = Serviço
            node.ele('ProductCode').txt(escapeXml(p.code));
            node.ele('ProductGroup').txt('MERCADORIA');
            node.ele('ProductDescription').txt(escapeXml(p.name));
            node.ele('ProductNumberCode').txt(escapeXml(p.code));
        }
    }

    private _buildSalesInvoices(
        sourceDocs: ReturnType<typeof createSAFTDocument>,
        invoices: Array<{
            id: string;
            invoiceNumber: string;
            issueDate: Date;
            status: string;
            total: Decimal;
            subtotal: Decimal;
            tax: Decimal;
            customer: { id: string; name: string } | null;
            items: Array<{
                quantity: number;
                unitPrice: Decimal;
                total: Decimal;
                product: { name: string; code: string } | null;
            }>;
        }>,
    ) {
        const salesBlock = sourceDocs.ele('SalesInvoices');
        const globalGrossTotal = invoices.reduce((s, i) => s + toNum(i.total), 0);

        salesBlock.ele('NumberOfEntries').txt(String(invoices.length));
        salesBlock.ele('TotalDebit').txt(formatDecimal(0));
        salesBlock.ele('TotalCredit').txt(formatDecimal(globalGrossTotal));

        for (const inv of invoices) {
            const invNode = salesBlock.ele('Invoice');
            invNode.ele('InvoiceNo').txt(escapeXml(inv.invoiceNumber));
            invNode.ele('ATCUD').txt('0'); // Código único AT — futuro

            const statusNode = invNode.ele('DocumentStatus');
            statusNode.ele('InvoiceStatus').txt(inv.status === 'cancelled' ? 'A' : 'N');
            statusNode.ele('InvoiceStatusDate').txt(formatSAFTDate(inv.issueDate));
            statusNode.ele('SourceID').txt('SISTEMA');
            statusNode.ele('SourceBilling').txt('P');

            invNode.ele('Hash').txt('0');
            invNode.ele('HashControl').txt('0');
            invNode.ele('Period').txt(String(new Date(inv.issueDate).getMonth() + 1));
            invNode.ele('InvoiceDate').txt(formatSAFTDate(inv.issueDate));
            invNode.ele('InvoiceType').txt('FT'); // FT = Fatura

            const special = invNode.ele('SpecialRegimes');
            special.ele('SelfBillingIndicator').txt('0');
            special.ele('CashVATSchemeIndicator').txt('0');
            special.ele('ThirdPartiesBillingIndicator').txt('0');

            invNode.ele('SourceID').txt('SISTEMA');
            invNode.ele('SystemEntryDate').txt(
                new Date(inv.issueDate).toISOString().replace('Z', '')
            );
            invNode.ele('CustomerID').txt(inv.customer?.id ?? 'CONSUMIDOR-FINAL');

            let lineNo = 1;
            for (const item of inv.items) {
                const lineNode = invNode.ele('Line');
                lineNode.ele('LineNumber').txt(String(lineNo++));
                lineNode.ele('ProductCode').txt(escapeXml(item.product?.code ?? 'GENERICO'));
                lineNode.ele('ProductDescription').txt(escapeXml(item.product?.name ?? 'Produto'));
                lineNode.ele('Quantity').txt(formatDecimal(item.quantity));
                lineNode.ele('UnitOfMeasure').txt('UN');
                lineNode.ele('UnitPrice').txt(formatDecimal(toNum(item.unitPrice)));
                lineNode.ele('TaxPointDate').txt(formatSAFTDate(inv.issueDate));
                lineNode.ele('Description').txt(escapeXml(item.product?.name ?? 'Produto'));
                lineNode.ele('CreditAmount').txt(formatDecimal(toNum(item.total)));

                const tax = lineNode.ele('Tax');
                tax.ele('TaxType').txt('IVA');
                tax.ele('TaxCountryRegion').txt('MZ');
                tax.ele('TaxCode').txt('NOR');
                tax.ele('TaxPercentage').txt('16.00');
            }

            const docTotals = invNode.ele('DocumentTotals');
            docTotals.ele('TaxPayable').txt(formatDecimal(toNum(inv.tax)));
            docTotals.ele('NetTotal').txt(formatDecimal(toNum(inv.subtotal)));
            docTotals.ele('GrossTotal').txt(formatDecimal(toNum(inv.total)));
        }
    }
}

export const saftService = new SAFTService();
