"""
deep_scan.py  –  Detecção precisa de caracteres corrompidos no projecto Multicore
Elimina falsos positivos: palavras portuguesas válidas (AÇÃO, ATENÇÃO…) são aceites.
Corre em loop até resultado = 0 issues.
"""
import os, re, sys

SRC   = r'c:\Users\miran\Desktop\sistemas\src'
EXTS  = ('.tsx', '.ts', '.css', '.js', '.jsx')

# ─── 1. Bytes proibidos ────────────────────────────────────────────────────────
# C1 control characters (U+0080–U+009F): jamais devem estar em UTF-8 puro
# Exemplo: \x8f \x9c \x9d  (os que apareceram antes)
C1_BYTE_PATTERN = re.compile(rb'[\x80-\x9f](?![\x80-\xbf])')  # C1 solto (não parte de seq multibyte válida)

# ─── 2. Sequências mojibake clássicas (bytes, não texto) ──────────────────────
# Estas são sequências que NÃO ocorrem em português válido:
MOJIBAKE_BYTES_CLEAN = [
    (rb'\xc3\xa3\x83',   'Ãã mojibake triplo'),
    (rb'\xc3\x83\xc2',   'Ã+Â mojibake'),
    (rb'\xc3\x82\xc2',   'Â duplo mojibake'),
    (rb'\xe2\x80\x9c',   'left curly quote "'),
    (rb'\xe2\x80\x9d',   'right curly quote "'),
    (rb'\xe2\x80\x99',   'right single quote \u2019'),
    (rb'\xc2\xa0',       'non-breaking space NBSP'),
]

# ─── 3. Padrões de texto (após decode UTF-8) ─────────────────────────────────
# 3a. Não-ASCII POR DENTRO de className tokens Tailwind
TW_ATTR = re.compile(r'(?:className|class)\s*=\s*["\'{`]([^"\'{`\n]*)["\'{`]')

def tailwind_bad_tokens(class_str: str):
    """Devolve os tokens Tailwind com chars não-ASCII."""
    bad = []
    for tok in class_str.split():
        # Remove template expressions {…}
        tok_clean = re.sub(r'\$\{[^}]*\}', '', tok)
        if any(ord(c) > 127 for c in tok_clean):
            bad.append(tok[:40])
    return bad

# 3b. Padrões de texto corrompido ESPECÍFICOS (não bate em português válido)
#   - Letra MAIÚSCULA seguida de À + letra maiúscula — onde À não é esperado
#     Ex: FORMULÀRIO → errado (deveria ser FORMULÁRIO com Á)
#         INVENTÀRIO → errado
#         GUIA DE TRANSFERÀŠNCIA → errado
#   - Mas ATENÇÃO, CONFIRMAÇÃO, AÇÃO → correctos (À ou Ã é parte natural)
# Heurística: À antes de R, L, M, N, S (exceto nos sufixos ÃO, ÃES) é suspeito
BAD_CAPS = re.compile(
    r'(?<![ÇçGgNnLlSsDd])'   # não precedido de letra de diacrítico normal
    r'À'
    r'(?=[RMLBDPFGHJKQWXYZ])'  # seguido de CONSOANTE não esperada após À
)
# Duplo acento: qualquer vogal acentuada repetida (seráá, Gestáão)
DOUBLE_ACCENT = re.compile(r'([\u00c0-\u00ff])\1')

# Stray Â ou Ã soltos (sem formar sequência válida)
STRAY_A_TILDE = re.compile(r'(?<!\w)[ÂÃ](?=[\s"\',;(){}\[\]<>]|$)')

# ─── Runners ──────────────────────────────────────────────────────────────────

def scan_file_bytes(path: str):
    """Retorna lista de (lineno, tipo, hex_snippet) para problemas a nível de bytes."""
    issues = []
    with open(path, 'rb') as f:
        raw = f.read()
    lines = raw.split(b'\n')
    for n, line in enumerate(lines, 1):
        # C1 check
        m = C1_BYTE_PATTERN.search(line)
        if m:
            issues.append((n, 'C1_CTRL', line[max(0,m.start()-5):m.end()+5].hex()))
        # Mojibake byte sequences
        for pat, label in MOJIBAKE_BYTES_CLEAN:
            if pat in line:
                issues.append((n, f'MOJIBAKE_{label.upper().replace(" ","_")}',
                               line[line.index(pat):line.index(pat)+12].hex()))
    return issues

def scan_file_text(path: str):
    """Retorna lista de (lineno, tipo, snippet) para problemas a nível de texto."""
    issues = []
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()
    except Exception:
        return issues

    for n, line in enumerate(lines, 1):
        stripped = line.strip()
        is_comment = stripped.startswith('//') or stripped.startswith('*')

        # 1. Tailwind class tokens com não-ASCII
        for m in TW_ATTR.finditer(line):
            bad = tailwind_bad_tokens(m.group(1))
            for tok in bad:
                issues.append((n, 'TAILWIND_BAD_TOKEN', f'"{tok}"'))

        # 2. ALL-CAPS com À antes de consoante inesperada (e.g. FORMULÀRIO, INVENTÀRIO)
        bm = BAD_CAPS.search(line)
        if bm:
            ctx = line[max(0,bm.start()-8):bm.end()+8].strip()
            issues.append((n, 'CAPS_CORRUPT_À+CONSONANT', f'"{ctx}"'))

        # 3. Duplo acento
        if not is_comment:
            da = DOUBLE_ACCENT.search(stripped)
            if da:
                issues.append((n, 'DOUBLE_ACCENT', f'"{da.group(0)}"'))

        # 4. Stray Â ou Ã soltos no meio do código
        if not is_comment:
            sa = STRAY_A_TILDE.search(line)
            if sa:
                ctx = line[max(0,sa.start()-5):sa.end()+5].strip()
                issues.append((n, 'STRAY_TILDE_CHAR', f'"{ctx}"'))

    return issues


def run_scan():
    results = {}
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'dist')]
        for fname in files:
            if not fname.endswith(EXTS):
                continue
            path = os.path.join(root, fname)
            rel  = os.path.relpath(path, SRC)
            byte_issues = scan_file_bytes(path)
            text_issues = scan_file_text(path)
            all_issues  = byte_issues + text_issues
            if all_issues:
                results[rel] = all_issues

    # Report
    report_path = r'c:\Users\miran\Desktop\sistemas\deep_scan_report.txt'
    total = 0
    cats  = {}
    with open(report_path, 'w', encoding='utf-8') as out:
        out.write('DEEP SCAN REPORT\n' + '='*80 + '\n\n')
        for rel in sorted(results):
            entries = results[rel]
            out.write(f'\n┌─ {rel} ({len(entries)} issue(s))\n')
            for lineno, cat, detail in entries:
                out.write(f'│  L{lineno:5d}  [{cat}]  {detail}\n')
                cats[cat] = cats.get(cat, 0) + 1
                total += 1
            out.write('└' + '─'*78 + '\n')
        out.write('\n\nSUMMARY\n' + '='*80 + '\n')
        out.write(f'Files with issues: {len(results)}\n')
        out.write(f'Total issues     : {total}\n')
        for cat, cnt in sorted(cats.items()):
            out.write(f'  {cat:<40s}: {cnt}\n')

    return total, results, report_path


if __name__ == '__main__':
    print('Running deep scan...')
    total, results, report = run_scan()
    print(f'\nFiles with issues : {len(results)}')
    print(f'Total issues      : {total}')
    if total == 0:
        print('\n✅ ZERO ISSUES — system is clean!')
    else:
        print(f'\nReport >> {report}')
