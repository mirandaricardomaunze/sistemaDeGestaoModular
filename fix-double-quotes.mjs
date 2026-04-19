import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC = './src';
let totalFixed = 0;

function walk(dir) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        const ext = extname(full);
        if (!['.tsx', '.ts', '.js', '.jsx'].includes(ext)) continue;
        processFile(full);
    }
}

function processFile(filePath) {
    let content = readFileSync(filePath, 'utf8');
    const original = content;

    // Fix "" as text separator between word chars (covers JSX attrs, template literals, JSX text)
    // e.g. "Relatório Z "" Fecho" -> "Relatório Z - Fecho"
    //      "Assiduidade "" 7 dias" -> "Assiduidade - 7 dias"
    content = content.replace(/([a-zA-ZÀ-ÿ0-9.,!?)]) *"" *([a-zA-ZÀ-ÿ0-9${])/g, '$1 - $2');

    // Fix '""' as fallback display value: || '""', ?? '""', : '""' -> ''
    content = content.replace(/'""'/g, "''");

    // Fix HTML ""  in template strings (payslip HTML tables)
    content = content.replace(/>""</g, '>-<');

    if (content !== original) {
        writeFileSync(filePath, content, 'utf8');
        totalFixed++;
        console.log(`Fixed: ${filePath}`);
    }
}

walk(SRC);
console.log(`\nTotal files fixed: ${totalFixed}`);
