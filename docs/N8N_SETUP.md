# Guia de Configuração: n8n + Gemini AI

## 📋 Pré-requisitos

1. **n8n instalado e rodando**
   - Instalar: `npx n8n` ou via Docker
   - URL padrão: `http://localhost:5678`

2. **API Key do Google Gemini**
   - Obter em: https://makersuite.google.com/app/apikey
   - Grátis com limites generosos

## 🚀 Passo a Passo

### 1. Configurar n8n

1. **Iniciar n8n:**
   ```bash
   npx n8n
   # ou
   docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
   ```

2. **Acessar interface:** http://localhost:5678

3. **Importar workflow:**
   - Clicar em "Import from File"
   - Selecionar: `docs/n8n-chat-workflow.json`
   - Workflow será criado automaticamente

4. **Configurar credenciais do Gemini:**
   - No workflow, clicar no nó "Google Gemini"
   - Clicar em "Create New Credential"
   - Inserir sua API Key do Gemini
   - Salvar

5. **Ativar workflow:**
   - Clicar no botão "Active" no topo
   - Copiar a URL do webhook (aparece no nó "Webhook - Receive Message")

### 2. Configurar Backend

1. **Criar arquivo `.env`** (se não existir):
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Editar `.env`** e adicionar:
   ```env
   N8N_WEBHOOK_URL=http://localhost:5678/webhook/chat-ai
   N8N_TIMEOUT=30000
   ```

3. **Reiniciar backend:**
   ```bash
   npm run dev
   ```

### 3. Testar Integração

1. **Abrir aplicação:** http://localhost:5173

2. **Fazer login** no sistema

3. **Abrir chat IA** (botão flutuante com ícone ✨)

4. **Enviar mensagem de teste:**
   - "Quanto vendi hoje?"
   - "Mostrar produtos com stock baixo"

5. **Verificar resposta:**
   - Deve vir do Gemini (resposta natural e contextualizada)
   - Rodapé mostra "Powered by Gemini AI"

## 🔍 Verificação de Saúde

**Testar health check:**
```bash
curl http://localhost:3001/api/chat/health \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "ai": {
    "available": true,
    "provider": "Gemini via n8n",
    "model": "gemini-1.5-flash"
  },
  "features": {
    "chat": true,
    "pdfGeneration": true,
    "dataQuery": true
  }
}
```

## ⚠️ Troubleshooting

### n8n não responde
- Verificar se n8n está rodando: `http://localhost:5678`
- Verificar se workflow está ativo (botão "Active" verde)
- Verificar URL do webhook no `.env`

### Erro de API Key
- Verificar se API Key do Gemini está correta
- Verificar se tem créditos/quota disponível
- Testar API Key em: https://aistudio.google.com

### Fallback ativado
- Sistema usa respostas básicas quando n8n está offline
- Mensagem indica: "ℹ️ Resposta gerada sem IA"
- Verificar logs do backend para detalhes

## 📊 Monitoramento

**Logs do backend:**
```bash
cd backend
npm run dev
# Procurar por: "n8n/Gemini error" ou "n8n unavailable"
```

**Logs do n8n:**
- Interface web: http://localhost:5678
- Aba "Executions" mostra histórico de chamadas

## 🎯 Próximos Passos

Após configuração bem-sucedida:

1. ✅ Testar diferentes tipos de perguntas
2. ✅ Verificar geração de PDFs
3. ✅ Testar sugestões rápidas
4. ✅ Validar fallback (parar n8n e testar)
5. ✅ Ajustar temperatura/parâmetros do Gemini se necessário

## 📝 Notas Importantes

- **Dados seguros:** Contexto enviado ao Gemini contém apenas dados agregados
- **Fallback automático:** Sistema continua funcionando se n8n cair
- **Custos:** Gemini tem tier gratuito generoso (60 req/min)
- **Performance:** Respostas em ~2-3 segundos (depende da API)
