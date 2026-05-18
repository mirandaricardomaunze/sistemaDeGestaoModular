---
name: encoding-utf8
description: "Regras para encoding UTF-8 consistente — prevenir mojibake (UTF-8 lido como Latin-1) em todos os ficheiros do projecto."
---

# UTF-8 Everywhere — Prevenção de Mojibake

Todos os ficheiros de texto do projecto **DEVEM** ser UTF-8 sem BOM com terminadores LF. Mojibake é o resultado de escrever bytes UTF-8 e depois reabrir o ficheiro como Latin-1/Windows-1252, gravando novamente em UTF-8 — corrompe acentos portugueses e símbolos visualmente.

## Como detectar mojibake

Padrões típicos no código (visíveis a olho nu — todos significam que o ficheiro foi corrompido):

| Mojibake | Carácter correcto | Origem UTF-8 |
|---|---|---|
| `Ã³` | `ó` | C3 B3 lido como Ã + ³ |
| `Ã§Ã£o` | `ção` | sequência completa |
| `Ã¡` | `á` | C3 A1 |
| `Ã©` | `é` | C3 A9 |
| `Ã­` | `í` | C3 AD |
| `Ãª` | `ê` | C3 AA |
| `Ã£` | `ã` | C3 A3 |
| `Ã` + NBSP | `à` | C3 A0 |
| `Â°` | `°` | C2 B0 |
| `Â·` | `·` | C2 B7 |
| `Â§` | `§` | C2 A7 |
| `â”€` | `─` (box-drawing) | E2 94 80 |
| `â€™` | `'` (smart quote) | E2 80 99 |
| `â€"` | `—` (em-dash) | E2 80 94 |

Se vês `Ã` seguido de uma vogal acentuada minúscula, ou `Â` seguido de um símbolo, é mojibake.

## Como evitar

1. **Editor**: O `.editorconfig` na raiz do projecto força `charset = utf-8` e `end_of_line = lf`. Garante que o teu editor respeita o `.editorconfig` (VSCode tem extensão oficial; WebStorm/JetBrains aplica nativamente).
2. **Git**: O `.gitattributes` declara todos os ficheiros de texto como `text eol=lf working-tree-encoding=UTF-8`. Isto previne conversões automáticas para CRLF/Latin-1 em sistemas Windows.
3. **Linters / formatters**: Confirma que Prettier/ESLint/jest configs não sobrescrevem o encoding. Não há configuração específica necessária — todos respeitam UTF-8 por defeito quando o ficheiro de entrada o é.
4. **Cópia/colagem**: Cuidado quando colas texto de PDFs, Word, Outlook — esses programas podem escrever Windows-1252. Cola via "Paste as plain text" (Ctrl+Shift+V) ou guarda primeiro num bloco de notas UTF-8.

## Como corrigir quando acontece

O projecto tem dois scripts dedicados:

- `scripts/check-mojibake.mjs <files...>` — verifica e reporta (read-only, exit 1 se encontrar).
- `scripts/fix-mojibake.mjs <files...>` — corrige in-place com tabela de substituição.

### Aplicação típica (por módulo)

```bash
# Detecção
node scripts/check-mojibake.mjs src/pages/commercial/*.tsx src/pages/Commercial.tsx

# Correcção (após confirmação)
node scripts/fix-mojibake.mjs src/pages/commercial/*.tsx src/pages/Commercial.tsx

# Validação
npx tsc --noEmit
```

### Quando criar/editar texto português

- **Sempre** usa as formas correctas: `ção`, `ões`, `á`, `é`, `í`, `ó`, `ú`, `ã`, `õ`, `ê`, `â`, `ô`, `ç`, etc.
- **Nunca** uses formas mojibake como input — não há razão para escrever `Ã§Ã£o` em vez de `ção`.
- Se vês caracteres estranhos quando lês um ficheiro, **não os edites manualmente**: corre o `fix-mojibake` no ficheiro inteiro.

## Hook de detecção automática

O `.claude/settings.json` regista um hook `PostToolUse` em `Edit|Write|MultiEdit` que corre `scripts/hook-check-mojibake.mjs` após cada edição. Isto serve para **detectar** corrupção causada por linters/formatters externos pós-edição. O hook reporta via stderr sem bloquear a operação.

Se o hook reportar mojibake após uma edição que não introduziu o problema, significa que um linter externo (ou o IDE em background) corrompeu o ficheiro entre o teu Edit e o re-save. Corre `fix-mojibake.mjs` para repor.

## Exclusões (ficheiros que CONTÊM padrões mojibake por design)

Estes ficheiros precisam dos padrões como input para o algoritmo de substituição:

- `scripts/fix-mojibake.mjs`
- `scripts/check-mojibake.mjs`
- `.agent/skills/encoding-utf8/SKILL.md` (este ficheiro)

Estão excluídos da detecção via `SELF_EXCLUDED` no `check-mojibake.mjs`.

## Histórico do projecto (Maio 2026)

- Vaga 1 (módulo pharmacy): 26 ficheiros, 1723 substituições — todas as páginas/componentes farmacêuticos limpos.
- Vagas seguintes: aplicar por módulo conforme necessário.

## Princípios

- **Não introduzir mojibake**: ao gerar código em PT, escreve sempre acentuação correcta.
- **Detectar cedo**: o hook PostToolUse alerta dentro de segundos.
- **Corrigir em massa**: aplicar `fix-mojibake.mjs` por pasta/módulo em vez de ficheiro-a-ficheiro.
- **Verificar build**: sempre `tsc --noEmit` depois de uma vaga de correcção (substituições nunca devem alterar a estrutura do código, mas confirma).
