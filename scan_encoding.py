import os, re, sys

src = r'c:\Users\miran\Desktop\sistemas\src'
exts = ('.tsx', '.ts', '.css', '.js', '.jsx')

# Pattern: any non-ASCII char
pattern = re.compile(r'[^\x00-\x7F\n\r\t]')

found = {}
for root, dirs, files in os.walk(src):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'dist')]
    for fname in files:
        if not fname.endswith(exts):
            continue
        path = os.path.join(root, fname)
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                for lineno, line in enumerate(f, 1):
                    m = pattern.search(line)
                    if m:
                        rel = os.path.relpath(path, src)
                        found.setdefault(rel, []).append((lineno, m.group(0), line.strip()[:80]))
        except Exception as e:
            pass

out_path = r'c:\Users\miran\Desktop\sistemas\encoding_report.txt'
with open(out_path, 'w', encoding='utf-8') as out:
    for fpath, hits in sorted(found.items()):
        out.write(f'\n=== {fpath} ===\n')
        for lineno, char, line in hits[:8]:
            # Show char as its unicode codepoint
            codepoints = [f'U+{ord(c):04X}' for c in char]
            out.write(f'  L{lineno} [{",".join(codepoints)}]: {line[:80]}\n')
        if len(hits) > 8:
            out.write(f'  ... +{len(hits)-8} more lines\n')

    out.write(f'\nTotal files with non-ASCII: {len(found)}\n')

print(f'Report written to: {out_path}')
print(f'Total files: {len(found)}')
