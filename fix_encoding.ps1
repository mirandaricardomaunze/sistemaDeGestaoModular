
# fix_encoding.ps1 - Corrects mojibake characters in all src/ files
Set-StrictMode -Off
$ErrorActionPreference = "Continue"

$srcPath = Join-Path $PSScriptRoot "src"
$extensions = @("*.tsx", "*.ts", "*.css", "*.js", "*.jsx")

# Build replacement table using ASCII-safe escape sequences
$replacements = New-Object System.Collections.Specialized.OrderedDictionary

# Uppercase accented letters (mojibake -> correct UTF-8)
$replacements["Ã\u0087"] = "C"   # C-cedilla upper: Ç  (but keep as plain C for Tailwind safety)
$replacements["Ã\u0083"] = "A"
$replacements["Ã\u0082"] = "A"
$replacements["Ã\u0080"] = "A"
$replacements["Ã\u0089"] = "E"
$replacements["Ã\u008a"] = "E"
$replacements["Ã\u008b"] = "E"
$replacements["Ã\u008e"] = "I"
$replacements["Ã\u0093"] = "O"
$replacements["Ã\u0094"] = "O"
$replacements["Ã\u0095"] = "O"
$replacements["Ã\u0096"] = "O"
$replacements["Ã\u009a"] = "U"
$replacements["Ã\u009b"] = "U"
$replacements["Ã\u009c"] = "U"

# Lowercase accented letters
$replacements["Ã\u00a1"] = "a"   # a-acute: á
$replacements["Ã "]       = "a"   # a-grave: à
$replacements["Ã\u00a3"] = "a"   # a-tilde: ã
$replacements["Ã\u00a2"] = "a"   # a-circumflex: â
$replacements["Ã\u00a4"] = "a"   # a-diaeresis: ä
$replacements["Ã\u00a9"] = "e"   # e-acute: é
$replacements["Ã\u00a8"] = "e"   # e-grave: è
$replacements["Ã\u00aa"] = "e"   # e-circumflex: ê
$replacements["Ã\u00ab"] = "e"   # e-diaeresis: ë
$replacements["Ã\u00ad"] = "i"   # i-acute: í
$replacements["Ã\u00ac"] = "i"   # i-grave: ì
$replacements["Ã\u00ae"] = "i"   # i-circumflex: î
$replacements["Ã\u00af"] = "i"   # i-diaeresis: ï
$replacements["Ã\u00b3"] = "o"   # o-acute: ó
$replacements["Ã\u00b2"] = "o"   # o-grave: ò
$replacements["Ã\u00b5"] = "o"   # o-tilde: õ
$replacements["Ã\u00b4"] = "o"   # o-circumflex: ô
$replacements["Ã\u00b6"] = "o"   # o-diaeresis: ö
$replacements["Ã\u00ba"] = "u"   # u-acute: ú
$replacements["Ã\u00b9"] = "u"   # u-grave: ù
$replacements["Ã\u00bb"] = "u"   # u-circumflex: û
$replacements["Ã\u00bc"] = "u"   # u-diaeresis: ü
$replacements["Ã\u00a7"] = "c"   # c-cedilla: ç
$replacements["Ã\u00b1"] = "n"   # n-tilde: ñ

# Curly quotes and dashes
$replacements["â\u20ac\u2122"] = "'"    # right single quote '
$replacements["â\u20ac\u02dc"] = "'"    # left single quote '
$replacements["â\u20ac\u0153"] = '"'    # left double quote "
$replacements["â\u20ac\u009d"] = '"'    # right double quote "
$replacements["â\u20ac\u201c"] = "-"    # en dash –
$replacements["â\u20ac\u201d"] = "--"   # em dash —
$replacements["â\u20ac\u00a6"] = "..."  # ellipsis …
$replacements["â\u20ac\u008b"] = ""     # zero-width space

# Special symbols
$replacements["Â\u00a9"] = "(c)"  # copyright ©
$replacements["Â\u00ae"] = "(R)"  # registered ®
$replacements["Â\u00b0"] = "deg" # degree °
$replacements["Â\u00b7"] = "."   # middle dot ·
$replacements["Â\u00ba"] = "o"   # masculine ordinal º
$replacements["Â\u00aa"] = "a"   # feminine ordinal ª
$replacements["â\u201a\u00ac"] = "EUR"  # euro sign €
$replacements["Â\u00a3"] = "GBP"  # pound sign £
$replacements["Â\u00a5"] = "JPY"  # yen sign ¥
$replacements["Â\u00a0"] = " "    # non-breaking space

# Stray Â and Ã residuals that appear alone (must be LAST)
$replacements["Â"]  = ""
$replacements["Ã"]  = ""

$files = $extensions | ForEach-Object { Get-ChildItem -Path $srcPath -Recurse -Filter $_ }

$filesFixed = 0

foreach ($file in $files) {
    try {
        $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $content = [System.Text.Encoding]::UTF8.GetString($bytes)
        $original = $content

        foreach ($key in $replacements.Keys) {
            $content = $content -replace [regex]::Escape($key), $replacements[$key]
        }

        if ($content -ne $original) {
            $newBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
            [System.IO.File]::WriteAllBytes($file.FullName, $newBytes)
            $filesFixed++
            Write-Host "[FIXED] $($file.Name)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "[ERROR] $($file.FullName): $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Files fixed: $filesFixed" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
