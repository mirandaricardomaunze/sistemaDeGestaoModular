import os, re

src = r'c:\Users\miran\Desktop\sistemas\src'

fixes_per_file = {
    r'components\employees\EmployeesDashboard.tsx': [
        # sort arrows mojibake: 'â" "˜' and 'â" "' -> '▲' and '▼'
        ("â\" \"˜", '▲'),
        ("â\" \"",  '▼'),
        ("â\"˜",    '▲'),
        # broader fallback
    ],
    r'components\hospitality\HospitalityDashboard.tsx': [
        ("'ââ\u201a\u00ac\"'", "'-'"),
        ("'ââ€\"'",            "'-'"),
        # double-â artifacts -> en-dash then quote
        ("ââ\u201a\u00ac\"",   "-"),
        ("ââ€\"",              "-"),
    ],
    r'components\pharmacy\hr\PharmacyHRDashboard.tsx': [
        # 'ATENÀ‡ÀƒO'  -> 'ATENÇÃO'
        ('ATEN\u00c0\u2021\u00c0\u0192O', 'ATENÇÃO'),
        ('ATEN\u00c0\u2021\u00c0O',       'ATENÇÃO'),
        ('ATENÀ‡ÀƒO',                    'ATENÇÃO'),
        ('ATENÀ‡',                        'ATENÇ'),
        # 'ESTÀVEL' -> 'ESTÁVEL'
        ('EST\u00c0VEL', 'ESTÁVEL'),
        ('ESTÀVEL',      'ESTÁVEL'),
    ],
    r'components\pharmacy\hr\PharmacyPayrollManager.tsx': [
        # 'FARMÀCIA' -> 'FARMÁCIA'
        ('FARM\u00c0CIA', 'FARMÁCIA'),
        ('FARMÀCIA',      'FARMÁCIA'),
    ],
    r'components\share\ShareButton.tsx': [
        # â" arrow char at line start of a label -> '←'
        ('â\" ', '← '),
        ('â\"',  '←'),
    ],
    r'components\shared\PaymentGuidePrint.tsx': [
        # 'BANCÀRIO' -> 'BANCÁRIO'
        ('BANC\u00c0RIO', 'BANCÁRIO'),
        ('BANCÀRIO',      'BANCÁRIO'),
    ],
    r'pages\Orders.tsx': [
        # 'FORMULÀRIO' -> 'FORMULÁRIO'
        ('FORMUL\u00c0RIO', 'FORMULÁRIO'),
        ('FORMULÀRIO',      'FORMULÁRIO'),
    ],
    r'pages\commercial\CommercialHistory.tsx': [
        # 'CONCLUÀDA' -> 'CONCLUÍDA'
        ('CONCLU\u00c0DA', 'CONCLUÍDA'),
        ('CONCLUÀDA',      'CONCLUÍDA'),
    ],
    r'pages\hotel\HotelDashboard.tsx': [
        # same double-â artifact as HospitalityDashboard
        ("'ââ\u201a\u00ac\"'", "'-'"),
        ("'ââ€\"'",            "'-'"),
        ("ââ\u201a\u00ac\"",   "-"),
        ("ââ€\"",              "-"),
    ],
    r'pages\pharmacy\PharmacyAudit.tsx': [
        # 'OBRIGATÀ"RIO' -> 'OBRIGATÓRIO'
        ('OBRIGAT\u00c0\u201dRIO', 'OBRIGATÓRIO'),
        ('OBRIGATÀ"RIO',           'OBRIGATÓRIO'),
        ('OBRIGAT\u00c0',          'OBRIGATÁ'),   # broader fallback
    ],
}

# Global text-only fixes (safe in all files — these are inside JSX text / strings)
# The "BROKEN_IDENT: será" detections are FALSE POSITIVES — "será" is correct Portuguese.
# The "À " sequence (U+00C0 + space) in ConsumptionModal is: "adicionado À  conta" = "adicionado à conta"
global_fixes = [
    # "À  " (À + 2 spaces, which is Latin-1 misread of "à ") -> "à "
    ('À  ', 'à '),
    ('À ',  'à '),
]

fixed_files = 0

for rel, replacements in fixes_per_file.items():
    path = os.path.join(src, rel)
    if not os.path.exists(path):
        print(f'[SKIP - not found] {rel}')
        continue
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        original = content
        for old, new in replacements:
            content = content.replace(old, new)
        if content != original:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            fixed_files += 1
            print(f'[FIXED] {rel}')
        else:
            print(f'[NO CHANGE] {rel}')
    except Exception as e:
        print(f'[ERROR] {rel}: {e}')

# Apply global fixes to all files
exts = ('.tsx', '.ts', '.css', '.js', '.jsx')
global_fixed = 0
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
            for old, new in global_fixes:
                content = content.replace(old, new)
            if content != original:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                global_fixed += 1
                print(f'[GLOBAL-FIXED] {os.path.relpath(path, src)}')
        except Exception as e:
            pass

print(f'\nFile-specific fixes : {fixed_files}')
print(f'Global fixes        : {global_fixed}')
print('Done.')
