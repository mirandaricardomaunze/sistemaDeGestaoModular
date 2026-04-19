$files = Get-ChildItem -Path src -Filter *.tsx -Recurse

$replacements = @{
    "Frias" = "Férias"
    "Observaes" = "Observações"
    "ser" = "será"
    "Incio" = "Início"
    "Prximas" = "Próximas"
    "No" = "Não"
    "ms" = "mês"
    "est" = "está"
    "at" = "até"
    "voc" = "você"
    "configuraes" = "configurações"
    "situao" = "situação"
    "relao" = "relação"
    "verificao" = "verificação"
    "aces" = "ações"
}

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $changed = $false
    
    foreach ($key in $replacements.Keys) {
        if ($content -like "*$key*") {
            $content = $content.Replace($key, $replacements[$key])
            $changed = $true
        }
    }
    
    if ($changed) {
        Write-Host "Fixing accents in: $($file.Name)"
        [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
    }
}
