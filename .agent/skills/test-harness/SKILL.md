---
name: test-harness
description: "Convenções e infraestrutura do harness de testes do backend: factories tipadas, helpers de transacção com rollback, mocks padrão (Socket, Redis, Email, M-Pesa) e regras de isolamento multi-tenant. Aplica-se a TODOS os testes em backend/src/**/__tests__/."
---

# 🧪 Test Harness

> 🤖 **AI INSTRUCTION (MANDATORY)**: Ao escrever testes novos no backend, **sempre** importar de `backend/src/test/` (factories, helpers, mocks). Nunca instanciar dados de teste à mão linha por linha — usar as factories. Nunca chamar `prisma.<model>.deleteMany` em `beforeAll`/`afterAll` num teste novo — usar `withTestTx()`.

Complemento prático ao [[testing-standards]]. Aqui está **como** os testes correm; lá está **o que** testar.

## 1. Estrutura

```
backend/src/test/
├─ factories/                  # Dados de teste tipados — uma factory por modelo
│  ├─ index.ts                 # re-export
│  ├─ company.ts
│  ├─ user.ts
│  ├─ product.ts
│  ├─ productBatch.ts
│  ├─ sale.ts
│  └─ ...
├─ helpers/
│  ├─ withTestTx.ts            # Transacção com rollback automático
│  ├─ tenantContext.ts         # Mock companyId / userId para Prisma extension
│  ├─ time.ts                  # freezeTime / advanceTime
│  └─ assertions.ts            # expectDecimal, expectStockMovement, etc.
├─ mocks/
│  ├─ socket.ts                # emitToCompany / emitToModule no-op
│  ├─ redis.ts                 # in-memory map
│  ├─ email.ts                 # captura mails enviados
│  ├─ mpesa.ts                 # respostas fixas
│  └─ auth.ts                  # middleware que injecta req.companyId/userId
└─ setup.ts                    # Carregado por jest.setup.ts — aplica mocks globais
```

## 2. Factories

Cada factory expõe **3 funções**:

```ts
// backend/src/test/factories/product.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { TxClient } from '../helpers/withTestTx';

type ProductOverrides = Partial<Prisma.ProductUncheckedCreateInput>;

// 1. Build: cria objecto em memória, NÃO persiste
export function buildProduct(overrides: ProductOverrides = {}): Prisma.ProductUncheckedCreateInput {
    return {
        name: `Product ${Math.random().toString(36).slice(2, 8)}`,
        code: `P-${Date.now()}`,
        price: 100,
        costPrice: 60,
        currentStock: 0,
        packSize: 1,
        companyId: 'test-company-id',
        ...overrides,
    };
}

// 2. Create: persiste num tx ou no prisma global
export async function createProduct(
    overrides: ProductOverrides = {},
    client: TxClient = prisma,
) {
    return client.product.create({ data: buildProduct(overrides) });
}

// 3. CreateMany: helper para listas
export async function createProducts(
    count: number,
    overrides: ProductOverrides = {},
    client: TxClient = prisma,
) {
    return Promise.all(
        Array.from({ length: count }, (_, i) =>
            createProduct({ ...overrides, code: `P-${Date.now()}-${i}` }, client),
        ),
    );
}
```

**Regras das factories**:

1. **Defaults sãos.** O objecto que sai de `build()` tem de ser válido para Zod e Prisma sem nenhum override.
2. **Determinismo opcional, aleatório por defeito.** Códigos/nomes únicos por defeito para evitar colisões em paralelo. Para asserções, sobrepor explicitamente (`createProduct({ code: 'EXACT' })`).
3. **Tipo do override é `Partial<UncheckedCreateInput>`.** Garante que `companyId`/IDs podem ser substituídos.
4. **Aceita `client: TxClient`** para correr dentro de `withTestTx`.
5. **Não faz mocking.** Factory cria dados reais; mocks são separados.

## 3. Transacção com rollback (`withTestTx`)

O padrão **dominante** para testes de integração:

```ts
import { withTestTx } from '../../test/helpers/withTestTx';
import { createCompany, createProduct, createUser } from '../../test/factories';

describe('SalesService.create', () => {
    it('decrementa stock do lote mais próximo do vencimento', async () => {
        await withTestTx(async (tx) => {
            // Arrange
            const company = await createCompany({}, tx);
            const product = await createProduct({ companyId: company.id, currentStock: 10 }, tx);
            // ...

            // Act
            await salesService.create(input, company.id, user.id, 'op', '127.0.0.1');

            // Assert
            const batch = await tx.productBatch.findFirst({ where: { id: oldBatch.id } });
            expect(batch?.quantity).toBe(0);
        });
    });
});
```

`withTestTx` abre uma transacção, passa o `tx` ao callback, e **faz rollback no fim, sempre** (mesmo em sucesso). Resultado:
- Nenhum teste deixa lixo na BD.
- Testes correm em paralelo sem se pisar (cada um na sua tx).
- Não há `beforeAll/afterAll` a apagar dados — sem mais `deleteMany` defensivo.

**Excepção**: serviços que abrem a sua **própria** transacção interna (ex. `salesService.create` chama `prisma.$transaction`). Para esses, `withTestTx` faz só setup/teardown com rollback; o serviço corre na sua transacção própria que é commitada. Nesse caso, o teste **tem** de limpar explicitamente as entidades criadas pelo serviço, OU correr contra uma BD efémera (ver §7).

## 4. Mocks padrão

Aplicados globalmente em `backend/src/test/setup.ts` (carregado via `jest.setup.ts`). Não repetir em cada ficheiro de teste.

| Mock     | O que substitui                          | Como inspeccionar no teste                   |
|----------|------------------------------------------|----------------------------------------------|
| `socket` | `emitToCompany`/`emitToModule`/`emitToUser` viram `jest.fn()` | `expect(socketMock.emitToCompany).toHaveBeenCalledWith(...)` |
| `redis`  | Map em memória; `get`/`set`/`del` síncronos | `redisMock.store.get('key')`                 |
| `email`  | `sendMail` empilha em array              | `expect(emailMock.outbox).toHaveLength(1)`   |
| `mpesa`  | `c2bPayment` devolve `{ status: 'success' }` por defeito | `mpesaMock.setNextResponse({ status: 'failed' })` |
| `auth`   | Middleware injecta `req.companyId='test-company-id'`, `req.userId='test-user-id'`, `req.userRole='admin'` | Override com `setAuthContext({ userRole: 'cashier' })` |

Para testes que precisam de comportamento diferente: importar do mock e chamar setter (`mpesaMock.setNextResponse(...)`). Reset automático em `beforeEach` global.

## 5. Tenant context

Os testes correm com `companyId='test-company-id'` por defeito (injectado pelo mock de `auth`). A Prisma extension de [[multicore]] usa isto para isolar queries.

Para testar **isolamento entre empresas**:

```ts
import { setAuthContext } from '../../test/mocks/auth';

it('não permite ler produtos de outra empresa', async () => {
    const otherCompany = await createCompany({ id: 'other-co' });
    const otherProduct = await createProduct({ companyId: 'other-co' });

    setAuthContext({ companyId: 'test-company-id' });
    const found = await prisma.product.findFirst({ where: { id: otherProduct.id } });
    expect(found).toBeNull();
});
```

## 6. Assertions partilhadas

```ts
import { expectDecimal, expectStockMovement } from '../../test/helpers/assertions';

// Decimal-safe: compara Prisma.Decimal com number sem ULP issues
expectDecimal(sale.total).toEqual(116);

// Verifica que houve um movimento de stock específico
await expectStockMovement(tx, {
    productId: product.id,
    quantity: -2,
    movementType: 'sale',
    productBatchId: batch.id,
});
```

## 7. Camadas de teste

| Camada       | Quando usar                                                                                  | Onde mocka Prisma?      | DB real?    |
|--------------|----------------------------------------------------------------------------------------------|-------------------------|-------------|
| **Unit**     | Função pura, cálculo, helper, regra que não toca em DB nem rede                              | N/A (não há Prisma)     | Não         |
| **Service**  | Service que orquestra Prisma + regras. Validar transições, side effects, throws              | `jest-mock-extended`    | Não         |
| **Route**    | Endpoint HTTP completo (supertest → app → route → service → DB)                              | Não — DB de teste       | Sim, com tx |
| **Contract** | Schema Zod vs response real do endpoint                                                      | Não                     | Sim         |

**Default**: começar por **service** com mock de Prisma. Subir para **route** quando o valor está na composição (middleware + Zod + service).

## 8. Convenções de naming

- Ficheiro: `<sujeito>.test.ts` em `__tests__/` co-localizado com o código.
- `describe('SubjectClass.method', ...)`
- `it('faz X quando Y', ...)` — descritivo, sem "should".
- AAA com comentários explícitos para testes não triviais.

## 9. Performance & CI

- `maxWorkers: 1` está activo no `jest.config.js` enquanto testes partilharem BD. Quando migrarmos para schema-per-test (ver §10), subir para `maxWorkers: 50%`.
- Cada teste tem que correr em **<2s**. Acima disso → suspeitar de fixture pesada ou falta de mock.
- `npm test` é gate de PR. Nada de `--passWithNoTests` em CI.

## 10. Roadmap (não bloqueante)

- [ ] Migrar testes que ainda usam `deleteMany` defensivo para `withTestTx`.
- [ ] Schema-per-worker no PostgreSQL para isolamento total e `maxWorkers > 1` (ver memória `project_tests_share_prod_db`).
- [ ] Contract tests automáticos rota↔OpenAPI (gerado de Zod) com `vitest-openapi` ou equivalente.

## 11. Checklist do autor de testes

- [ ] Importei factories de `backend/src/test/factories` em vez de criar dados à mão.
- [ ] Usei `withTestTx` em vez de `beforeAll/deleteMany`.
- [ ] Não toquei em Redis/Socket/Email/M-Pesa reais.
- [ ] Cobri os edge cases listados na spec (§6) — ver [[spec-driven]].
- [ ] `describe`/`it` descrevem comportamento, não implementação.
- [ ] Teste corre <2s.

## Anti-padrões

- ❌ `prisma.<model>.deleteMany(...)` em `beforeAll` — usar `withTestTx`.
- ❌ Criar `company`/`user`/`product` linha por linha em cada `beforeAll` — usar factory.
- ❌ Mockar Prisma dentro do teste de route (mocka demasiado) — usar BD com tx.
- ❌ Testar que "o método foi chamado com X" sem verificar o efeito observável — testa-se comportamento, não chamadas.
- ❌ Assumir ordem de execução entre testes — cada `it` é independente.
