import os

src = r'c:\Users\miran\Desktop\sistemas\src'
exts = ('.tsx', '.ts', '.css', '.js', '.jsx')

replacements = [
    # Uppercase accented (mojibake)
    ('Ã\x87', 'C'),
    ('Ã\x83', 'A'),
    ('Ã\x82', 'A'),
    ('Ã\x80', 'A'),
    ('Ã\x89', 'E'),
    ('Ã\x8a', 'E'),
    ('Ã\x8b', 'E'),
    ('Ã\x8e', 'I'),
    ('Ã\x93', 'O'),
    ('Ã\x94', 'O'),
    ('Ã\x95', 'O'),
    ('Ã\x96', 'O'),
    ('Ã\x9a', 'U'),
    ('Ã\x9b', 'U'),
    ('Ã\x9c', 'U'),
    # Lowercase accented
    ('Ã\xa1', 'a'),
    ('Ã\xa0', 'a'),
    ('Ã\xa3', 'a'),
    ('Ã\xa2', 'a'),
    ('Ã\xa4', 'a'),
    ('Ã\xa9', 'e'),
    ('Ã\xa8', 'e'),
    ('Ã\xaa', 'e'),
    ('Ã\xab', 'e'),
    ('Ã\xad', 'i'),
    ('Ã\xac', 'i'),
    ('Ã\xae', 'i'),
    ('Ã\xaf', 'i'),
    ('Ã\xb3', 'o'),
    ('Ã\xb2', 'o'),
    ('Ã\xb5', 'o'),
    ('Ã\xb4', 'o'),
    ('Ã\xb6', 'o'),
    ('Ã\xba', 'u'),
    ('Ã\xb9', 'u'),
    ('Ã\xbb', 'u'),
    ('Ã\xbc', 'u'),
    ('Ã\xa7', 'c'),
    ('Ã\xb1', 'n'),
    # Curly quotes and dashes
    ('\xe2\x80\x99', "'"),
    ('\xe2\x80\x98', "'"),
    ('\xe2\x80\x9c', '"'),
    ('\xe2\x80\x9d', '"'),
    ('\xe2\x80\x93', '-'),
    ('\xe2\x80\x94', '--'),
    ('\xe2\x80\xa6', '...'),
    ('\xe2\x80\x8b', ''),
    # Symbols
    ('\xc2\xa9', '(c)'),
    ('\xc2\xae', '(R)'),
    ('\xc2\xb0', ' deg'),
    ('\xc2\xb7', '.'),
    ('\xc2\xba', 'o'),
    ('\xc2\xaa', 'a'),
    ('\xe2\x82\xac', 'EUR'),
    ('\xc2\xa3', 'GBP'),
    ('\xc2\xa0', ' '),
    # Stray residuals (must be last)
    ('Â', ''),
    ('Ã', ''),
]

fixed = 0
for root, dirs, files in os.walk(src):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'dist')]
    for fname in files:
        if not fname.endswith(exts):
            continue
        path = os.path.join(root, fname)
        try:
            with open(path, 'rb') as f:
                raw = f.read()
            text = raw.decode('utf-8', errors='replace')
            original = text
            for old, new in replacements:
                text = text.replace(old, new)
            if text != original:
                with open(path, 'wb') as f:
                    f.write(text.encode('utf-8'))
                print(f'[FIXED] {fname}')
                fixed += 1
        except Exception as e:
            print(f'[ERROR] {fname}: {e}')

print(f'\nFicheiros corrigidos: {fixed}')
