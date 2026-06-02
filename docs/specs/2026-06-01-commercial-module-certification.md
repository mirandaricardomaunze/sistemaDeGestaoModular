# Spec: Certificacao do modulo Comercial

- **Status**: implemented
- **Autor**: Miranda Maunze (com assistencia)
- **Data**: 2026-06-01
- **Skill(s) relacionadas**: [[design-system]], [[ui-ux-design]], [[sistema-responsive-ui]], [[spec-driven]], [[test-harness]]

## 1. Contexto

O modulo Comercial concentra fluxos de dinheiro, stock, compras, caixa, cotacoes, relatorios e auditoria. A revisao recente melhorou a UI e a responsividade; esta spec define o gate minimo para aceitar essa camada como profissional sem confundir validacao visual com certificacao transaccional completa.

## 2. Objectivo

Certificar que as paginas e componentes comerciais seguem o design system, que as alteracoes transaccionais recentes tem spec propria, e que os testes novos usam o harness padrao.

## 3. Nao-objectivos

- Migrar todos os testes legados de rota que ja existiam antes desta certificacao.
- Substituir a necessidade de uma BD de teste acessivel para validar fluxos route -> service -> DB.
- Garantir QA visual por screenshot em browsers autenticados; esse passo fica como verificacao manual/complementar.

## 4. Contrato

### 4.1 API

Nenhuma rota nova nesta spec. Alteracoes transaccionais devem ter spec propria; FEFO esta em `docs/specs/2026-06-01-fefo-batch-selection.md`.

### 4.2 Modelo de dados

Nenhuma tabela nova nesta spec. O unico campo novo relacionado ao trabalho recente e `CompanySettings.batchSelectionMode`, coberto pela spec FEFO.

### 4.3 Estado / eventos

Sem eventos Socket.IO novos.

## 5. Regras de negocio

1. Paginas comerciais devem importar primitives de UI via barrel `frontend/src/components/ui`.
2. Nao deve haver HTML interactivo cru em paginas/componentes comerciais (`button`, `input`, `select`, `textarea`), excepto semantica estrutural (`form`, `nav`, `section`).
3. Headers de paginas de dominio devem usar `PageHeader`, salvo telas operacionais de alta densidade como POS quando o header customizado for necessario para velocidade.
4. Tabs e segmentados com labels multiplas devem ter scroll horizontal proprio no mobile.
5. Testes novos de logica comercial que toquem DB devem usar `backend/src/test/` factories/helpers.
6. Specs de dinheiro/stock/fiscal/API devem ficar em `docs/specs/` e apontar para os testes.

## 6. Edge cases

- Tabelas largas em mobile: devem usar `SmartTable`, wrapper com overflow horizontal ou card fallback.
- Acoes longas em headers: devem empilhar no mobile e voltar a largura automatica em `sm`.
- Ambiente sem BD de teste: testes de rota/integração devem ser reportados como bloqueados por ambiente, nao como aprovados.
- Testes legados com `deleteMany`: devem ser tratados como divida tecnica ate migracao gradual para harness.

## 7. Criterios de aceitacao

- [x] Build do frontend passa.
- [x] Typecheck do frontend passa.
- [x] Typecheck do backend passa.
- [x] Scan comercial nao encontra `<button`, `<input`, `<select`, `<textarea`.
- [x] Scan comercial nao encontra imports directos de `components/ui/*`.
- [x] Spec FEFO existe e esta marcada como `implemented`.
- [x] Testes FEFO novos usam `backend/src/test/` e `withTestTx`.
- [ ] Suite comercial DB-backed passa contra BD de teste acessivel.
- [ ] Testes legados comerciais/sales sao migrados gradualmente para harness ou marcados como legacy em spec propria.

## 8. Plano de testes

| Tipo | Cobertura | Ficheiro / comando |
|------|-----------|--------------------|
| Static UI | Sem HTML interactivo cru no modulo comercial | `rg -n "<button|<input|<select|<textarea" frontend/src/pages/commercial frontend/src/components/commercial` |
| Static UI | Sem imports directos de primitives UI | `rg -n "components/ui/|\.\./ui/" frontend/src/pages/commercial frontend/src/components/commercial` |
| Typecheck | Frontend | `npm.cmd run typecheck -w frontend` |
| Build | Frontend | `npm.cmd run build -w frontend` |
| Typecheck | Backend | `npm.cmd run typecheck -w backend` |
| Harness | FEFO DB tests com factories + rollback | `npm.cmd run test -w backend -- --runTestsByPath src/__tests__/services/fefo.test.ts` |
| Route | Comercial e vendas contra DB | `npm.cmd run test -w backend -- --runTestsByPath src/routes/__tests__/commercial.test.ts src/routes/__tests__/sales.test.ts` |

## 9. Riscos & rollback

- **Risco**: marcar o modulo como concluido sem DB testavel. **Mitigacao**: esta spec separa checks aprovados de checks bloqueados por ambiente.
- **Risco**: testes legados com `deleteMany` continuarem a depender de estado global. **Mitigacao**: migrar por fluxo critico, com prioridade para venda, anulação, turno e stock.
- **Rollback**: alteracoes de UI sao isoladas no frontend comercial; rollback e reverter os ficheiros comerciais tocados nesta certificacao.

## 10. Metricas de sucesso

- Zero overflow horizontal involuntario nas rotas comerciais principais em mobile.
- Zero uso novo de HTML interactivo cru no modulo comercial.
- Novas features comerciais transaccionais sempre com spec + testes harness antes de merge.
