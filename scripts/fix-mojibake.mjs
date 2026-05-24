#!/usr/bin/env node
// Fix common mojibake caused by UTF-8 text being read as Windows-1252.
// Usage: node scripts/fix-mojibake.mjs <file1> [file2] ...

import fs from 'fs';
import { TextDecoder } from 'util';

const decoder = new TextDecoder('utf-8', { fatal: false });

const cp1252 = new Map([
    [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
    [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
    [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
    [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
    [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
    [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
    [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

const suspicious = /\u00c3[\s\S]|\u00c2[\s\S]|\u00e2[\s\S]{2}|\u00ef\u00bb\u00bf|\u00f0[\s\S]{3}/g;
const bad = /\u00c3|\u00c2|\u00e2|\u00ef\u00bb\u00bf|\ufeff|\ufffd|\u00f0\u0178/;
const badGlobal = /\u00c3|\u00c2|\u00e2|\u00ef\u00bb\u00bf|\ufeff|\ufffd|\u00f0\u0178/g;

function encodeCp1252(text) {
    const bytes = [];
    for (const char of text) {
        const code = char.codePointAt(0);
        if (cp1252.has(code)) {
            bytes.push(cp1252.get(code));
        } else if (code <= 0xff) {
            bytes.push(code);
        } else {
            return null;
        }
    }
    return Uint8Array.from(bytes);
}

function score(text) {
    return (text.match(badGlobal) || []).length;
}

function decodeFragment(fragment) {
    const bytes = encodeCp1252(fragment);
    if (!bytes) return fragment;
    const decoded = decoder.decode(bytes);
    if (decoded.includes('\ufffd')) return fragment;
    return score(decoded) <= score(fragment) ? decoded : fragment;
}

function fix(content) {
    let result = content;
    for (let pass = 0; pass < 6; pass++) {
        const next = result.replace(suspicious, decodeFragment);
        if (next === result) break;
        result = next;
    }
    return result
        .replace(/^\ufeff/, '')
        .replaceAll("['\ufeff' + csv]", "['\\uFEFF' + csv]")
        .replaceAll('["\ufeff" + csv]', '["\\uFEFF" + csv]');
}

const files = process.argv.slice(2);
if (files.length === 0) {
    console.error('Usage: node scripts/fix-mojibake.mjs <file1> [...]');
    process.exit(1);
}

let changedFiles = 0;
for (const file of files) {
    try {
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
        const before = fs.readFileSync(file, 'utf8');
        if (!bad.test(before)) continue;
        const after = fix(before);
        if (after !== before) {
            fs.writeFileSync(file, after, 'utf8');
            changedFiles++;
            console.log(file);
        }
    } catch (error) {
        console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

console.log(`changed=${changedFiles}`);
