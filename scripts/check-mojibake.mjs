#!/usr/bin/env node
// Detect mojibake in text files. Exits 1 when suspicious text is found.
// Usage: node scripts/check-mojibake.mjs <file1> [file2] ...

import fs from 'fs';

const MOJIBAKE_PATTERNS = [
    /\u00c3[\u0080-\u00bf\u0160-\u017f\u2018-\u201f\u20ac]/,
    /\u00c2[\u00a0-\u00bf]/,
    /\u00e2[\u0080-\uffff]{2}/,
    /\u00f0[\u0080-\uffff]{3}/,
    /\u00ef\u00bb\u00bf/,
    /\ufeff/,
    /\ufffd/,
];

const SKIP = new Set([
    'scripts/fix-mojibake.mjs',
    'scripts/check-mojibake.mjs',
]);

const norm = (path) => path.replace(/\\/g, '/').replace(/^\.\//, '');
const files = process.argv.slice(2);

if (files.length === 0) {
    console.error('Usage: node scripts/check-mojibake.mjs <file1> [...]');
    process.exit(2);
}

let totalHits = 0;
const offenders = [];

for (const file of files) {
    const normalized = norm(file);
    if (SKIP.has(normalized)) continue;
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    if (/\.(png|jpg|jpeg|gif|ico|pdf|woff2?|ttf|eot|webp|mp[34])$/i.test(file)) continue;
    if (/\b(node_modules|dist|build|\.git|\.next|coverage)\b/.test(normalized)) continue;

    try {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        const matches = [];
        for (let i = 0; i < lines.length; i++) {
            if (MOJIBAKE_PATTERNS.some((pattern) => pattern.test(lines[i]))) {
                matches.push({ line: i + 1, sample: lines[i].slice(0, 120) });
            }
        }
        if (matches.length > 0) {
            offenders.push({ file, matches });
            totalHits += matches.length;
        }
    } catch {
        // Ignore unreadable or non-text files.
    }
}

if (offenders.length === 0) process.exit(0);

console.error(`\nMojibake detected in ${offenders.length} file(s), ${totalHits} line(s):\n`);
for (const { file, matches } of offenders) {
    console.error(`  ${file}`);
    for (const match of matches.slice(0, 5)) {
        console.error(`    L${match.line}: ${match.sample}`);
    }
    if (matches.length > 5) console.error(`    ... +${matches.length - 5} more`);
}
console.error(`\nTo fix: node scripts/fix-mojibake.mjs ${offenders.map((o) => o.file).join(' ')}\n`);
process.exit(1);
