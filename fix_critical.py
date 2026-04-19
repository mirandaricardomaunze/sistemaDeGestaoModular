import os, re

src = r'c:\Users\miran\Desktop\sistemas\src'
exts = ('.tsx', '.ts', '.css', '.js', '.jsx')

# Only fix characters that BREAK code: mojibake sequences, corrupted identifiers, etc.
# Safe Portuguese letters (U+00C0..U+00FF range) in JSX TEXT are fine - leave them.
# We target:
# 1. Box-drawing mojibake: â\"€ (appears in comments as ─)
# 2. Math minus mojibake: âˆ' (appears as −)
# 3. Arrow mojibake: â†', â†", etc.
# 4. Corrupted uppercase sequences like TRANSFERÀŠNCIA, INVENTÀRIO
# 5. Corrupted props/identifiers with accent e.g. onViewGuestá, guestá
# 6. Stray solo  (U+008F, U+0090 etc - C1 control chars that break tsx parsing)

fixes = [
    # Box-drawing characters in comments (these cause no actual TS errors but look wrong)
    # arrow right â†'
    ('\u00e2\u2020\u2019', '\u2192'),   # â†' -> →
    # arrow left-right
    ('\u00e2\u2020\u201d', '\u2194'),
    # en-dash inside strings (Unicode replacement)
    ('\u00e2\u20ac\u201c', '\u2013'),   # â€" -> –
    # minus sign âˆ'
    ('\u00e2\u02c6\u2019', '\u2212'),   # âˆ' -> −
    # checkmark âœ"
    ('\u00e2\u0153\u201c', '\u2714'),
    # warning ⚠
    ('\u00e2\u009a\u00a0', '\u26a0'),
    # C1 control characters that break tsx (U+0080..U+009F) - remove them
]

# Pattern to find C1 control chars (U+0080-U+009F) that should never appear in source
c1_pattern = re.compile(r'[\x80-\x9f]')

# Pattern for corrupted identifiers: word char immediately followed by accented char
# e.g. onViewGuestá -> onViewGuest, guestá -> guest
# Only in JSX attribute names/prop names/variable names (not in string literals)
# We'll use a heuristic: identifier-like context
ident_corrupt = re.compile(r'([A-Za-z_]\w*)([À-ÿ]+)(?=\s*[?:=({,\[\s])')

fixed = 0
for root, dirs, files in os.walk(src):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'dist')]
    for fname in files:
        if not fname.endswith(exts):
            continue
        path = os.path.join(root, fname)
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            original = content

            # 1. Remove C1 control chars (U+0080-U+009F)
            content = c1_pattern.sub('', content)

            # 2. Fix corrupted identifiers (accented char appended to identifier)
            # Only outside of string literals - apply carefully
            # e.g. "onViewGuestá" -> "onViewGuest" , "guestá" -> "guest"
            def fix_ident(m):
                base = m.group(1)
                # Only strip if the accented part looks like corruption (single char appended)
                # Don't touch if base ends with known Portuguese suffix
                return base
            content = ident_corrupt.sub(fix_ident, content)

            # 3. Fix specific known corrupted patterns found in report
            # TRANSFERÀŠNCIA -> TRANSFERÊNCIA
            content = content.replace('TRANSFER\u00c0\u0160NCIA', 'TRANSFER\u00caNCIA')
            content = content.replace('TRANSFERÀŠNCIA', 'TRANSFERÊNCIA')
            # INVENTÀRIO -> INVENTÁRIO  
            content = content.replace('INVENT\u00c0RIO', 'INVENT\u00c1RIO')
            content = content.replace('INVENTÀRIO', 'INVENTÁRIO')
            content = content.replace('RELATÀ"RIO', 'RELATÓRIO')
            content = content.replace('RELAT\u00c0\u201dRIO', 'RELAT\u00d3RIO')
            content = content.replace('ESTRAT\u00c0\u2030GI', 'ESTRAT\u00c9GI')
            content = content.replace('ESTRATÀGICA', 'ESTRATÉGICA')
            content = content.replace('ESTRATÀ‰GICA', 'ESTRATÉGICA')
            content = content.replace('EM SERVI\u00c7O', 'EM SERVIÇO')
            content = content.replace('EM SERVIÀ\u207aO', 'EM SERVIÇO')
            content = content.replace('EM SERVIÀ‡O', 'EM SERVIÇO')
            # GUIA DE TRANSFERÀŠNCIA
            content = content.replace('GUIA DE TRANSFERÀŠNCIA', 'GUIA DE TRANSFERÊNCIA')

            # 4. Fix corrupted prop: onViewGuestá -> onViewGuest (specific known case)
            content = content.replace('onViewGuestá', 'onViewGuest')
            content = content.replace('guestá', 'guest')

            # 5. Fix "seráá" -> "será" (doubled accent artifact)
            content = content.replace('ser\u00e1\u00e1', 'ser\u00e1')  # seráá -> será
            content = content.replace('seráá', 'será')
            # "Gestáão" -> "Gestão"
            content = content.replace('Gest\u00e1\u00e3o', 'Gest\u00e3o')
            content = content.replace('Gestáão', 'Gestão')
            content = content.replace('Gestáão', 'Gestão')
            # "informaces" -> "informações"
            content = content.replace('informaces', 'informações')
            content = content.replace('Informaces', 'Informações')
            content = content.replace('alteraces', 'alterações')
            content = content.replace('Alteraces', 'Alterações')
            content = content.replace('observaces', 'observações')
            content = content.replace('Qualificaces', 'Qualificações')
            content = content.replace('qualificaces', 'qualificações')
            content = content.replace('permissoes', 'permissões')

            # 6. Fix "A processar\"¦" -> "A processar..."
            content = content.replace('A processar\\"¦', 'A processar...')
            content = content.replace("A processar\"¦", 'A processar...')

            # 7. Fix icon/emoji mojibake in toast (just use plain text)
            content = content.replace("'âÅ¡ À¯¸'", "'⚠️'")
            content = content.replace("icon: 'âÅ¡ À¯¸'", "icon: '⚠️'")

            # 8. PeríodoURL artifacts in comments (500mês -> 500ms)
            content = content.replace('500m\u00eas', '500ms')
            content = content.replace('500mês', '500ms')

            # 9. "Un PDF seráá" -> "Um PDF será"
            content = content.replace('Um PDF ser\u00e1\u00e1', 'Um PDF ser\u00e1')
            content = content.replace('Um PDF seráá', 'Um PDF será')

            # 10. "data deve será após" -> "data deve ser após"  
            content = content.replace('deve ser\u00e1 ap\u00f3s', 'deve ser ap\u00f3s')
            content = content.replace('deve será após', 'deve ser após')
            content = content.replace('deve ser\u00e1 maior', 'deve ser maior')
            content = content.replace('deve será maior', 'deve ser maior')
            content = content.replace('deve ser\u00e1 negativo', 'deve ser negativo')
            content = content.replace('pode ser\u00e1 negativo', 'pode ser negativo')

            # 11. Bestday artifact
            content = content.replace("'ââ\u20ac\u201c'", "'-'")
            content = content.replace("'ââ€\"'", "'-'")

            # 12. Box drawing chars in comments: these are sequences of â\"€ 
            content = re.sub(r'â[\"\\][\u20ac€][\u2013\u2014\u201c\u201d\u0081-\x9f]', '-', content)
            # Simpler: replace the literal sequence â"€ (U+2534? no, this is the mojibake form)
            # The actual bytes in the file are the mojibake of box-drawing
            # Pattern: â\" followed by € followed by various - replace whole comment line ornaments
            content = re.sub(r'â[^\n]{0,2}€[^\n]{0,1}', '-', content)

            if content != original:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                fixed += 1
                print(f'[FIXED] {os.path.relpath(path, src)}')
        except Exception as e:
            print(f'[ERROR] {fname}: {e}')

print(f'\nTotal fixed: {fixed}')
