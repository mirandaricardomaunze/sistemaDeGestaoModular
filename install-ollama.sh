#!/bin/bash

# ========================================
# Script de Instalação Automática
# Assistente IA - Ollama + LLaMA 3.1
# Para Linux/Mac
# ========================================

echo "========================================"
echo "  Instalação do Assistente IA"
echo "  Ollama + LLaMA 3.1"
echo "========================================"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Passo 1: Instalar Ollama
echo -e "${GREEN}📦 Passo 1: Instalando Ollama...${NC}"
echo ""

if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✅ Ollama já está instalado!${NC}"
else
    echo -e "${YELLOW}Baixando e instalando Ollama...${NC}"
    curl -fsSL https://ollama.com/install.sh | sh
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Ollama instalado com sucesso!${NC}"
    else
        echo -e "${RED}❌ Erro ao instalar Ollama${NC}"
        exit 1
    fi
fi

echo ""
sleep 2

# Passo 2: Iniciar serviço
echo -e "${YELLOW}⏳ Iniciando serviço Ollama...${NC}"
ollama serve &
OLLAMA_PID=$!
sleep 5

# Verificar se está rodando
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo -e "${GREEN}✅ Serviço Ollama está rodando!${NC}"
else
    echo -e "${RED}❌ Serviço não iniciou${NC}"
    exit 1
fi

echo ""
sleep 2

# Passo 3: Baixar modelo
echo -e "${GREEN}📥 Passo 2: Baixando modelo LLaMA 3.1 (8B)...${NC}"
echo -e "${YELLOW}⚠️  Isso pode demorar alguns minutos (~4.7 GB)${NC}"
echo ""

if ollama list | grep -q "llama3.1:8b"; then
    echo -e "${GREEN}✅ Modelo LLaMA 3.1:8b já está instalado!${NC}"
else
    echo -e "${YELLOW}Baixando modelo...${NC}"
    ollama pull llama3.1:8b
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Modelo baixado com sucesso!${NC}"
    else
        echo -e "${RED}❌ Erro ao baixar modelo${NC}"
        exit 1
    fi
fi

echo ""
sleep 2

# Passo 4: Testar
echo -e "${GREEN}🧪 Passo 3: Testando modelo...${NC}"
echo ""

TEST_RESPONSE=$(curl -s -X POST http://localhost:11434/api/generate \
    -H "Content-Type: application/json" \
    -d '{
        "model": "llama3.1:8b",
        "prompt": "Responda em português: Olá, você está funcionando?",
        "stream": false
    }')

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Modelo funcionando!${NC}"
    echo -e "${CYAN}Resposta: $(echo $TEST_RESPONSE | jq -r '.response')${NC}"
else
    echo -e "${YELLOW}⚠️  Não foi possível testar o modelo${NC}"
fi

echo ""
echo "========================================"
echo -e "${GREEN}  ✅ INSTALAÇÃO CONCLUÍDA!${NC}"
echo "========================================"
echo ""

echo -e "${YELLOW}📋 Resumo:${NC}"
echo -e "${GREEN}  ✅ Ollama instalado${NC}"
echo -e "${GREEN}  ✅ Modelo LLaMA 3.1:8b baixado${NC}"
echo -e "${GREEN}  ✅ Serviço rodando em http://localhost:11434${NC}"
echo ""

echo -e "${YELLOW}🚀 Próximos Passos:${NC}"
echo "  1. Abra um novo terminal"
echo "  2. Navegue até: cd backend"
echo "  3. Inicie o backend: npm run dev"
echo "  4. Em outro terminal, inicie o frontend: npm run dev"
echo "  5. Faça login no sistema"
echo "  6. Clique no botão ✨ no canto inferior direito"
echo "  7. Teste: 'Quanto vendi hoje?'"
echo ""

echo -e "${YELLOW}💡 Comandos úteis:${NC}"
echo -e "${CYAN}  ollama list              - Ver modelos instalados${NC}"
echo -e "${CYAN}  ollama serve             - Iniciar serviço manualmente${NC}"
echo -e "${CYAN}  ollama run llama3.1:8b   - Testar modelo no terminal${NC}"
echo ""
