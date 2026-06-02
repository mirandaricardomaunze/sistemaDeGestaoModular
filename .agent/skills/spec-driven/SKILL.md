---
name: spec-driven
description: "Template leve e processo para escrever uma spec curta antes de tocar em código numa feature ou bug não-trivial. Aplica-se a qualquer mudança que toque em dinheiro, stock, fiscal, multi-tenant, ou contratos de API."
---

# 📐 Spec-Driven Development

> 🤖 **AI INSTRUCTION (MANDATORY)**: Antes de implementar qualquer feature que toque em dinheiro, stock, fiscal, multi-tenant, ou contratos de API entre frontend e backend, escrever (ou pedir ao utilizador) uma spec usando o template abaixo. Guardar em `docs/specs/<slug>.md`. Sem spec = sem código.

## Quando aplicar

**Obrigatório** para:
- Novas rotas / endpoints públicos
- Mudanças em fluxos transaccionais (vendas, faturação, stock, pagamentos, fiscal)
- Mudanças em modelos `Prisma` que envolvam migrações destrutivas ou novas FKs
- Qualquer feature multi-passo (>1 ficheiro + >1 tabela)

**Opcional** para:
- Bug fixes pontuais (descrever no commit chega)
- Renames, refactors sem mudança de comportamento
- Mudanças puramente cosméticas de UI

## Onde guardar

```
docs/specs/
├─ <YYYY-MM-DD>-<slug>.md      # uma spec por feature
└─ README.md                    # índice cronológico
```

Slug em kebab-case, descritivo (ex.: `2026-06-01-fefo-batch-selection.md`).

## Template (copiar/colar)

```markdown
# Spec: <Título curto>

- **Status**: draft | approved | implemented | deprecated
- **Autor**: <nome>
- **Data**: YYYY-MM-DD
- **Skill(s) relacionadas**: [[spec-name]], ...

## 1. Contexto

Uma a três frases sobre o problema e porquê existe agora. Sem narrativa épica.

## 2. Objectivo

O que esta mudança vai entregar, do ponto de vista do utilizador final. Verbos no infinitivo.

## 3. Não-objectivos

O que esta spec **NÃO** vai resolver, mesmo que adjacente. Evita scope creep durante revisão.

## 4. Contrato

### 4.1 API (se aplicável)

`METHOD /caminho`

Request:
```json
{ "campo": "tipo" }
```

Response 200:
```json
{ "campo": "tipo" }
```

Códigos de erro: `400 <quando>`, `403 <quando>`, `404 <quando>`.

### 4.2 Modelo de dados

Tabelas/campos novos ou alterados. Incluir tipo, default, índices, FKs.

### 4.3 Estado / eventos

Máquina de estados (se houver), eventos emitidos no Socket.IO, jobs BullMQ disparados.

## 5. Regras de negócio

Lista numerada de regras invioláveis. Cada regra ligada a um caso de teste em §7.

1. <Regra concreta>
2. ...

## 6. Edge cases

Lista do que pode correr mal e como reagimos. Cada item ⇒ teste.

- <cenário>: <comportamento esperado>

## 7. Critérios de aceitação

Checklist binária que o revisor usa para aceitar o PR.

- [ ] <comportamento observável>
- [ ] ...

## 8. Plano de testes

| Tipo       | Cobertura                                    | Ficheiro                        |
|------------|----------------------------------------------|---------------------------------|
| Unit       | Lógica de negócio em isolamento              | `<service>.test.ts`             |
| Integração | Rota → service → DB (harness com tx rollback)| `__tests__/<feature>.test.ts`   |
| E2E manual | Golden path no POS                           | (descrever passos)              |

## 9. Riscos & rollback

- **Risco**: <o que pode partir>. **Mitigação**: <como evitamos>.
- **Rollback**: <como revertemos se a feature for tóxica em produção> (feature flag, migração reversa, etc.).

## 10. Métricas de sucesso (opcional)

O que vamos observar para saber se a feature está a entregar valor (latência, taxa de erro, KPI de negócio).
```

## Regras

1. **Spec antes de código.** A primeira mensagem do PR liga para a spec. Sem spec aprovada, não se faz `npm install` de deps novas, nem se altera `schema.prisma`.
2. **Curto é melhor.** Um leitor experiente deve digerir a spec em <5 min. Se passar de 2 ecrãs, está a meter detalhe de implementação onde devia estar contrato.
3. **Critérios de aceitação são binários.** Cada checkbox é verificável sem opinião. "Funciona bem" não conta; "ao vender 10 unidades com 2 lotes (5+5), são criadas 2 linhas SaleItem com batchId distinto" conta.
4. **Edge cases ⇒ testes.** Cada bullet em §6 tem de aparecer como teste em §8. Sem excepções.
5. **Não-objectivos são parte do contrato.** Se durante revisão alguém pedir algo listado em §3, a resposta é "ficou fora desta spec — abrir nova spec".
6. **Specs vivas.** Quando a implementação diverge da spec, actualiza-se a spec **no mesmo PR**, não em PR de follow-up. Spec desactualizada é pior que spec inexistente.
7. **Linkagem.** Ao fim do `description:` da skill relacionada, adicionar `Spec: docs/specs/<file>.md`. Ao fim da spec implementada, mudar `Status: implemented` e ligar para o PR/commit que a entregou.

## Anti-padrões

- ❌ **Spec gigante para tudo.** Bug fix de uma linha não precisa de spec — usa o commit.
- ❌ **Spec depois do código.** Vira documentação retroactiva, perde valor de design.
- ❌ **Spec sem critérios de aceitação binários.** Não dá para fechar PR.
- ❌ **Reescrever a implementação na spec.** A spec descreve **contrato** e **regras**, não o código.

## Checklist do autor antes de pedir review

- [ ] Status = `draft`
- [ ] §4 Contrato cobre API + dados + eventos
- [ ] §5 Regras numeradas, cada uma com teste em §8
- [ ] §6 Edge cases listados, cada um com teste
- [ ] §7 Critérios de aceitação são todos binários
- [ ] §9 Rollback concreto (flag, migração reversa, etc.)
- [ ] Liga para skills relacionadas via `[[name]]`

## Checklist do revisor

- [ ] Os não-objectivos protegem o escopo?
- [ ] Os critérios de aceitação cobrem todas as regras de §5?
- [ ] Há regra de negócio em §5 sem teste em §8?
- [ ] O plano de rollback é executável em <10 min em produção?
