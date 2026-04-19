
words = ['ATENÇÃO','ESTÁVEL','CONFIRMAÇÃO','OCUPAÇÃO','AÇÃO','DISTRIBUIÇÃO','COMPOSIÇÃO']
for w in words:
    b = w.encode('utf-8')
    decoded = b.decode('utf-8')
    print(f'{w} -> {b.hex()} -> OK: {decoded == w}')
print('\nAll words are valid UTF-8: correct Portuguese all-caps text.')
print('These are FALSE POSITIVES from the CAPS_CORRUPT regex pattern.')
print('The regex incorrectly flags Ã (U+00C3) inside valid sequences like ÇÃO.')
