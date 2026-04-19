
import os
import re

# Definindo padrões com escapes unicode para evitar problemas de codificação no próprio script
patterns = [
    # Mojibake (C3 XX)
    (re.compile(r'\u00C3\u00A9'), 'é'),
    (re.compile(r'\u00C3\u00A1'), 'á'),
    (re.compile(r'\u00C3\u00B3'), 'ó'),
    (re.compile(r'\u00C3\u00AA'), 'ê'),
    (re.compile(r'\u00C3\u00A7'), 'ç'),
    (re.compile(r'\u00C3\u00A3'), 'ã'),
    (re.compile(r'\u00C3\u00A0'), 'à'),
    (re.compile(r'\u00C3\u00B5'), 'õ'),
    (re.compile(r'\u00C3\u00BA'), 'ú'),
    (re.compile(r'\u00C3\u00AD'), 'í'),
    (re.compile(r'\u00C3\u0089'), 'É'),
    (re.compile(r'\u00C3\u0081'), 'Á'),
    (re.compile(r'\u00C3\u0093'), 'Ó'),
    (re.compile(r'\u00C3\u0087'), 'Ç'),
    (re.compile(r'\u00C3\u0095'), 'Õ'),
    (re.compile(r'\u00C3\u009A'), 'Ú'),
    (re.compile(r'\u00C3\u008D'), 'Í'),
    
    # Arrows and Emojis
    (re.compile(r'\u00E2\u0086\u0092'), '→'),
    (re.compile(r'\u00E2\u0086\u0091'), '↑'),
    (re.compile(r'\u00E2\u0086\u0093'), '↓'),
    (re.compile(r'\u00E2\u0086\u0090'), '←'),
    (re.compile(r'\u00E2\u009A\u00A0'), '⚠️'),
    
    # Specific Mangles
    (re.compile(r'\u00C0--'), 'x'),
    (re.compile(r'Observaces'), 'Observações'),
    (re.compile(r'movimentaces'), 'movimentações'),
    (re.compile(r'configuraces'), 'configurações'),
    (re.compile(r'operaces'), 'operações'),
    (re.compile(r'notificaces'), 'notificações'),
    (re.compile(r'transacções'), 'transações'),
    (re.compile(r'Transacções'), 'Transações'),
    (re.compile(r'manifestá'), 'manifesto'),
    (re.compile(r'inventrio'), 'inventário'),
    (re.compile(r'prescriptionNão'), 'prescriptionNumber'),
    
    # Missing leading characters
    (re.compile(r"(?<=[ '\"'>])inheiro\b"), 'Dinheiro'),
    (re.compile(r"(?<=[ '\"'>])artão\b"), 'Cartão'),
    (re.compile(r"(?<=[ '\"'>])ransferência\b"), 'Transferência')
]

src_dir = os.path.join(os.getcwd(), 'src')

print(f"Iniciando reparo em: {src_dir}")

fixed_count = 0
for root, dirs, files in os.walk(src_dir):
    if 'node_modules' in dirs: dirs.remove('node_modules')
    if 'dist' in dirs: dirs.remove('dist')
    
    for file in files:
        if file.endswith(('.tsx', '.ts', '.css')):
            full_path = os.path.join(root, file)
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                modified = False
                for pattern, replacement in patterns:
                    if pattern.search(content):
                        content = pattern.sub(replacement, content)
                        modified = True
                
                if modified:
                    with open(full_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"Sucesso: {full_path}")
                    fixed_count += 1
            except Exception as e:
                print(f"Erro ao processar {full_path}: {e}")

print(f"Reparo concluído. total de arquivos corrigidos: {fixed_count}")
