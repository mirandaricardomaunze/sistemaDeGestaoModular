import os, re

src = r'c:\Users\miran\Desktop\sistemas\src'
exts = ('.tsx', '.ts', '.css', '.js', '.jsx')

# ─── Pattern 1: Non-ASCII characters inside className="..." attributes ──────────
# Matches: className="...", className={`...`}, className={'...'}, clsx(...), cn(...)
tailwind_class_patterns = [
    re.compile(r'className\s*=\s*"([^"]*[^\x00-\x7F][^"]*)"'),
    re.compile(r"className\s*=\s*'([^']*[^\x00-\x7F][^']*)'"),
    re.compile(r'className\s*=\s*\{`([^`]*[^\x00-\x7F][^`]*)`\}'),
]

# ─── Pattern 2: Mojibake in ANY string (UI labels, toast messages, etc.) ────────
# Standard mojibake sequences
mojibake_seq = re.compile(
    r'(?:'
    r'Ã[\x80-\xbf\u0080-\u00bf]'   # Ã + continuation byte
    r'|Â[\xa0-\xbf\u00a0-\u00bf]'  # Â + high byte
    r'|â[€\x80-\x9f].{0,1}'        # â + euro/control
    r'|[\x80-\x9f]'                 # C1 control characters
    r')'
)

# ─── Pattern 3: Corrupted ALL-CAPS text in JSX ─────────────────────────────────
# e.g. TRANSFERÀŠNCIA, INVENTÀRIO, FORMULÀRIO
caps_corrupt = re.compile(r'[A-ZÁÉÍÓÚÀÂÃÊÔÕÜÇ]{2,}(?:À|Â|Ã)[A-ZÁÉÍÓÚÀÂÃÊÔÕÜÇ€Š"]{1,}')

# ─── Pattern 4: Doubled accent artifacts ────────────────────────────────────────
double_accent = re.compile(r'([áàãâäéèêëíìîïóòõôöúùûüçñ])\1', re.IGNORECASE)

# ─── Pattern 5: Non-ASCII inside Tailwind class names specifically ───────────────
# A Tailwind class is a sequence of non-space chars inside a className
tw_class_token = re.compile(r'(?:className|class)\s*=\s*["\'{`]([^"\'{`\n]+)["\'{`]')
def has_bad_token(class_str):
    tokens = class_str.split()
    for tok in tokens:
        # Each token is a CSS class - should be pure ASCII
        if any(ord(c) > 127 for c in tok):
            return tok
    return None

results = {}   # rel_path -> list of (lineno, category, detail, context)

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
        except Exception:
            continue

        for n, line in enumerate(lines, 1):
            stripped = line.strip()
            is_comment = stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*')

            hits = []

            # 1. Non-ASCII inside className
            for pat in tailwind_class_patterns:
                m = pat.search(line)
                if m:
                    bad_tok = has_bad_token(m.group(1))
                    if bad_tok:
                        hits.append(('TAILWIND_CLASS', f'bad token: "{bad_tok}"'))

            # 2. Mojibake sequences
            mj = mojibake_seq.search(line)
            if mj:
                hits.append(('MOJIBAKE', f'"{mj.group(0)[:20]}"'))

            # 3. Corrupted ALL-CAPS
            if not is_comment:
                cc = caps_corrupt.search(line)
                if cc:
                    hits.append(('CAPS_CORRUPT', f'"{cc.group(0)[:30]}"'))

            # 4. Double accent
            if not is_comment:
                da = double_accent.search(stripped)
                if da and len(stripped) < 200:
                    hits.append(('DOUBLE_ACCENT', f'"{da.group(0)}"'))

            # 5. Any non-ASCII in Tailwind class tokens (broader check)
            tw = tw_class_token.search(line)
            if tw:
                bad = has_bad_token(tw.group(1))
                if bad:
                    # Avoid duplicate with check #1
                    already = any(h[0] == 'TAILWIND_CLASS' for h in hits)
                    if not already:
                        hits.append(('TAILWIND_TOKEN', f'bad: "{bad}"'))

            if hits:
                for cat, detail in hits:
                    results.setdefault(rel, []).append(
                        (n, cat, detail, stripped[:100])
                    )

# ─── Write report ────────────────────────────────────────────────────────────────
out = r'c:\Users\miran\Desktop\sistemas\tailwind_ui_audit.txt'
total_issues = 0
tailwind_issues = 0
mojibake_issues = 0
caps_issues = 0
other_issues = 0

with open(out, 'w', encoding='utf-8') as f:
    f.write('=' * 80 + '\n')
    f.write('TAILWIND CLASS & UI TEXT CHARACTER AUDIT\n')
    f.write('=' * 80 + '\n\n')

    for rel_path in sorted(results):
        entries = results[rel_path]
        f.write(f'\n┌─ {rel_path} ({len(entries)} issue(s))\n')
        for lineno, cat, detail, ctx in entries:
            f.write(f'│  L{lineno:4d}  [{cat}]  {detail}\n')
            f.write(f'│         → {ctx[:95]}\n')
            total_issues += 1
            if 'TAILWIND' in cat: tailwind_issues += 1
            elif cat == 'MOJIBAKE': mojibake_issues += 1
            elif cat == 'CAPS_CORRUPT': caps_issues += 1
            else: other_issues += 1
        f.write('└' + '─' * 78 + '\n')

    f.write('\n\n' + '=' * 80 + '\n')
    f.write('SUMMARY\n')
    f.write('=' * 80 + '\n')
    f.write(f'Files with issues        : {len(results)}\n')
    f.write(f'Total issues             : {total_issues}\n')
    f.write(f'  TAILWIND class issues  : {tailwind_issues}\n')
    f.write(f'  MOJIBAKE sequences     : {mojibake_issues}\n')
    f.write(f'  CAPS corrupted         : {caps_issues}\n')
    f.write(f'  OTHER (double accent)  : {other_issues}\n')

print(f'Files with issues        : {len(results)}')
print(f'Total issues             : {total_issues}')
print(f'  TAILWIND class issues  : {tailwind_issues}')
print(f'  MOJIBAKE sequences     : {mojibake_issues}')
print(f'  CAPS corrupted         : {caps_issues}')
print(f'  OTHER                  : {other_issues}')
print(f'Report: {out}')
