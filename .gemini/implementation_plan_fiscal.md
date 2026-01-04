# Plano de Implementação - Módulo de Gestão Fiscal

## Visão Geral
Implementação de um módulo fiscal completo para o ERP, adaptado ao contexto moçambicano, incluindo retenções na fonte, relatórios fiscais, exportação oficial e auditoria.

---

## 1. Tipos e Interfaces (types/fiscal.ts)

### 1.1 Configuração de Impostos
```typescript
- TaxType: 'iva' | 'inss' | 'irt' | 'withholding'
- TaxConfig: { id, type, name, rate, isActive, applicableTo, conditions }
- IRTBracket: { min, max, rate, fixedAmount } // Tabela progressiva IRT
```

### 1.2 Retenções
```typescript
- TaxRetention: { id, type, documentType, documentId, baseAmount, rate, retainedAmount, date }
- RetentionReport: { period, type, totalBase, totalRetained, items }
```

### 1.3 Relatórios Fiscais
```typescript
- FiscalReport: { id, type, period, startDate, endDate, status, data, generatedAt }
- FiscalReportType: 'iva_monthly' | 'inss_monthly' | 'irt_monthly' | 'saft_annual'
```

### 1.4 Auditoria
```typescript
- FiscalAuditLog: { id, action, documentType, documentId, changes, userId, timestamp }
- FiscalDeadline: { id, type, description, dueDate, status, notifiedAt }
```

---

## 2. Estrutura de Ficheiros

```
src/
├── types/
│   └── fiscal.ts                    # Tipos fiscais
├── components/
│   └── fiscal/
│       ├── TaxConfigManager.tsx     # Configuração de impostos
│       ├── RetentionDashboard.tsx   # Dashboard de retenções
│       ├── FiscalReportGenerator.tsx # Geração de relatórios
│       ├── SAFTExporter.tsx         # Exportação SAF-T
│       ├── FiscalAuditLog.tsx       # Logs de auditoria
│       ├── DeadlineAlerts.tsx       # Alertas de prazos
│       └── IRTCalculator.tsx        # Calculadora IRT progressivo
├── pages/
│   └── Fiscal.tsx                   # Página principal do módulo
├── stores/
│   └── useFiscalStore.ts            # Estado global fiscal
└── utils/
    ├── fiscalCalculations.ts        # Cálculos fiscais
    └── saftGenerator.ts             # Gerador SAF-T XML
```

---

## 3. Tabela IRT Moçambique (2024)

| Rendimento Mensal (MZN) | Taxa | Dedução Fixa |
|-------------------------|------|--------------|
| Até 22.780              | 10%  | 0            |
| 22.781 - 42.560         | 15%  | 1.139        |
| 42.561 - 100.800        | 20%  | 3.267        |
| 100.801 - 243.040       | 25%  | 8.307        |
| Acima de 243.040        | 32%  | 25.340       |

---

## 4. Funcionalidades por Fase

### Fase 1: Configuração Base
- [x] Definir tipos TypeScript
- [x] Criar store Zustand para dados fiscais
- [x] Página principal Fiscal.tsx com tabs
- [x] Configurador de impostos (IVA, INSS, IRT)

### Fase 2: Retenções Automáticas
- [ ] Integração com faturas (IVA)
- [ ] Integração com payroll (INSS, IRT)
- [ ] Integração com fornecedores (retenção na fonte)
- [ ] Dashboard de retenções

### Fase 3: Relatórios Fiscais
- [ ] Relatório IVA mensal
- [ ] Relatório INSS mensal
- [ ] Relatório IRT mensal
- [ ] Exportação PDF

### Fase 4: SAF-T e Exportação
- [ ] Gerador XML SAF-T
- [ ] Exportação CSV oficial
- [ ] Validação de campos obrigatórios

### Fase 5: Auditoria e Conformidade
- [ ] Logs de alterações
- [ ] Alertas de prazos
- [ ] Histórico de submissões

---

## 5. Campos Obrigatórios SAF-T

### Cabeçalho
- AuditFileVersion, CompanyID, CompanyName, TaxRegistrationNumber
- FiscalYear, StartDate, EndDate, DateCreated

### Documentos
- InvoiceNo, InvoiceDate, CustomerID, CustomerTaxID
- GrossTotal, NetTotal, TaxPayable

---

## 6. Próximos Passos

1. Criar `types/fiscal.ts` com todas as interfaces
2. Criar `stores/useFiscalStore.ts` 
3. Criar página `Fiscal.tsx` com navegação por tabs
4. Implementar componentes de configuração
5. Implementar cálculos automáticos
6. Implementar exportação SAF-T

---

## 7. Dependências Necessárias (futuro backend)

```bash
npm install xml2js xmlbuilder pdfkit csv-writer
```

Para o frontend atual, usaremos:
- jsPDF (já disponível ou fácil de adicionar)
- Geração XML via string templates
- Exportação CSV via helpers existentes
