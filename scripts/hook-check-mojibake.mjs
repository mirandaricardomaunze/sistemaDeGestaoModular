#!/usr/bin/env node
// Hook wrapper para PostToolUse (Edit/Write/MultiEdit).
// Lê o payload JSON do stdin, extrai file_path(s) e corre check-mojibake.
// Exit 0 sempre (não bloqueia) — apenas reporta para Claude via stderr.

import fs from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';

let payload;
try {
    const raw = fs.readFileSync(0, 'utf8');
    payload = JSON.parse(raw || '{}');
} catch {
    process.exit(0);
}

const ti = payload.tool_input || {};
const files = new Set();

// Edit / Write
if (typeof ti.file_path === 'string') files.add(ti.file_path);
// MultiEdit
if (Array.isArray(ti.edits)) {
    for (const e of ti.edits) if (e && typeof e.file_path === 'string') files.add(e.file_path);
}

if (files.size === 0) process.exit(0);

const script = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'check-mojibake.mjs');
const res = spawnSync(process.execPath, [script, ...files], { stdio: ['ignore', 'inherit', 'inherit'] });

// Mesmo quando o check encontra mojibake, sair 0 — o stderr já alertou Claude
// e não queremos bloquear a operação Edit/Write.
process.exit(0);
