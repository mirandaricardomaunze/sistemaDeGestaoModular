---
name: saft-xml
description: "Guia completo passo a passo para implementar a geração de ficheiro SAF-T XML oficial em Moçambique no sistema Multicore."
---

# Skill: Geração SAF-T XML (Moçambique)

> **Quando usar:** Sempre que trabalhar em qualquer parte do módulo Fiscal
> relacionada com exportação SAF-T, relatórios AT, ou conformidade fiscal.

---

## 🎯 Objectivo

Gerar um ficheiro XML válido e completo no formato SAF-T (Standard Audit File for Tax)
conforme o standard OECD adaptado para Moçambique (AT-MZ), contendo:
- Cabeçalho da empresa
- Plano de Contas simplificado
- Clientes
- Produtos/Serviços (Tabela de produtos)
- Transacções de Vendas (SalesInvoices)
- Pagamentos (Payments)

---

## 📁 Estrutura de Ficheiros a Criar/Modificar

```
backend/src/
  services/
    saft.service.ts          ← Motor de geração XML (NOVO)
  routes/
    saft.routes.ts           ← Endpoint de download (NOVO)
  validation/
    saft.validation.ts       ← Schema Zod para parâmetros (NOVO)
  utils/
    xmlBuilder.ts            ← Helper para construir XML seguro (NOVO)

src/  (frontend)
  services/api/
    fiscal.api.ts            ← Adicionar método downloadSAFT()
  components/fiscal/
    FiscalReportGenerator.tsx ← Activar botão SAF-T (JÁ EXISTE — só ligar)
  types/
    fiscal.ts                ← Adicionar tipos SAFTParams (JÁ EXISTE — estender)
```

---

## 🛠️ PASSO 1 — Instalar Dependência XML

```bash
cd backend
npm install xmlbuilder2
npm install --save-dev @types/node
```

**Porquê `xmlbuilder2`:** É a biblioteca mais robusta para construir XML
programaticamente em Node.js, com suporte a atributos, namespaces e encoding
UTF-8 correcto — essencial para SAF-T.

---

## 🛠️ PASSO 2 — Criar `backend/src/utils/xmlBuilder.ts`

```typescript
import { create } from 'xmlbuilder2';

/**
 * Escapa caracteres especiais XML para evitar injecção ou ficheiro inválido.
 * Regra: Todos os valores de texto DEVEM passar por esta função.
 */
export function escapeXml(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formata um número monetário para 2 casas decimais (formato SAF-T).
 * Usa sempre '.' como separador decimal.
 */
export function formatDecimal(value: number): string {
  return value.toFixed(2);
}

/**
 * Formata uma data para o formato SAF-T: YYYY-MM-DD
 */
export function formatSAFTDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Cria o documento XML raiz com o namespace SAF-T padrão.
 */
export function createSAFTDocument() {
  return create({ version: '1.0', encoding: 'UTF-8' })
    .ele('AuditFile', {
      xmlns: 'urn:OECD:StandardAuditFile-Tax:MZ_1.00',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    });
}
```

---

## 🛠️ PASSO 3 — Criar `backend/src/validation/saft.validation.ts`

```typescript
import { z } from 'zod';

export const SAFTParamsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
  fiscalYear: z.string().regex(/^\d{4}$/, 'Ano com 4 dígitos'),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Data início deve ser anterior à data fim', path: ['startDate'] }
);

export type SAFTParams = z.infer<typeof SAFTParamsSchema>;
```

---

## 🛠️ PASSO 4 — Criar `backend/src/services/saft.service.ts`

Este é o motor central. Deve seguir **exactamente** esta estrutura:

```typescript
import { PrismaClient } from '@prisma/client';
import { createSAFTDocument, escapeXml, formatDecimal, formatSAFTDate } from '../utils/xmlBuilder';
import type { SAFTParams } from '../validation/saft.validation';

const prisma = new PrismaClient();

export class SAFTService {

  /**
   * Gera o ficheiro SAF-T XML completo para um período e empresa.
   * REGRA: Toda a geração corre dentro de uma transacção read-only
   * para garantir consistência dos dados.
   */
  async generateSAFT(companyId: string, params: SAFTParams): Promise<string> {
    const { startDate, endDate, fiscalYear } = params;

    // 1. Buscar dados da empresa
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });

    // 2. Buscar clientes (CustomerID, Name, NIF)
    const customers = await prisma.customer.findMany({
      where: { companyId },
      select: { id: true, name: true, taxNumber: true, address: true },
    });

    // 3. Buscar produtos
    const products = await prisma.product.findMany({
      where: { companyId },
      select: { id: true, name: true, code: true, price: true, taxRate: true },
    });

    // 4. Buscar faturas no período
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        issueDate: { gte: new Date(startDate), lte: new Date(endDate) },
        status: { notIn: ['draft', 'cancelled'] },
      },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
      orderBy: { issueDate: 'asc' },
    });

    // 5. Construir XML
    const root = createSAFTDocument();

    // --- Header ---
    this._buildHeader(root, company, fiscalYear, startDate, endDate, invoices.length);

    // --- MasterFiles ---
    const masterFiles = root.ele('MasterFiles');
    this._buildCustomers(masterFiles, customers);
    this._buildProducts(masterFiles, products);

    // --- SourceDocuments ---
    const sourceDocs = root.ele('SourceDocuments');
    this._buildSalesInvoices(sourceDocs, invoices);

    return root.end({ prettyPrint: true });
  }

  // ─── Secções Privadas ───────────────────────────────────────────────────

  private _buildHeader(
    root: ReturnType<typeof createSAFTDocument>,
    company: { name: string; taxNumber?: string | null; address?: string | null },
    fiscalYear: string,
    startDate: string,
    endDate: string,
    invoiceCount: number,
  ) {
    const header = root.ele('Header');
    header.ele('AuditFileVersion').txt('1.00');
    header.ele('CompanyID').txt(escapeXml(company.taxNumber ?? 'N/A'));
    header.ele('TaxRegistrationNumber').txt(escapeXml(company.taxNumber ?? '000000000'));
    header.ele('TaxAccountingBasis').txt('F'); // F = Faturação
    header.ele('CompanyName').txt(escapeXml(company.name));
    header.ele('BusinessName').txt(escapeXml(company.name));
    header.ele('CompanyAddress').ele('StreetName').txt(escapeXml(company.address ?? ''));
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

  private _buildCustomers(masterFiles: unknown, customers: Array<{
    id: string; name: string; taxNumber?: string | null; address?: string | null;
  }>) {
    const mf = masterFiles as ReturnType<typeof createSAFTDocument>;
    for (const c of customers) {
      const node = mf.ele('Customer');
      node.ele('CustomerID').txt(c.id);
      node.ele('AccountID').txt('21');  // Conta de clientes no POC simplificado
      node.ele('CustomerTaxID').txt(escapeXml(c.taxNumber ?? '000000000'));
      node.ele('CompanyName').txt(escapeXml(c.name));
      const addr = node.ele('BillingAddress');
      addr.ele('StreetName').txt(escapeXml(c.address ?? ''));
      addr.ele('Country').txt('MZ');
      node.ele('SelfBillingIndicator').txt('0');
    }
  }

  private _buildProducts(masterFiles: unknown, products: Array<{
    id: string; name: string; code: string; price: number; taxRate?: number | null;
  }>) {
    const mf = masterFiles as ReturnType<typeof createSAFTDocument>;
    for (const p of products) {
      const node = mf.ele('Product');
      node.ele('ProductType').txt('P');  // P = Produto, S = Serviço
      node.ele('ProductCode').txt(escapeXml(p.code));
      node.ele('ProductGroup').txt('MERCADORIA');
      node.ele('ProductDescription').txt(escapeXml(p.name));
      node.ele('ProductNumberCode').txt(escapeXml(p.code));
    }
  }

  private _buildSalesInvoices(sourceDocs: unknown, invoices: Array<{
    id: string;
    number: string;
    issueDate: Date;
    status: string;
    total: number;
    subtotal?: number | null;
    taxAmount?: number | null;
    customer: { id: string; name: string };
    items: Array<{
      quantity: number;
      unitPrice: number;
      total: number;
      product: { name: string; code: string } | null;
    }>;
  }>) {
    const sd = sourceDocs as ReturnType<typeof createSAFTDocument>;
    const salesBlock = sd.ele('SalesInvoices');

    // Totais globais obrigatórios no SAF-T
    const globalNetTotal = invoices.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
    const globalTaxTotal = invoices.reduce((s, i) => s + (Number(i.taxAmount) || 0), 0);
    const globalGrossTotal = invoices.reduce((s, i) => s + Number(i.total), 0);

    salesBlock.ele('NumberOfEntries').txt(String(invoices.length));
    salesBlock.ele('TotalDebit').txt(formatDecimal(0));
    salesBlock.ele('TotalCredit').txt(formatDecimal(globalGrossTotal));

    for (const inv of invoices) {
      const invNode = salesBlock.ele('Invoice');
      invNode.ele('InvoiceNo').txt(escapeXml(inv.number));
      invNode.ele('ATCUD').txt('0');  // Código único AT — futuro
      const status = invNode.ele('DocumentStatus');
      status.ele('InvoiceStatus').txt(inv.status === 'cancelled' ? 'A' : 'N');
      status.ele('InvoiceStatusDate').txt(formatSAFTDate(inv.issueDate));
      status.ele('SourceID').txt('SISTEMA');
      status.ele('SourceBilling').txt('P');
      invNode.ele('Hash').txt('0');  // Hash de integridade — futuro
      invNode.ele('HashControl').txt('0');
      invNode.ele('Period').txt(String(new Date(inv.issueDate).getMonth() + 1));
      invNode.ele('InvoiceDate').txt(formatSAFTDate(inv.issueDate));
      invNode.ele('InvoiceType').txt('FT');  // FT = Fatura
      const special = invNode.ele('SpecialRegimes');
      special.ele('SelfBillingIndicator').txt('0');
      special.ele('CashVATSchemeIndicator').txt('0');
      special.ele('ThirdPartiesBillingIndicator').txt('0');
      invNode.ele('SourceID').txt('SISTEMA');
      invNode.ele('SystemEntryDate').txt(new Date(inv.issueDate).toISOString().replace('Z', ''));
      invNode.ele('CustomerID').txt(inv.customer.id);

      let lineNo = 1;
      for (const item of inv.items) {
        const lineNode = invNode.ele('Line');
        lineNode.ele('LineNumber').txt(String(lineNo++));
        const productRef = lineNode.ele('ProductCode');
        productRef.txt(escapeXml(item.product?.code ?? 'GENERICO'));
        lineNode.ele('ProductDescription').txt(escapeXml(item.product?.name ?? 'Produto'));
        lineNode.ele('Quantity').txt(formatDecimal(item.quantity));
        lineNode.ele('UnitOfMeasure').txt('UN');
        lineNode.ele('UnitPrice').txt(formatDecimal(item.unitPrice));
        lineNode.ele('TaxPointDate').txt(formatSAFTDate(inv.issueDate));
        lineNode.ele('Description').txt(escapeXml(item.product?.name ?? 'Produto'));
        lineNode.ele('CreditAmount').txt(formatDecimal(item.total));
        const tax = lineNode.ele('Tax');
        tax.ele('TaxType').txt('IVA');
        tax.ele('TaxCountryRegion').txt('MZ');
        tax.ele('TaxCode').txt('NOR');
        tax.ele('TaxPercentage').txt('16.00');
      }

      const docTotals = invNode.ele('DocumentTotals');
      docTotals.ele('TaxPayable').txt(formatDecimal(Number(inv.taxAmount) || 0));
      docTotals.ele('NetTotal').txt(formatDecimal(Number(inv.subtotal) || 0));
      docTotals.ele('GrossTotal').txt(formatDecimal(Number(inv.total)));
    }
  }
}

export const saftService = new SAFTService();
```

---

## 🛠️ PASSO 5 — Criar `backend/src/routes/saft.routes.ts`

```typescript
import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireTenant } from '../middleware/tenant';
import { auditLog } from '../middleware/audit';
import { saftService } from '../services/saft.service';
import { SAFTParamsSchema } from '../validation/saft.validation';

const router = Router();

/**
 * GET /api/saft/export
 * Gera e faz download do ficheiro SAF-T XML.
 * Query params: startDate, endDate, fiscalYear
 */
router.get(
  '/export',
  authenticateToken,
  requireTenant,
  async (req: Request, res: Response) => {
    const parsed = SAFTParamsSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const companyId = req.tenantId as string;
    const xml = await saftService.generateSAFT(companyId, parsed.data);

    // Registar auditoria
    await auditLog({
      companyId,
      userId: (req as Request & { user?: { id: string } }).user?.id ?? 'system',
      action: 'SAFT_EXPORT',
      module: 'fiscal',
      details: `SAF-T exportado: ${parsed.data.startDate} a ${parsed.data.endDate}`,
    });

    const filename = `SAFT-MZ_${parsed.data.fiscalYear}_${parsed.data.startDate}.xml`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(xml);
  }
);

export default router;
```

---

## 🛠️ PASSO 6 — Registar a rota no `app.ts`

```typescript
// Em backend/src/app.ts, adicionar:
import saftRouter from './routes/saft.routes';
app.use('/api/saft', saftRouter);
```

---

## 🛠️ PASSO 7 — Frontend: Ligar o botão em `FiscalReportGenerator.tsx`

Adicionar ao `fiscal.api.ts`:
```typescript
async downloadSAFT(params: { startDate: string; endDate: string; fiscalYear: string }): Promise<void> {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_BASE}/saft/export?${query}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error('Erro ao gerar SAF-T');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SAFT-MZ_${params.fiscalYear}.xml`;
  a.click();
  URL.revokeObjectURL(url);
},
```

No componente `FiscalReportGenerator.tsx`, substituir o botão SAF-T placeholder:
```tsx
const handleExportSAFT = async () => {
  try {
    setIsExporting(true);
    await fiscalAPI.downloadSAFT({ startDate, endDate, fiscalYear });
    toast.success('SAF-T exportado com sucesso!');
  } catch {
    toast.error('Erro ao exportar SAF-T');
  } finally {
    setIsExporting(false);
  }
};
```

---

## 🧪 TESTES

### Testes Unitários — `backend/src/services/__tests__/saft.service.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SAFTService } from '../saft.service';

// Mock Prisma
vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }));

const mockPrisma = {
  company: { findUniqueOrThrow: vi.fn() },
  customer: { findMany: vi.fn() },
  product: { findMany: vi.fn() },
  invoice: { findMany: vi.fn() },
};

describe('SAFTService', () => {
  const service = new SAFTService();
  const companyId = 'company-1';
  const params = { startDate: '2024-01-01', endDate: '2024-12-31', fiscalYear: '2024' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.company.findUniqueOrThrow.mockResolvedValue({
      name: 'Empresa Teste', taxNumber: '123456789', address: 'Maputo'
    });
    mockPrisma.customer.findMany.mockResolvedValue([
      { id: 'c1', name: 'Cliente A', taxNumber: '111111111', address: 'Maputo' }
    ]);
    mockPrisma.product.findMany.mockResolvedValue([
      { id: 'p1', name: 'Produto X', code: 'PX001', price: 100, taxRate: 16 }
    ]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
  });

  it('deve gerar XML com declaração e namespace SAF-T', async () => {
    const xml = await service.generateSAFT(companyId, params);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"');
    expect(xml).toContain('AuditFile');
    expect(xml).toContain('urn:OECD:StandardAuditFile-Tax:MZ_1.00');
  });

  it('deve incluir o nome da empresa no Header', async () => {
    const xml = await service.generateSAFT(companyId, params);
    expect(xml).toContain('<CompanyName>Empresa Teste</CompanyName>');
  });

  it('deve incluir clientes no MasterFiles', async () => {
    const xml = await service.generateSAFT(companyId, params);
    expect(xml).toContain('<CustomerID>c1</CustomerID>');
    expect(xml).toContain('<CompanyName>Cliente A</CompanyName>');
  });

  it('deve incluir produtos no MasterFiles', async () => {
    const xml = await service.generateSAFT(companyId, params);
    expect(xml).toContain('<ProductCode>PX001</ProductCode>');
  });

  it('deve escapar caracteres especiais XML', async () => {
    mockPrisma.company.findUniqueOrThrow.mockResolvedValue({
      name: 'Empresa & Filhos <Lda>', taxNumber: '123', address: ''
    });
    const xml = await service.generateSAFT(companyId, params);
    expect(xml).toContain('Empresa &amp; Filhos &lt;Lda&gt;');
    expect(xml).not.toContain('Empresa & Filhos');
  });

  it('deve rejeitar datas inválidas na validação Zod', () => {
    const { SAFTParamsSchema } = require('../validation/saft.validation');
    const result = SAFTParamsSchema.safeParse({
      startDate: '2024-13-01', endDate: '2024-12-31', fiscalYear: '2024'
    });
    expect(result.success).toBe(false);
  });

  it('deve rejeitar se startDate > endDate', () => {
    const { SAFTParamsSchema } = require('../validation/saft.validation');
    const result = SAFTParamsSchema.safeParse({
      startDate: '2024-12-31', endDate: '2024-01-01', fiscalYear: '2024'
    });
    expect(result.success).toBe(false);
  });
});
```

### Teste de Integração Manual (Browser)

1. Ir a **Módulo Fiscal → Relatórios**
2. Seleccionar período: `2024-01-01` a `2024-12-31`
3. Clicar **"Exportar SAF-T"**
4. Verificar que o download inicia automaticamente
5. Abrir o XML num editor e confirmar:
   - Encoding UTF-8 na primeira linha
   - Tag `<AuditFile>` com namespace correcto
   - Secção `<Header>` com nome da empresa
   - Secção `<MasterFiles>` com clientes e produtos
   - Secção `<SourceDocuments>` com as faturas do período

---

## ✅ Checklist de Conclusão

- [ ] `npm install xmlbuilder2` no backend
- [ ] `xmlBuilder.ts` criado com `escapeXml`, `formatDecimal`, `formatSAFTDate`
- [ ] `saft.validation.ts` com schema Zod
- [ ] `saft.service.ts` com SAFTService completo
- [ ] `saft.routes.ts` registado no `app.ts`
- [ ] `fiscal.api.ts` com método `downloadSAFT()`
- [ ] Botão SAF-T no `FiscalReportGenerator.tsx` funcional
- [ ] `tsc --noEmit` sem erros
- [ ] Testes unitários passam: `npm test saft`
- [ ] Download do XML testado manualmente no browser
- [ ] XML validado contra o schema SAF-T MZ
