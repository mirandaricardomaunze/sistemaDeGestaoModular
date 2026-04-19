
# Encoding Repair Script v10 - Robust & Safe
$patterns = @(
    # Format: @{s="search_regex"; r="replacement"}
    # Mojibake C3 patterns
    @{s=[regex]::Escape("$([char]0xC3)$([char]0xA9)"); r="é"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0xA1)"); r="á"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0xB3)"); r="ó"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0xAA)"); r="ê"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0xA7)"); r="ç"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0xA3)"); r="ã"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0xA0)"); r="à"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0xB5)"); r="õ"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0xBA)"); r="ú"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0xAD)"); r="í"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0x89)"); r="É"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0x81)"); r="Á"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0x93)"); r="Ó"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0x87)"); r="Ç"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0x95)"); r="Õ"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0x9A)"); r="Ú"},
    @{s=[regex]::Escape("$([char]0xC3)$([char]0xAD)"); r="Í"},
    
    # Arrows and Emojis
    @{s=[regex]::Escape("$([char]0xE2)$([char]0x86)$([char]0x92)"); r="→"},
    @{s=[regex]::Escape("$([char]0xE2)$([char]0x86)$([char]0x91)"); r="↑"},
    @{s=[regex]::Escape("$([char]0xE2)$([char]0x86)$([char]0x93)"); r="↓"},
    @{s=[regex]::Escape("$([char]0xE2)$([char]0x86)$([char]0x90)"); r="←"},
    @{s=[regex]::Escape("$([char]0xE2)$([char]0x9A)$([char]0xA0)"); r="⚠️"},
    
    # Specific Mangles
    @{s=[regex]::Escape("$([char]0xC0)--"); r="x"},
    @{s="Observaces"; r="Observações"},
    @{s="movimentaces"; r="movimentações"},
    @{s="configuraces"; r="configurações"},
    @{s="operaces"; r="operações"},
    @{s="notificaces"; r="notificações"},
    @{s="transacções"; r="transações"},
    @{s="Transacções"; r="Transações"},
    @{s="manifestá"; r="manifesto"},
    @{s="inventrio"; r="inventário"},
    @{s="prescriptionNão"; r="prescriptionNumber"},

    # Restoring missing first letters in payment labels
    @{s="(?<=[ '`">])inheiro\b"; r="Dinheiro"},
    @{s="(?<=[ '`">])artão\b"; r="Cartão"},
    @{s="(?<=[ '`">])ransferência\b"; r="Transferência"}
)

$files = Get-ChildItem -Path src -Include *.tsx, *.ts, *.css -Recurse

foreach ($file in $files) {
    try {
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $modified = $false
        
        foreach ($p in $patterns) {
            if ($content -match $p.s) {
                $content = [regex]::Replace($content, $p.s, $p.r)
                $modified = $true
            }
        }
        
        if ($modified) {
            [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Success: $($file.FullName)"
        }
    } catch {
        Write-Warning "Skipped: $($file.FullName)"
    }
}
Write-Host "Cleanup Complete."
