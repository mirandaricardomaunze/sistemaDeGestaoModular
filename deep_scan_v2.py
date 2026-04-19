"""
deep_scan_v2.py  -  Scanner preciso: so detecta bytes REALMENTE corrompidos.
Emojis, box-drawing chars e portugueses validos sao aceites.
"""
import os, re

SRC  = r'c:\Users\miran\Desktop\sistemas\src'
EXTS = ('.tsx', '.ts', '.css', '.js', '.jsx')

# ─── Helpers ──────────────────────────────────────────────────────────────────

def is_valid_utf8(data: bytes) -> bool:
    try:
        data.decode('utf-8')
        return True
    except UnicodeDecodeError:
        return False

def find_invalid_bytes(data: bytes):
    """
    Encontra posicoes de bytes que NAO fazem parte de sequencias UTF-8 validas.
    Retorna lista de (byte_offset, hex_byte).
    """
    bad = []
    i = 0
    while i < len(data):
        b = data[i]
        if b < 0x80:
            i += 1
        elif 0xC2 <= b <= 0xDF and i+1 < len(data) and 0x80 <= data[i+1] <= 0xBF:
            i += 2
        elif b == 0xE0 and i+2 < len(data) and 0xA0 <= data[i+1] <= 0xBF and 0x80 <= data[i+2] <= 0xBF:
            i += 3
        elif 0xE1 <= b <= 0xEC and i+2 < len(data) and 0x80 <= data[i+1] <= 0xBF and 0x80 <= data[i+2] <= 0xBF:
            i += 3
        elif b == 0xED and i+2 < len(data) and 0x80 <= data[i+1] <= 0x9F and 0x80 <= data[i+2] <= 0xBF:
            i += 3
        elif 0xEE <= b <= 0xEF and i+2 < len(data) and 0x80 <= data[i+1] <= 0xBF and 0x80 <= data[i+2] <= 0xBF:
            i += 3
        elif b == 0xF0 and i+3 < len(data) and 0x90 <= data[i+1] <= 0xBF and 0x80 <= data[i+2] <= 0xBF and 0x80 <= data[i+3] <= 0xBF:
            i += 4
        elif 0xF1 <= b <= 0xF3 and i+3 < len(data) and 0x80 <= data[i+1] <= 0xBF and 0x80 <= data[i+2] <= 0xBF and 0x80 <= data[i+3] <= 0xBF:
            i += 4
        elif b == 0xF4 and i+3 < len(data) and 0x80 <= data[i+1] <= 0x8F and 0x80 <= data[i+2] <= 0xBF and 0x80 <= data[i+3] <= 0xBF:
            i += 4
        else:
            bad.append((i, hex(b)))
            i += 1
    return bad

def byte_offset_to_line(data: bytes, offset: int) -> int:
    return data[:offset].count(b'\n') + 1

# ─── Mojibake SEQUENCE patterns (invalid even in valid UTF-8) ─────────────────
# These sequences ARE valid UTF-8 but represent WRONG characters (mojibake):
# e.g. U+00C3 U+00A9 = "Ã©" which is é misread  
MOJIBAKE_SEQS = [
    # Ã + latin supplement continuation (double-encoded portuguese chars)
    (re.compile(r'Ã[©«ª®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]'), 'mojibake Ã+char'),
    # Â + latin supplement (non-breaking space and others as mojibake)
    (re.compile(r'Â[©®°·ºª£¥¡¿«»½¼¾]'), 'mojibake Â+symbol'),
    # double-encoded: seráá  (two accented chars repeated)
    (re.compile(r'([àáâãäåèéêëìíîïòóôõöùúûüýÿ])\1'), 'double accent (e.g. seráá)'),
    # stray Â or Ã before whitespace/punctuation (not part of valid word)
    (re.compile(r'(?<!\w)[ÂÃ](?=\s|[",;:\'`(){}\[\]<>!?\-/\\|@#$%^&*+=~])'), 'stray Â/Ã char'),
]

# ─── Corrupted ALL-CAPS (À before consonant = wrong) ─────────────────────────
# FORMULÀRIO = wrong (should be FORMULÁRIO)
# But ATENÇÃO, CONFIRMAÇÃO = correct (Ã is expected after Ç in ÃO)
CAPS_WRONG = re.compile(
    r'[A-ZÁÉÍÓÚÇÊÔ]{2,}'  # 2+ uppercase letters
    r'À'                    # followed by À (U+00C0, a-grave)
    r'(?=[A-Z])'            # followed by uppercase consonant
)
# Except valid patterns: ÀS (= "às"), ÀO not after Ç (= wrong)
BAD_AO = re.compile(r'(?<![ÇçGgLlNnSs])ÀO')  # ÀO not preceded by Ç/G/L/N/S = mojibake

# ─── Non-ASCII in Tailwind class tokens ──────────────────────────────────────
TW_ATTRS = re.compile(r'(?:className|class)\s*=\s*(?:"([^"\n]*)"|\'([^\'\n]*)\'|`([^`\n]*)`|\{`([^`\n]*)`\})')

def bad_tw_tokens(s: str):
    bad = []
    for tok in re.split(r'\s+', s):
        tok = re.sub(r'\$\{[^}]*\}', '', tok).strip()
        if tok and any(ord(c) > 127 for c in tok):
            bad.append(tok)
    return bad

# ─── Main scan ────────────────────────────────────────────────────────────────
results = {}

for root, dirs, files in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'dist')]
    for fname in files:
        if not fname.endswith(EXTS):
            continue
        path = os.path.join(root, fname)
        rel  = os.path.relpath(path, SRC)
        issues = []

        # 1. Invalid UTF-8 bytes
        with open(path, 'rb') as f:
            raw = f.read()
        for offset, hexb in find_invalid_bytes(raw):
            lineno = byte_offset_to_line(raw, offset)
            issues.append((lineno, 'INVALID_UTF8_BYTE', hexb))

        # 2. Text-level checks (only if file is valid UTF-8)
        if is_valid_utf8(raw):
            text = raw.decode('utf-8')
            lines = text.splitlines()
            for n, line in enumerate(lines, 1):
                is_comment = line.strip().startswith('//') or line.strip().startswith('*')

                # Mojibake sequences
                for pat, label in MOJIBAKE_SEQS:
                    m = pat.search(line)
                    if m:
                        ctx = m.group(0)[:30]
                        issues.append((n, f'MOJIBAKE ({label})', f'"{ctx}"'))
                        break

                # Bad ALL-CAPS with À before consonant
                bm = CAPS_WRONG.search(line)
                if bm:
                    issues.append((n, 'CAPS_CORRUPT (À+consonant)', f'"{bm.group(0)[:25]}"'))

                # Non-ASCII in Tailwind tokens
                for m in TW_ATTRS.finditer(line):
                    class_str = next(g for g in m.groups() if g is not None)
                    bad = bad_tw_tokens(class_str)
                    for tok in bad:
                        issues.append((n, 'TAILWIND_NON_ASCII', f'"{tok[:40]}"'))

        if issues:
            results[rel] = issues

# ─── Report ───────────────────────────────────────────────────────────────────
report_path = r'c:\Users\miran\Desktop\sistemas\deep_scan_v2_report.txt'
total = 0
cats  = {}
with open(report_path, 'w', encoding='utf-8') as out:
    out.write('DEEP SCAN v2 REPORT\n' + '='*80 + '\n\n')
    for rel in sorted(results):
        entries = results[rel]
        out.write(f'\n+-- {rel} ({len(entries)} issue(s))\n')
        for lineno, cat, detail in entries:
            out.write(f'|   L{lineno:5d}  [{cat}]  {detail}\n')
            cats[cat] = cats.get(cat, 0) + 1
            total += 1
        out.write('+' + '-'*78 + '\n')
    out.write('\n\nSUMMARY\n' + '='*80 + '\n')
    out.write(f'Files with issues : {len(results)}\n')
    out.write(f'Total issues      : {total}\n')
    for cat, cnt in sorted(cats.items()):
        out.write(f'  {cat:<50s}: {cnt}\n')

print(f'Files with issues : {len(results)}')
print(f'Total issues      : {total}')
if total == 0:
    print('ZERO ISSUES - system is clean!')
else:
    print(f'Report >> {report_path}')
