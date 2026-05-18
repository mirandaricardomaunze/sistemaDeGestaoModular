#!/usr/bin/env node
// Corrige mojibake (UTF-8 lido como Latin-1) em ficheiros TS/TSX.
// Uso: node scripts/fix-mojibake.mjs <file1> [file2] ...

import fs from 'fs';

// Ordem: sequências mais longas primeiro para evitar substituições parciais erradas.
const replacements = [
    // Compostos PT
    ['Ã§Ã£o', 'ção'],
    ['Ã§Ãµes', 'ções'],
    ['Ã§Ã£', 'çã'],
    ['Ã£o', 'ão'],
    ['Ã£e', 'ãe'],
    ['Ã£s', 'ãs'],
    ['Ã©m', 'ém'],
    ['Ã©s', 'és'],
    ['Ã­s', 'ís'],
    ['Ã­vel', 'ível'],

    // Box-drawing (não incluir 'â”' isolado — ambíguo)
    ['â”€', '─'],
    ['â”‚', '│'],
    ['â•\x90', '═'],
    ['â• ', '═'],

    // Smart quotes / dashes / bullets / symbols / emojis
    ['â€™', '\''],
    ['â€œ', '"'],
    ['â€"', '—'],
    ['â€”', '—'],
    ['â€¦', '…'],
    ['â€¢', '•'],
    ['â†’', '→'],
    ['âš ï¸ ', '⚠️'],
    ['âš ', '⚠️'],
    ['\xf0\x9f\x9a\xa8', '🚨'],
    ['\xf0\x9f\x8d\xbe', '🍾'],
    ['\xf0\x9f\x8d\xba', '🍺'],
    ['\xf0\x9f\x8d\x9d', '🍽️'],
    ['ââ€°¥', '≥'],
    ['Ã—', '×'],
    ['â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€', '─────────────'],

    // Corrupted plural words ending in 'aces' where 'çõ' was lost/corrupted
    ['exportaces', 'exportações'],
    ['transaces', 'transações'],
    ['Transaces', 'Transações'],
    ['utilizaces', 'utilizações'],
    ['declaraces', 'declarações'],
    ['obrigaces', 'obrigações'],
    ['localizaces', 'localizações'],
    ['expiraces', 'expirações'],
    ['alteraces', 'alterações'],
    ['operaces', 'operações'],
    ['configuraces', 'configurações'],
    ['informaces', 'informações'],
    ['situaces', 'situações'],
    [' as aces ', ' as ações '],
    [' de aces ', ' de ações '],
    [' para aces ', ' para ações '],
    [' incluir aces ', ' incluir ações '],
    [' excluir/incluir aces ', ' excluir/incluir ações '],
    ['rastrear todas as aces', 'rastrear todas as ações'],

    // Missing accents in common words
    [' j ', ' já '],
    ['(j ', '(já '],
    [' j)', ' já)'],
    [' accao nao ', ' acção não '],
    [' acao nao ', ' ação não '],
    [' Ainda nao ', ' Ainda não '],
    [' ainda nao ', ' ainda não '],
    [' j nao ', ' já não '],
    [' ja nao ', ' já não '],
    [' accao ', ' acção '],
    [' acao ', ' ação '],
    [' accao.', ' acção.'],
    [' acao.', ' ação.'],
    [' modulo.', ' módulo.'],
    [' modulo ', ' módulo '],
    [' saida ', ' saída '],

    // Vogais minúsculas com acento (UTF-8 lido como Latin-1)
    // 'à' (U+00E0) → C3 A0 em UTF-8 → 'Ã' + NBSP (U+00A0) no mojibake
    ['Ã ', 'à'],
    ['Ã ', 'à'],
    ['Ã¡', 'á'],
    ['Ã¢', 'â'],
    ['Ã£', 'ã'],
    ['Ã¤', 'ä'],
    ['Ã§', 'ç'],
    ['Ã¨', 'è'],
    ['Ã©', 'é'],
    ['Ãª', 'ê'],
    ['Ã«', 'ë'],
    ['Ã­', 'í'],
    ['Ã®', 'î'],
    ['Ã¯', 'ï'],
    ['Ã³', 'ó'],
    ['Ã´', 'ô'],
    ['Ãµ', 'õ'],
    ['Ã¶', 'ö'],
    ['Ã¹', 'ù'],
    ['Ãº', 'ú'],
    ['Ã»', 'û'],
    ['Ã¼', 'ü'],

    // Maiúsculas
    ['Ã€', 'À'],
    ['Ã\x81', 'Á'],
    ['Ã ', 'Á'],
    ['Ã‚', 'Â'],
    ['Ãƒ', 'Ã'],
    ['Ã„', 'Ä'],
    ['Ã‡', 'Ç'],
    ['Ãˆ', 'È'],
    ['Ã‰', 'É'],
    ['ÃŠ', 'Ê'],
    ['Ã‹', 'Ë'],
    ['ÃŒ', 'Ì'],
    ['Ã\x8D', 'Í'],
    ['ÃŽ', 'Î'],
    ['Ã\x8F', 'Ï'],
    ['Ã’', 'Ò'],
    ['Ã“', 'Ó'],
    ['Ã"', 'Ó'], // legado/typo
    ['Ã”', 'Ô'],
    ['Ã•', 'Õ'],
    ['Ã–', 'Ö'],
    ['Ã—', '×'],
    ['Ã™', 'Ù'],
    ['Ãš', 'Ú'],
    ['Ã›', 'Û'],
    ['Ãœ', 'Ü'],

    // Diversos: 'Â' + char no range 0xA0-0xBF é mojibake para U+00A0-U+00BF
    ['Â°', '°'],
    ['Â²', '²'],
    ['Â³', '³'],
    ['Â§', '§'],
    ['Â®', '®'],
    ['Â¡', '¡'],
    ['Â¿', '¿'],
    ['Âª', 'ª'],
    ['Âº', 'º'],
    ['Âµ', 'µ'],
    ['Â·', '·'],
    ['Â«', '«'],
    ['Â»', '»'],
    ['Â¢', '¢'],
    ['Â£', '£'],
    ['Â¥', '¥'],
    ['Â¬', '¬'],
    ['Â±', '±'],
    ['Â´', '´'],
    ['Â½', '½'],
    ['Â¼', '¼'],
    ['Â¾', '¾'],

    // BOM
    ['﻿', ''],
];

function fix(content) {
    let result = content;
    let totalChanges = 0;
    for (const [from, to] of replacements) {
        const before = result.length;
        const parts = result.split(from);
        if (parts.length > 1) {
            totalChanges += parts.length - 1;
            result = parts.join(to);
        }
        void before;
    }
    return { result, totalChanges };
}

const files = process.argv.slice(2);
if (files.length === 0) {
    console.error('Uso: node scripts/fix-mojibake.mjs <ficheiro> [...]');
    process.exit(1);
}

let totalFiles = 0;
let totalReplacements = 0;

for (const file of files) {
    try {
        const original = fs.readFileSync(file, 'utf8');
        const { result, totalChanges } = fix(original);
        if (totalChanges > 0) {
            fs.writeFileSync(file, result, 'utf8');
            console.log(`${file}: ${totalChanges} substituições`);
            totalFiles++;
            totalReplacements += totalChanges;
        }
    } catch (e) {
        console.error(`${file}: ERRO`, e.message);
    }
}

console.log(`---`);
console.log(`${totalFiles} ficheiro(s) alterado(s), ${totalReplacements} substituição(ões) totais.`);
