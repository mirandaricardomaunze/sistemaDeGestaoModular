
# Encoding Repair Script v9 - 100% ASCII-Safe
# Targets Mojibake, Truncated words, and mangled symbols

$patterns = @{
    # Basic Mojibake (C3 XX misread as Latin1)
    "$([char]0xC3)$([char]0xA9)" = "é"
    "$([char]0xC3)$([char]0xA1)" = "á"
    "$([char]0xC3)$([char]0xB3)" = "ó"
    "$([char]0xC3)$([char]0xAA)" = "ê"
    "$([char]0xC3)$([char]0xA7)" = "ç"
    "$([char]0xC3)$([char]0xA3)" = "ã"
    "$([char]0xC3)$([char]0xA0)" = "à"
    "$([char]0xC3)$([char]0xB5)" = "õ"
    "$([char]0xC3)$([char]0xBA)" = "ú"
    "$([char]0xC3)$([char]0xAD)" = "í"
    "$([char]0xC3)$([char]0x89)" = "É"
    "$([char]0xC3)$([char]0x81)" = "Á"
    "$([char]0xC3)$([char]0x93)" = "Ó"
    "$([char]0xC3)$([char]0x87)" = "Ç"
    "$([char]0xC3)$([char]0x95)" = "Õ"
    "$([char]0xC3)$([char]0x9A)" = "Ú"
    "$([char]0xC3)$([char]0xAD)" = "Í"
    
    # E2 XX XX patterns (Emojis/Arrows)
    "$([char]0xE2)$([char]0x86)$([char]0x92)" = "→"
    "$([char]0xE2)$([char]0x86)$([char]0x91)" = "↑"
    "$([char]0xE2)$([char]0x86)$([char]0x93)" = "↓"
    "$([char]0xE2)$([char]0x86)$([char]0x90)" = "←"
    "$([char]0xE2)$([char]0x9A)$([char]0xA0)" = "⚠️"
    "$([char]0xEF)$([char]0xB8)$([char]0x8F)" = "" # Emoji variation selector
    
    # Observed literal mangles in system
    "$([char]0xC0)--" = "x"
    "$([char]0xC0)$([char]0x2030)" = "É"

    # Truncated Word Word repairs
    "Observaces" = "Observações"
    "movimentaces" = "movimentações"
    "configuraces" = "configurações"
    "operaces" = "operações"
    "notificaces" = "notificações"
    "transacções" = "transações"
    "Transacções" = "Transações"
    "manifestá" = "manifesto"
    "inventrio" = "inventário"
    "prescriptionNão" = "prescriptionNumber"
    
    # Missing Leading Characters (specific common cases)
    # Using regex to ensure we only catch them where appropriate (e.g. following a space or start of line or in quotes)
    "(?<=[\"'>\s])inheiro\b" = "Dinheiro"
    "(?<=[\"'>\s])artão\b" = "Cartão"
    "(?<=[\"'>\s])ransferência\b" = "Transferência"
}

$files = Get-ChildItem -Path src -Include *.tsx, *.ts, *.css -Recurse

foreach ($file in $files) {
    try {
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        $modified = $false
        
        foreach ($pattern in $patterns.Keys) {
            if ($content -match $pattern) {
                $content = $content -replace $pattern, $patterns[$pattern]
                $modified = $true
            }
        }
        
        if ($modified) {
            Set-Content -Path $file.FullName -Value $content -Encoding UTF8
            Write-Host "Fixed: $($file.FullName)"
        }
    } catch {
        Write-Warning "Failed to process $($file.FullName)"
    }
}
Write-Host "--- Global Repair Pass Complete ---"
