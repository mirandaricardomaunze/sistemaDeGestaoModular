$srcDir = "c:\Users\miran\Desktop\sistemas\src"

function Repair-File($path) {
    try {
        $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
        $original = $content
        
        # Mapping patterns to their intended characters
        $content = $content -replace "$([char]0xC3)$([char]0xA9)", "$([char]0xE9)" 
        $content = $content -replace "$([char]0xC3)$([char]0xA1)", "$([char]0xE1)" 
        $content = $content -replace "$([char]0xC3)$([char]0xB3)", "$([char]0xF3)" 
        $content = $content -replace "$([char]0xC3)$([char]0xAA)", "$([char]0xEA)" 
        $content = $content -replace "$([char]0xC3)$([char]0xA7)", "$([char]0xE7)" 
        $content = $content -replace "$([char]0xC3)$([char]0xA3)", "$([char]0xE3)" 
        $content = $content -replace "$([char]0xC3)$([char]0xA0)", "$([char]0xE0)" 
        $content = $content -replace "$([char]0xC3)$([char]0xB5)", "$([char]0xF5)" 
        $content = $content -replace "$([char]0xC3)$([char]0xBA)", "$([char]0xFA)" 
        $content = $content -replace "$([char]0xC3)$([char]0xAD)", "$([char]0xED)" 
        $content = $content -replace "$([char]0xC3)$([char]0xA2)", "$([char]0xE2)" 
        
        $content = $content -replace "h$([char]0xE1)$([char]0xA1)", "há" 
        $content = $content -replace "$([char]0xE1)$([char]0xA0)s", "às" 
        
        $content = $content -replace "$([char]0x2D)$([char]0x22)$([char]0x20AC)", "$([char]0x2500)$([char]0x2500)" 
        $content = $content -replace "$([char]0xC3)$([char]0x80)$([char]0x2030)", "$([char]0xC9)" 
        $content = $content -replace "$([char]0xC2)$([char]0xB7)", "$([char]0xB7)" 
        
        # Word-level fixes derived from observations
        $content = $content -replace "Cotaces", "$([char]0x43)ota$([char]0xE7)$([char]0xF5)es" 
        $content = $content -replace "cotaces", "cota$([char]0xE7)$([char]0xF5)es" 
        $content = $content -replace "V$([char]0xE1)lida at:", "V$([char]0xE1)lida at$([char]0xE9):" 
        
        # Arrow and Emoji fixes (using literal patterns from view_file if char codes fail)
        $content = $content -replace "â†'", "$([char]0x2192)" 
        $content = $content -replace "âš ï¸", "$([char]0x26A0)$([char]0xFE0F)" 
        $content = $content -replace "âœ…", "$([char]0x2705)" 
        
        if ($content -ne $original) {
            [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
            Write-Host "Repaired: $path"
        }
    } catch {
        Write-Error "Error processing ${path}: $_"
    }
}

Write-Host "Starting robust global encoding repair (Batch 4)..."
Get-ChildItem -Path $srcDir -Include *.tsx,*.ts,*.css -Recurse | ForEach-Object {
    Repair-File $_.FullName
}
Write-Host "Repair complete."
