#!/usr/bin/env node
// Verifica mojibake em ficheiros. Exit 1 se detectado.
// Uso: node scripts/check-mojibake.mjs <file1> [file2] ...
// Sem args: usa stdin (filenames um por linha) ou git diff.

import fs from 'fs';

// Padrões que SÓ aparecem em mojibake (não em texto PT válido).
// Cobre: Ã + lowercase Latin-1 (vogais com acento), Â + chars 0xA0-0xBF (símbolos),
// box-drawing corrompido, smart quotes/dashes corrompidos.
const MOJIBAKE_PATTERNS = [
    /Ã[\x80-\xBF]/,          // Ã  Ã€-Ã¿ (todos os pares C3 + 0x80-BF, cobrindo maiúsculas e minúsculas)
    /Â[\xA0-\xBF]/,          // Â° Â§ Â® Â·  (pares C2 + 0xA0-BF)
    /â€[™œ "]/,      // smart quotes/dashes corrompidos
    /â”[€‚]/,                        // box-drawing horizontal/vertical corrompido
    /â•[\x80-\xBF]/,         // box-drawing duplo corrompido
    /ðŸ[\x80-\xBF][\x80-\xBF]/, // emojis corrompidos (ex: ðŸš¨)
    /﻿/,                        // BOM
];

const files = process.argv.slice(2);
if (files.length === 0) {
    console.error('Uso: node scripts/check-mojibake.mjs <ficheiro> [...]');
    process.exit(2);
}

let totalHits = 0;
const offenders = [];

// Ficheiros que CONTÊM padrões mojibake por design (tabelas de substituição).
const SELF_EXCLUDED = new Set([
    'scripts/fix-mojibake.mjs',
    'scripts/check-mojibake.mjs',
    '.agent/skills/encoding-utf8/SKILL.md',
]);
const norm = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '');

for (const file of files) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    // Saltar binários conhecidos
    if (/\.(png|jpg|jpeg|gif|ico|pdf|woff2?|ttf|eot|webp|mp[34])$/i.test(file)) continue;
    // Saltar node_modules, dist, build, .git
    if (/\b(node_modules|dist|build|\.git|\.next|coverage)\b/.test(norm(file))) continue;
    // Saltar self
    if (SELF_EXCLUDED.has(norm(file))) continue;
    try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        const matches = [];
        for (let i = 0; i < lines.length; i++) {
            for (const pat of MOJIBAKE_PATTERNS) {
                if (pat.test(lines[i])) {
                    matches.push({ line: i + 1, sample: lines[i].slice(0, 100) });
                    break;
                }
            }
        }
        if (matches.length > 0) {
            offenders.push({ file, matches });
            totalHits += matches.length;
        }
    } catch {
        // ignorar ficheiros não-texto / erros de leitura
    }
}

if (offenders.length === 0) process.exit(0);

console.error(`\n� ️  Mojibake detectado em ${offenders.length} ficheiro(s) (${totalHits} linha(s)):\n`);
for (const { file, matches } of offenders) {
    console.error(`  ${file}`);
    for (const m of matches.slice(0, 5)) {
        console.error(`    L${m.line}: ${m.sample}`);
    }
    if (matches.length > 5) console.error(`    ... +${matches.length - 5} mais`);
}
console.error(`\nPara corrigir: node scripts/fix-mojibake.mjs ${offenders.map(o => o.file).join(' ')}\n`);
process.exit(1);
