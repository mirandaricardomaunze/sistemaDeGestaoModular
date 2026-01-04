# 🚀 Guia de Configuração - Backend com PostgreSQL

## Pré-requisitos

1. **PostgreSQL** instalado e a correr
2. **Node.js** v18+ instalado

---

## Passos para Configurar

### 1️⃣ Criar o Ficheiro `.env` do Backend

Cria o ficheiro `backend/.env` com o seguinte conteúdo:

```env
# Server
PORT=3001
NODE_ENV=development

# PostgreSQL Database
# Substitua pela sua configuração real de PostgreSQL
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/sistema_db?schema=public"

# JWT Configuration
JWT_SECRET="sistema_gestao_comercial_jwt_secret_2024_very_secure"
JWT_EXPIRES_IN="7d"

# CORS
FRONTEND_URL="http://localhost:5173"

# Company Defaults
DEFAULT_IVA_RATE=16
DEFAULT_INSS_EMPLOYEE_RATE=3
DEFAULT_INSS_EMPLOYER_RATE=4
```

**IMPORTANTE:** Substitua `SUA_SENHA` pela senha do seu PostgreSQL.

---

### 2️⃣ Criar a Base de Dados

Abra o terminal e execute:

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar a base de dados
CREATE DATABASE sistema_db;

# Sair
\q
```

Ou use o pgAdmin para criar uma base de dados chamada `sistema_db`.

---

### 3️⃣ Instalar Dependências e Configurar Prisma

```bash
# Ir para o diretório backend
cd backend

# Instalar dependências
npm install

# Gerar o cliente Prisma
npx prisma generate

# Executar as migrações (criar tabelas)
npx prisma migrate dev --name init

# (Opcional) Visualizar a base de dados
npx prisma studio
```

---

### 4️⃣ (Opcional) Popular com Dados Iniciais

Crie um ficheiro `backend/prisma/seed.ts` para adicionar dados iniciais:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    // Criar utilizador admin
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await prisma.user.upsert({
        where: { email: 'admin@sistema.com' },
        update: {},
        create: {
            email: 'admin@sistema.com',
            password: hashedPassword,
            name: 'Administrador',
            role: 'admin',
            phone: '+258 84 123 4567',
        },
    });

    // Criar armazém padrão
    await prisma.warehouse.upsert({
        where: { code: 'ARM-001' },
        update: {},
        create: {
            code: 'ARM-001',
            name: 'Armazém Principal',
            location: 'Maputo, Moçambique',
            responsible: 'Administrador',
            isDefault: true,
        },
    });

    // Criar configurações da empresa
    await prisma.companySettings.upsert({
        where: { id: 'company-settings' },
        update: {},
        create: {
            id: 'company-settings',
            companyName: 'Minha Empresa, Lda',
            tradeName: 'Minha Empresa',
            nuit: '123456789',
            phone: '+258 21 123 456',
            email: 'info@empresa.co.mz',
            address: 'Av. Julius Nyerere, 123',
            city: 'Maputo',
            province: 'Maputo',
            country: 'Moçambique',
        },
    });

    // Criar produtos exemplo
    const products = [
        {
            code: 'PROD-001',
            name: 'Coca-Cola 500ml',
            category: 'beverages' as const,
            price: 50.00,
            costPrice: 35.00,
            currentStock: 100,
            minStock: 20,
            unit: 'un',
            status: 'in_stock' as const,
        },
        {
            code: 'PROD-002',
            name: 'Arroz 25kg',
            category: 'food' as const,
            price: 1500.00,
            costPrice: 1200.00,
            currentStock: 50,
            minStock: 10,
            unit: 'kg',
            status: 'in_stock' as const,
        },
        {
            code: 'PROD-003',
            name: 'Óleo Alimentar 5L',
            category: 'food' as const,
            price: 450.00,
            costPrice: 350.00,
            currentStock: 5,
            minStock: 15,
            unit: 'un',
            status: 'low_stock' as const,
        },
    ];

    for (const product of products) {
        await prisma.product.upsert({
            where: { code: product.code },
            update: {},
            create: product,
        });
    }

    console.log('✅ Seed executado com sucesso!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
```

Execute o seed:

```bash
npx ts-node prisma/seed.ts
```

---

### 5️⃣ Iniciar o Backend

```bash
# Modo desenvolvimento
npm run dev

# Ou compilar e executar
npm run build
npm start
```

O backend irá iniciar em: `http://localhost:3001`

---

### 6️⃣ Iniciar o Frontend

Numa nova janela de terminal:

```bash
# Voltar para o diretório raiz
cd ..

# Iniciar o frontend
npm run dev
```

O frontend irá iniciar em: `http://localhost:5173`

---

## 🎉 Pronto!

O sistema agora está conectado ao PostgreSQL. Quando adicionar, editar ou remover produtos na interface, os dados serão persistidos na base de dados.

### Endpoints da API disponíveis:

| Endpoint | Descrição |
|----------|-----------|
| `POST /api/auth/login` | Login |
| `GET /api/products` | Listar produtos |
| `POST /api/products` | Criar produto |
| `PUT /api/products/:id` | Actualizar produto |
| `DELETE /api/products/:id` | Remover produto (soft delete) |
| `PATCH /api/products/:id/stock` | Actualizar stock |
| `GET /api/warehouses` | Listar armazéns |
| `GET /api/customers` | Listar clientes |
| `GET /api/suppliers` | Listar fornecedores |

### Testar a API:

```bash
# Health check
curl http://localhost:3001/api/health
```

---

## Resolução de Problemas

### Erro: "Could not connect to database"
- Verifique se o PostgreSQL está a correr
- Confirme as credenciais no `.env`

### Erro: "Prisma Client not found"
```bash
npx prisma generate
```

### Erro: "Table does not exist"
```bash
npx prisma migrate dev
```
