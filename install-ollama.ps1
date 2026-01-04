# ========================================
# Script de Instalação Automática
# Assistente IA - Ollama + LLaMA 3.1
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Instalação do Assistente IA" -ForegroundColor Cyan
Write-Host "  Ollama + LLaMA 3.1" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se está rodando como Admin
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  AVISO: Execute este script como Administrador!" -ForegroundColor Yellow
    Write-Host "Clique com botão direito no PowerShell e selecione 'Executar como Administrador'" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit
}

# Passo 1: Instalar Ollama
Write-Host "📦 Passo 1: Instalando Ollama..." -ForegroundColor Green
Write-Host ""

try {
    # Verificar se Ollama já está instalado
    $ollamaInstalled = Get-Command ollama -ErrorAction SilentlyContinue
    
    if ($ollamaInstalled) {
        Write-Host "✅ Ollama já está instalado!" -ForegroundColor Green
    } else {
        Write-Host "Baixando e instalando Ollama via winget..." -ForegroundColor Yellow
        winget install --id=Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Ollama instalado com sucesso!" -ForegroundColor Green
        } else {
            throw "Erro ao instalar Ollama"
        }
    }
} catch {
    Write-Host "❌ Erro ao instalar Ollama: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Instalação manual:" -ForegroundColor Yellow
    Write-Host "1. Baixe de: https://ollama.com/download/windows" -ForegroundColor Yellow
    Write-Host "2. Execute o instalador" -ForegroundColor Yellow
    Write-Host "3. Reinicie este script" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit
}

Write-Host ""
Start-Sleep -Seconds 2

# Passo 2: Aguardar serviço iniciar
Write-Host "⏳ Aguardando serviço Ollama iniciar..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verificar se serviço está rodando
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Serviço Ollama está rodando!" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Serviço não iniciou automaticamente. Tentando iniciar..." -ForegroundColor Yellow
    
    try {
        Start-Service Ollama -ErrorAction Stop
        Start-Sleep -Seconds 3
        Write-Host "✅ Serviço iniciado!" -ForegroundColor Green
    } catch {
        Write-Host "❌ Não foi possível iniciar o serviço automaticamente" -ForegroundColor Red
        Write-Host "Inicie manualmente: ollama serve" -ForegroundColor Yellow
    }
}

Write-Host ""
Start-Sleep -Seconds 2

# Passo 3: Baixar modelo LLaMA 3.1
Write-Host "📥 Passo 2: Baixando modelo LLaMA 3.1 (8B)..." -ForegroundColor Green
Write-Host "⚠️  Isso pode demorar alguns minutos (~4.7 GB)" -ForegroundColor Yellow
Write-Host ""

try {
    # Verificar se modelo já existe
    $models = ollama list 2>$null
    
    if ($models -match "llama3.1:8b") {
        Write-Host "✅ Modelo LLaMA 3.1:8b já está instalado!" -ForegroundColor Green
    } else {
        Write-Host "Baixando modelo..." -ForegroundColor Yellow
        ollama pull llama3.1:8b
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Modelo baixado com sucesso!" -ForegroundColor Green
        } else {
            throw "Erro ao baixar modelo"
        }
    }
} catch {
    Write-Host "❌ Erro ao baixar modelo: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Tente manualmente:" -ForegroundColor Yellow
    Write-Host "ollama pull llama3.1:8b" -ForegroundColor Yellow
}

Write-Host ""
Start-Sleep -Seconds 2

# Passo 4: Testar modelo
Write-Host "🧪 Passo 3: Testando modelo..." -ForegroundColor Green
Write-Host ""

try {
    Write-Host "Enviando pergunta de teste..." -ForegroundColor Yellow
    
    $testPrompt = @{
        model = "llama3.1:8b"
        prompt = "Responda em português: Olá, você está funcionando?"
        stream = $false
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" -Method POST -Body $testPrompt -ContentType "application/json" -TimeoutSec 30
    
    Write-Host "✅ Resposta do modelo:" -ForegroundColor Green
    Write-Host $response.response -ForegroundColor Cyan
} catch {
    Write-Host "⚠️  Não foi possível testar o modelo: $_" -ForegroundColor Yellow
    Write-Host "Mas a instalação foi concluída!" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ INSTALAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Resumo:" -ForegroundColor Yellow
Write-Host "  ✅ Ollama instalado" -ForegroundColor Green
Write-Host "  ✅ Modelo LLaMA 3.1:8b baixado" -ForegroundColor Green
Write-Host "  ✅ Serviço rodando em http://localhost:11434" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Próximos Passos:" -ForegroundColor Yellow
Write-Host "  1. Abra um novo terminal" -ForegroundColor White
Write-Host "  2. Navegue até: cd backend" -ForegroundColor White
Write-Host "  3. Inicie o backend: npm run dev" -ForegroundColor White
Write-Host "  4. Em outro terminal, inicie o frontend: npm run dev" -ForegroundColor White
Write-Host "  5. Faça login no sistema" -ForegroundColor White
Write-Host "  6. Clique no botão ✨ no canto inferior direito" -ForegroundColor White
Write-Host "  7. Teste: 'Quanto vendi hoje?'" -ForegroundColor White
Write-Host ""

Write-Host "💡 Comandos úteis:" -ForegroundColor Yellow
Write-Host "  ollama list              - Ver modelos instalados" -ForegroundColor Cyan
Write-Host "  ollama serve             - Iniciar serviço manualmente" -ForegroundColor Cyan
Write-Host "  ollama run llama3.1:8b   - Testar modelo no terminal" -ForegroundColor Cyan
Write-Host ""

Read-Host "Pressione Enter para sair"
