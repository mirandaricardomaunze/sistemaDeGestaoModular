import os, re

src = r'c:\Users\miran\Desktop\sistemas\src'
exts = ('.tsx', '.ts', '.css', '.js', '.jsx')

# ─── Patterns that are DEFINITELY broken ───────────────────────────────────────

# 1. C1 control characters (U+0080–U+009F) — should never appear in UTF-8 source
c1 = re.compile(r'[\x80-\x9f]')

# 2. Latin-1 supplement mojibake sequences — multi-byte artifacts
#    e.g.  Ã© Ã£ Â© â€™  etc.
mojibake = re.compile(
    r'(?:'
    r'Ã[\x80-\xbf]'          # Ã + continuation → Portuguese letter mojibake
    r'|Â[\xa0-\xbf]'         # Â + high byte
    r'|â[€\x80-\x9f].'       # â + euro/control + any → curly quote / dash mojibake
    r'|â\"[€\x80-\xbf]'      # box-drawing mojibake remnants
    r')'
)

# 3. Broken Tailwind class names — non-ASCII inside className="..."
tailwind_bad = re.compile(r'className\s*=\s*["\'{`][^"\'{`\n]*[^\x00-\x7f][^"\'{`\n]*["\'{`]')

# 4. Broken identifier chars — identifier immediately followed by accented char
#    (only code lines, skip pure text / comment lines)
broken_id = re.compile(r'\b([A-Za-z_]\w{2,})([À-ÿ]{1,3})(?=\s*[?:(={,\[\s;])')

# 5. Double-accent artifacts  seráá  Gestáão  etc.
double_accent = re.compile(r'([À-ÿ])\1')

# 6. Corrupted ALL-CAPS words (still contain À Â etc.)
caps_corrupt = re.compile(r'[A-ZÁÉÍÓÚÀÃÂÊÔÕ]{3,}[ÀÂ][A-ZÁÉÍÓÚÀÃÂÊÔÕ€Š"]{1,}')

results = {}

for root, dirs, files in os.walk(src):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'dist')]
    for fname in files:
        if not fname.endswith(exts):
            continue
        path = os.path.join(root, fname)
        rel  = os.path.relpath(path, src)
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()
        except Exception as e:
            results.setdefault(rel, []).append(f'  [READ_ERROR] {e}')
            continue

        for n, line in enumerate(lines, 1):
            issues = []
            stripped = line.strip()
            is_comment = stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*')

            if c1.search(line):
                issues.append(f'C1_CTRL_CHAR')

            if mojibake.search(line):
                issues.append(f'MOJIBAKE')

            tw = tailwind_bad.search(line)
            if tw:
                issues.append(f'BAD_TAILWIND_CLASS: {tw.group(0)[:60]}')

            if not is_comment:
                bi = broken_id.search(line)
                if bi:
                    issues.append(f'BROKEN_IDENT: "{bi.group(0)}"')

            da = double_accent.search(line)
            if da and not is_comment:
                issues.append(f'DOUBLE_ACCENT: "{da.group(0)}"')

            cc = caps_corrupt.search(line)
            if cc:
                issues.append(f'CAPS_CORRUPT: "{cc.group(0)}"')

            if issues:
                results.setdefault(rel, []).append(
                    f'  L{n:4d}  [{" | ".join(issues)}]  {stripped[:90]}'
                )

out = r'c:\Users\miran\Desktop\sistemas\full_audit.txt'
total_issues = 0
with open(out, 'w', encoding='utf-8') as f:
    for rel_path in sorted(results):
        entries = results[rel_path]
        f.write(f'\n=== {rel_path} ({len(entries)} issues) ===\n')
        for e in entries:
            f.write(e + '\n')
        total_issues += len(entries)
    f.write(f'\n\nTOTAL FILES WITH ISSUES : {len(results)}\n')
    f.write(f'TOTAL ISSUE LINES        : {total_issues}\n')

print(f'Files with issues : {len(results)}')
print(f'Total issue lines : {total_issues}')
print(f'Report saved to   : {out}')
