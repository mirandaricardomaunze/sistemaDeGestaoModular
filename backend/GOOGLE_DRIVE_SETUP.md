# 🔐 Configuração do Google Drive para Backups Automáticos

Este guia mostra como configurar a integração com o Google Drive para fazer backup automático na nuvem.

## 📋 Pré-requisitos

- Conta Google (Gmail)
- Acesso ao Google Cloud Console
- Servidor backend rodando

---

## 🚀 Passo a Passo

### **1. Criar Projeto no Google Cloud Console**

1. Acesse: https://console.cloud.google.com/
2. Clique em **"Select a project"** → **"NEW PROJECT"**
3. Nome do projeto: `Sistema Backups` (ou qualquer nome)
4. Clique em **"CREATE"**
5. Aguarde a criação e selecione o projeto

### **2. Ativar Google Drive API**

1. No menu lateral, vá em: **APIs & Services** → **Library**
2. Pesquise por: `Google Drive API`
3. Clique em **"Google Drive API"**
4. Clique em **"ENABLE"**

### **3. Configurar OAuth Consent Screen**

1. No menu lateral: **APIs & Services** → **OAuth consent screen**
2. Escolha: **External** (para uso pessoal/teste)
3. Clique em **"CREATE"**

**Preencha os campos:**
- **App name**: `Sistema Backups`
- **User support email**: Seu email
- **Developer contact**: Seu email
- Clique em **"SAVE AND CONTINUE"**

**Scopes:**
- Clique em **"ADD OR REMOVE SCOPES"**
- Pesquise e selecione: `Google Drive API` → `.../auth/drive.file`
- Clique em **"UPDATE"** → **"SAVE AND CONTINUE"**

**Test users:**
- Clique em **"ADD USERS"**
- Adicione seu email do Google
- Clique em **"SAVE AND CONTINUE"**

### **4. Criar Credenciais OAuth 2.0**

1. No menu lateral: **APIs & Services** → **Credentials**
2. Clique em **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Application type: **Web application**
4. Name: `Sistema Backend`

**Authorized redirect URIs:**
- Clique em **"+ ADD URI"**
- Adicione: `http://localhost:3001/api/gdrive/callback`
- Se usar em produção, adicione também: `https://seu-dominio.com/api/gdrive/callback`

5. Clique em **"CREATE"**
6. **COPIE** o `Client ID` e `Client Secret` que aparecem

### **5. Configurar Variáveis de Ambiente**

Edite o arquivo `backend/.env`:

```bash
# Google Drive Integration
GDRIVE_ENABLED=true
GDRIVE_CLIENT_ID="123456789-abcdefg.apps.googleusercontent.com"
GDRIVE_CLIENT_SECRET="GOCSPX-abc123def456"
GDRIVE_REDIRECT_URI="http://localhost:3001/api/gdrive/callback"
GDRIVE_REFRESH_TOKEN=""  # Deixe vazio por enquanto
GDRIVE_FOLDER_ID=""      # Opcional
```

**Substitua:**
- `GDRIVE_CLIENT_ID` → Seu Client ID copiado
- `GDRIVE_CLIENT_SECRET` → Seu Client Secret copiado

### **6. Obter Refresh Token**

1. **Reinicie o servidor backend**:
   ```bash
   npm run dev
   ```

2. **Acesse no navegador**:
   ```
   http://localhost:3001/api/gdrive/auth-url
   ```

3. **Copie a URL** que aparece no JSON:
   ```json
   {
     "success": true,
     "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
   }
   ```

4. **Cole a URL no navegador** e pressione Enter

5. **Faça login** com sua conta Google

6. **Autorize o aplicativo** clicando em "Allow"

7. Você será redirecionado para uma página com o **Refresh Token**

8. **Copie o Refresh Token** e adicione no `.env`:
   ```bash
   GDRIVE_REFRESH_TOKEN="1//0abc123def456..."
   ```

9. **Reinicie o servidor** novamente

### **7. (Opcional) Criar Pasta Específica no Drive**

1. Acesse: https://drive.google.com/
2. Crie uma pasta chamada `Sistema Backups`
3. Abra a pasta
4. Copie o ID da URL:
   ```
   https://drive.google.com/drive/folders/1AbC123DeF456...
                                            ^^^^^^^^^^^^^^^^
                                            Este é o FOLDER_ID
   ```
5. Adicione no `.env`:
   ```bash
   GDRIVE_FOLDER_ID="1AbC123DeF456..."
   ```

---

## ✅ Testar a Configuração

### **Teste Manual via API**

```bash
# Verificar status
curl http://localhost:3001/api/gdrive/status

# Deve retornar:
{
  "configured": true,
  "enabled": true
}
```

### **Criar Backup e Enviar para Drive**

1. Acesse: `http://localhost:5173/backups`
2. Clique em **"Criar Backup"**
3. Aguarde a criação
4. Verifique os logs do servidor:
   ```
   📦 Criando backup: backup-2024-12-24...
   ✅ Backup criado com sucesso: 15.42 MB
   ☁️  Fazendo upload para Google Drive...
   ✅ Backup enviado para Google Drive com sucesso!
   ```

5. Verifique no Google Drive:
   - https://drive.google.com/
   - O arquivo deve estar lá!

---

## 🔧 Troubleshooting

### Erro: "Google Drive não está configurado"

**Solução:**
- Verifique se `GDRIVE_ENABLED=true` no `.env`
- Confirme que todas as variáveis estão preenchidas
- Reinicie o servidor

### Erro: "invalid_grant"

**Solução:**
- O Refresh Token expirou ou é inválido
- Refaça o processo de autorização (Passo 6)
- Obtenha um novo Refresh Token

### Erro: "Access denied"

**Solução:**
- Verifique se adicionou seu email em "Test users" no OAuth Consent Screen
- Certifique-se de que a API do Google Drive está ativada

### Erro: "redirect_uri_mismatch"

**Solução:**
- Verifique se a URL de redirect no Google Cloud Console é EXATAMENTE:
  `http://localhost:3001/api/gdrive/callback`
- Sem barra no final
- Protocolo correto (http vs https)

---

## 📊 Funcionalidades Disponíveis

### Upload Automático
- ✅ Todo backup criado é automaticamente enviado para o Drive
- ✅ Funciona com backups agendados (cron)
- ✅ Funciona com backups manuais

### Limpeza Automática
- ✅ Backups antigos são deletados do Drive automaticamente
- ✅ Respeita o período de retenção configurado (30 dias por padrão)

### Gerenciamento via API

**Listar backups no Drive:**
```bash
GET http://localhost:3001/api/gdrive/backups
```

**Upload manual:**
```bash
POST http://localhost:3001/api/gdrive/upload/backup-2024-12-24.sql
```

**Deletar do Drive:**
```bash
DELETE http://localhost:3001/api/gdrive/{fileId}
```

---

## 🔐 Segurança

### ⚠️ IMPORTANTE

1. **NUNCA** compartilhe suas credenciais:
   - Client ID
   - Client Secret
   - Refresh Token

2. **NÃO** commite o arquivo `.env` no Git
   - Já está no `.gitignore`

3. **Use variáveis de ambiente** em produção:
   - Heroku: Settings → Config Vars
   - Vercel: Settings → Environment Variables
   - AWS: Systems Manager → Parameter Store

4. **Revogue acesso** se necessário:
   - https://myaccount.google.com/permissions
   - Encontre "Sistema Backups"
   - Clique em "Remove Access"

---

## 📈 Monitoramento

### Logs do Sistema

O sistema registra todas as operações do Google Drive:

```
✅ Google Drive integrado com sucesso
☁️  Fazendo upload para Google Drive: backup-2024-12-24.sql
✅ Upload concluído: backup-2024-12-24.sql (15.42 MB)
📁 File ID: 1AbC123DeF456...
🧹 2 backup(s) antigo(s) removido(s) do Google Drive
```

### Verificar Espaço no Drive

- Acesse: https://one.google.com/storage
- Verifique quanto espaço está sendo usado
- Conta gratuita: 15 GB
- Se precisar de mais: Google One (pago)

---

## 💡 Dicas

1. **Crie uma conta Google separada** para backups
2. **Use Google Workspace** para backups ilimitados (pago)
3. **Configure alertas** para falhas de upload
4. **Teste restauração** periodicamente
5. **Mantenha backups locais** também (redundância)

---

## 🎯 Próximos Passos

Após configurar o Google Drive, você pode:

1. ✅ Configurar backup automático diário
2. ✅ Testar restauração de backup
3. ✅ Configurar notificações por email
4. ✅ Adicionar outros serviços de nuvem (AWS S3, Dropbox)
5. ✅ Implementar criptografia de backups

---

## 📞 Suporte

Se tiver problemas:

1. Verifique os logs do servidor
2. Consulte a seção Troubleshooting
3. Revise todas as configurações
4. Teste com uma conta Google diferente

---

**Última atualização:** 24/12/2024  
**Versão:** 1.0.0
