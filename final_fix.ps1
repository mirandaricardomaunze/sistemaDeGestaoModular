$mappings = @{
    "Ã³" = "ó"; "Ã£" = "ã"; "Ã§" = "ç"; "Ã¡" = "á"; "Ã©" = "é"; "Ãº" = "ú"; "Ã­" = "í"; "Ãµ" = "õ";
    "Ã¢" = "â"; "Ãª" = "ê"; "Ã´" = "ô"; "Ã " = "à"; "Ã€" = "À"; "Ã‰" = "É"; "Ã“" = "Ó"; "Ãš" = "Ú";
    "Ã‚" = "Â"; "ÃŠ" = "Ê"; "Ã”" = "Ô"; "Ã‡" = "Ç"; "Ãƒ" = "Ã"; "Ã—" = "×"; "â€¢" = "•";
    "âœ…" = "✅"; "âš ï¸ " = "⚠️"; "ðŸš€" = "🚀"; "ðŸ“–" = "📖"; "â Œ" = "❌"; "ðŸ’¡" = "💡"
}

$files = Get-ChildItem -Path "src", "backend/src" -Recurse -File -Include "*.ts", "*.tsx", "*.json", "*.md"

foreach ($file in $files) {
    try {
        $content = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
        $changed = $false
        foreach ($key in $mappings.Keys) {
            if ($content.Contains($key)) {
                $content = $content.Replace($key, $mappings[$key])
                $changed = $true
            }
        }
        if ($changed) {
            Write-Host "Restoring characters in: $($file.FullName)"
            [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
        }
    } catch {
        Write-Warning "Failed to process $($file.FullName): $($_.Exception.Message)"
    }
}
Write-Host "Complete!"
