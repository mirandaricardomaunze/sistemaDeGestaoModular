# Sistema Backend

> **Nota**: este é um workspace dentro do monorepo. Para setup completo (incluindo frontend), ver [../README.md](../README.md). Os comandos abaixo funcionam de dentro de `backend/`, mas é equivalente correr `npm <cmd> -w backend` a partir da raiz.

## Backend API para Multicore

### 🚀 Tecnologias

- **Node.js** + **Express** - Servidor HTTP
- **TypeScript** - Tipagem estática
- **Prisma ORM** - Acesso ao banco de dados
- **PostgreSQL** - Base de dados
- **JWT** - Autenticação

### 📦 Instalação

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações de base de dados

# 3. Gerar cliente Prisma
npm run prisma:generate

# 4. Executar migrations (criar tabelas)
npm run prisma:migrate

# 5. Executar seed (dados iniciais)
npm run seed

# 6. Iniciar servidor de desenvolvimento
npm run dev
```

### 🗄️ Configuração PostgreSQL

Certifique-se de ter o PostgreSQL instalado e configurado. Atualize o `.env`:

```env
DATABASE_URL="postgresql://postgres:SuaSenha@localhost:5432/sistema_db?schema=public"
```

Para criar a base de dados:
```sql
CREATE DATABASE sistema_db;
```

### 📋 Endpoints da API

#### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registrar usuário
- `GET /api/auth/me` - Obter usuário atual
- `PUT /api/auth/change-password` - Alterar senha

#### Produtos
- `GET /api/products` - Listar produtos
- `GET /api/products/:id` - Obter produto
- `POST /api/products` - Criar produto
- `PUT /api/products/:id` - Atualizar produto
- `DELETE /api/products/:id` - Remover produto
- `PATCH /api/products/:id/stock` - Atualizar stock

#### Clientes
- `GET /api/customers` - Listar clientes
- `GET /api/customers/:id` - Obter cliente
- `POST /api/customers` - Criar cliente
- `PUT /api/customers/:id` - Atualizar cliente
- `DELETE /api/customers/:id` - Remover cliente

#### Fornecedores
- `GET /api/suppliers` - Listar fornecedores
- `POST /api/suppliers/:id/orders` - Criar ordem de compra
- `POST /api/suppliers/orders/:orderId/receive` - Receber mercadoria

#### Vendas (POS)
- `GET /api/sales` - Listar vendas
- `POST /api/sales` - Criar venda
- `GET /api/sales/stats/summary` - Estatísticas
- `GET /api/sales/today/summary` - Vendas de hoje

#### Faturas
- `GET /api/invoices` - Listar faturas
- `POST /api/invoices` - Criar fatura
- `POST /api/invoices/:id/payments` - Adicionar pagamento
- `POST /api/invoices/:id/credit-notes` - Criar nota de crédito

#### Funcionários & RH
- `GET /api/employees` - Listar funcionários
- `POST /api/employees/:id/attendance` - Registrar presença
- `POST /api/employees/:id/payroll` - Processar folha
- `POST /api/employees/:id/vacations` - Solicitar férias

#### Armazéns
- `GET /api/warehouses` - Listar armazéns
- `POST /api/warehouses/transfers` - Criar transferência
- `GET /api/warehouses/:id/stock` - Stock do armazém

#### Dashboard
- `GET /api/dashboard/metrics` - Métricas
- `GET /api/dashboard/charts/sales` - Gráfico de vendas
- `GET /api/dashboard/charts/top-products` - Produtos mais vendidos

#### Campanhas/CRM
- `GET /api/campaigns` - Listar campanhas
- `POST /api/campaigns/validate-code` - Validar código promo
- `POST /api/campaigns/:id/use` - Registrar uso

#### Alertas
- `GET /api/alerts` - Listar alertas
- `POST /api/alerts/generate` - Gerar alertas automáticos
- `PATCH /api/alerts/:id/resolve` - Resolver alerta

#### Configurações
- `GET /api/settings/company` - Dados da empresa
- `PUT /api/settings/company` - Atualizar dados
- `GET /api/settings/audit-logs` - Logs de auditoria

### 🔑 Autenticação

Todas as rotas (exceto `/api/auth/login` e `/api/auth/register`) requerem um token JWT no header:

```
Authorization: Bearer <token>
```

### 👤 Credenciais Padrão

Após executar o seed:

- **Admin:** admin@sistema.co.mz / admin123
- **Operador:** operador@sistema.co.mz / operador123

### 🛠️ Scripts

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Compilar para produção
npm run start        # Iniciar produção
npm run prisma:studio # Interface visual do banco
```

### 📝 Estrutura

```
backend/
├── prisma/
│   ├── schema.prisma  # Schema do banco
│   └── seed.ts        # Dados iniciais
├── src/
│   ├── index.ts       # Entry point
│   ├── middleware/
│   │   └── auth.ts    # Autenticação JWT
│   └── routes/
│       ├── auth.ts
│       ├── products.ts
│       ├── customers.ts
│       ├── suppliers.ts
│       ├── sales.ts
│       ├── invoices.ts
│       ├── employees.ts
│       ├── warehouses.ts
│       ├── dashboard.ts
│       ├── settings.ts
│       ├── campaigns.ts
│       └── alerts.ts
├── .env.example
├── package.json
└── tsconfig.json
```
