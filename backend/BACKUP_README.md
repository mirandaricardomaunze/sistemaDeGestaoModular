# 📦 Sistema de Backup Automático

## 🎯 Funcionalidades

- ✅ **Backup Automático Agendado** - Executa diariamente às 2h da manhã
- ✅ **Backup Manual** - Crie backups sob demanda
- ✅ **Restauração de Backups** - Restaure qualquer backup anterior
- ✅ **Download de Backups** - Baixe arquivos de backup para armazenamento externo
- ✅ **Limpeza Automática** - Remove backups antigos automaticamente (30 dias por padrão)
- ✅ **Estatísticas** - Visualize informações sobre seus backups

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis no arquivo `.env` do backend:

```bash
# Backup Configuration
BACKUP_ENABLED=true                  # Habilitar/desabilitar backup automático
BACKUP_SCHEDULE="0 2 * * *"          # Cron: 2h da manhã todo dia
BACKUP_RETENTION_DAYS=30             # Manter backups por 30 dias
```

### 2. Formato do Cron Schedule

O `BACKUP_SCHEDULE` usa o formato cron padrão:

```
┌───────────── minuto (0 - 59)
│ ┌───────────── hora (0 - 23)
│ │ ┌───────────── dia do mês (1 - 31)
│ │ │ ┌───────────── mês (1 - 12)
│ │ │ │ ┌───────────── dia da semana (0 - 6) (Domingo=0)
│ │ │ │ │
* * * * *
```

**Exemplos:**
- `0 2 * * *` - Todos os dias às 2h da manhã
- `0 */6 * * *` - A cada 6 horas
- `0 0 * * 0` - Todo domingo à meia-noite
- `0 3 1 * *` - Dia 1 de cada mês às 3h

### 3. Requisitos

- PostgreSQL instalado
- Comando `pg_dump` disponível no PATH
- Comando `psql` disponível no PATH (para restauração)

**Windows:**
Adicione o PostgreSQL ao PATH:
```
C:\Program Files\PostgreSQL\15\bin
```

**Linux/Mac:**
Geralmente já está no PATH após instalação.

## 🚀 Como Usar

### Interface Web

1. Acesse: `http://localhost:5173/backups`
2. Visualize estatísticas e lista de backups
3. Ações disponíveis:
   - **Criar Backup** - Botão no topo da página
   - **Download** - Ícone de download em cada backup
   - **Restaurar** - Ícone de refresh (⚠️ CUIDADO!)
   - **Deletar** - Ícone de lixeira

### API Endpoints

#### Criar Backup Manual
```bash
POST http://localhost:3001/api/backups/create
```

#### Listar Backups
```bash
GET http://localhost:3001/api/backups/list
```

#### Obter Estatísticas
```bash
GET http://localhost:3001/api/backups/stats
```

#### Download de Backup
```bash
GET http://localhost:3001/api/backups/download/:filename
```

#### Restaurar Backup
```bash
POST http://localhost:3001/api/backups/restore/:filename
```

#### Deletar Backup
```bash
DELETE http://localhost:3001/api/backups/:filename
```

## 📁 Estrutura de Arquivos

Os backups são salvos em:
```
backend/backups/
├── backup-2024-12-24T18-30-00-000Z.sql
├── backup-2024-12-25T02-00-00-000Z.sql
└── backup-2024-12-26T02-00-00-000Z.sql
```

**Formato do nome:** `backup-{ISO_TIMESTAMP}.sql`

## ⚠️ Avisos Importantes

### Restauração de Backup

**ATENÇÃO:** Restaurar um backup **SUBSTITUI TODOS OS DADOS ATUAIS** do banco de dados!

**Antes de restaurar:**
1. ✅ Crie um backup dos dados atuais
2. ✅ Confirme que está restaurando o backup correto
3. ✅ Avise todos os usuários do sistema
4. ✅ Pare operações críticas

### Segurança

1. **Proteja os arquivos de backup** - Contêm dados sensíveis
2. **Faça backup externo** - Não confie apenas em backups locais
3. **Teste restaurações** - Periodicamente teste se os backups funcionam
4. **Controle de acesso** - Apenas administradores devem ter acesso

## 🔧 Troubleshooting

### Erro: "pg_dump: command not found"

**Solução Windows:**
```powershell
# Adicionar PostgreSQL ao PATH
$env:Path += ";C:\Program Files\PostgreSQL\15\bin"
```

**Solução Linux/Mac:**
```bash
# Instalar PostgreSQL client
sudo apt-get install postgresql-client  # Ubuntu/Debian
brew install postgresql                  # Mac
```

### Erro: "Permission denied"

**Solução:**
```bash
# Dar permissão de escrita no diretório de backups
chmod 755 backend/backups
```

### Backup não está sendo criado automaticamente

**Verificações:**
1. Confirme que `BACKUP_ENABLED=true` no `.env`
2. Verifique os logs do servidor para erros
3. Confirme que o cron schedule está correto
4. Reinicie o servidor backend

### Backup muito grande

**Soluções:**
1. Aumente `BACKUP_RETENTION_DAYS` para manter menos backups
2. Implemente compressão (gzip):
```typescript
// Modificar backup.service.ts
const command = `pg_dump "${databaseUrl}" | gzip > "${filepath}.gz"`;
```

## 📊 Monitoramento

### Logs do Sistema

O serviço de backup registra todas as operações:

```
📦 Backup automático configurado: 0 2 * * *
📦 Retenção: 30 dias
📦 Diretório: /path/to/backups
⏰ Iniciando backup agendado...
📦 Criando backup: backup-2024-12-24T02-00-00-000Z.sql
✅ Backup criado com sucesso: backup-2024-12-24T02-00-00-000Z.sql (15.42 MB)
🧹 2 backup(s) antigo(s) removido(s)
```

### Estatísticas

Acesse `/backups` para ver:
- Total de backups
- Espaço total ocupado
- Data do último backup
- Horário do próximo backup agendado

## 🎯 Melhores Práticas

1. **Backup 3-2-1**
   - 3 cópias dos dados
   - 2 tipos de mídia diferentes
   - 1 cópia offsite (nuvem)

2. **Teste Regular**
   - Teste restauração mensalmente
   - Valide integridade dos backups

3. **Documentação**
   - Documente procedimentos de restauração
   - Mantenha lista de backups críticos

4. **Automação**
   - Configure alertas para falhas de backup
   - Monitore espaço em disco

5. **Segurança**
   - Criptografe backups sensíveis
   - Controle acesso aos arquivos
   - Faça backup das credenciais separadamente

## 🔐 Backup para Nuvem (Opcional)

### Google Drive

```typescript
// Adicionar em backup.service.ts
import { google } from 'googleapis';

async uploadToGoogleDrive(filepath: string) {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    await drive.files.create({
        requestBody: {
            name: path.basename(filepath),
            parents: ['FOLDER_ID'],
        },
        media: {
            mimeType: 'application/sql',
            body: fs.createReadStream(filepath),
        },
    });
}
```

### AWS S3

```typescript
import AWS from 'aws-sdk';

async uploadToS3(filepath: string) {
    const s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    
    const fileContent = await fs.readFile(filepath);
    
    await s3.upload({
        Bucket: 'my-backups',
        Key: path.basename(filepath),
        Body: fileContent,
    }).promise();
}
```

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs do servidor
2. Consulte esta documentação
3. Entre em contato com o administrador do sistema

---

**Última atualização:** 24/12/2024
**Versão:** 1.0.0
