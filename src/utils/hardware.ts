// ============================================================================
// Hardware Utilities -- ESC/POS & Web Serial
// ============================================================================
//
// Gaveta de dinheiro: comunicação via ESC/POS (porta série / USB directo)
// Balança: Web Serial API (Chrome 89+)
//
// ESC/POS drawer command:
//   ESC  p   pin  t1    t2
//   1B   70  00   19    FA
//   On time = 25 × 2ms = 50ms | Off time = 250 × 2ms = 500ms
// ============================================================================

export const ESC_POS = {
    /** Abre gaveta no pino 2 (DK2) -- mais comum em gavetas Epson/Star */
    OPEN_DRAWER: '\x1B\x70\x00\x19\xFA',
    /** Abre gaveta no pino 5 (DK5) -- alguns modelos Bixolon */
    OPEN_DRAWER_ALT: '\x1B\x70\x01\x19\xFA',
    /** Inicialização da impressora */
    INIT: '\x1B\x40',
    /** Corte de papel parcial */
    CUT: '\x1D\x56\x41\x10',
};

// ── Gaveta via Web Serial ────────────────────────────────────────────────────

/** Verifica se o browser suporta Web Serial API */
export const hasSerialSupport = (): boolean => 'serial' in navigator;

/**
 * Abre a gaveta de dinheiro directamente via Web Serial API.
 * O utilizador tem de seleccionar a porta da impressora uma vez;
 * a partir da o browser memoriza.
 * @returns true se conseguiu enviar o comando, false caso contrrio
 */
export async function openCashDrawerSerial(): Promise<boolean> {
    if (!hasSerialSupport()) return false;
    let port: any;
    try {
        // Tenta obter porta j autorizada sem pedir ao utilizador
        const ports = await (navigator as any).serial.getPorts();
        port = ports[0];
        if (!port) {
            // Primeira vez -- pede ao utilizador para seleccionar
            port = await (navigator as any).serial.requestPort();
        }
        await port.open({ baudRate: 9600 });
        const writer = port.writable.getWriter();
        const bytes = new Uint8Array(
            [0x1b, 0x70, 0x00, 0x19, 0xfa] // ESC p 0 25 250
        );
        await writer.write(bytes);
        writer.releaseLock();
        await port.close();
        return true;
    } catch {
        try { if (port) await port.close(); } catch { /* ignore */ }
        return false;
    }
}

// ── Gaveta via impressão (fallback universal) ─────────────────────────────────

/**
 * Retorna o HTML do comando ESC/POS para abertura de gaveta.
 * Deve ser injectado no documento de impressão como um elemento oculto.
 * Funciona quando o browser envia directamente para uma impressora térmica USB
 * sem driver (modo RAW / GDI).
 *
 * O elemento usa position absolute fora do ecr para não afectar o layout,
 * mas est presente no stream enviado à impressora.
 */
export function getDrawerEscPosHtml(): string {
    // Os bytes em decimal: 27, 112, 0, 25, 250
    const escPos = '\u001b\u0070\u0000\u0019\u00fa';
    const encoded = escPos.split('').map(c => `&#${c.charCodeAt(0)};`).join('');
    return `<pre style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;font-size:1px">${encoded}</pre>`;
}

// ── Balança -- parsers de protocolo ───────────────────────────────────────────

export interface ScaleReading {
    weight: number;   // valor em gramas
    unit: 'g' | 'kg' | 'lb';
    stable: boolean;  // peso estabilizado
    raw: string;      // string original recebida
}

/**
 * Parsers para os protocolos mais comuns de balança:
 * - Toledo/Filizola: `S S   1.234 kg\r\n`
 * - Mettler:         `S D     1234g\r\n`
 * - Genérico:        qualquer número com unidade
 */
export function parseScaleData(raw: string): ScaleReading | null {
    const text = raw.trim();
    if (!text) return null;

    // Toledo / Filizola -- ex: "S S   1.500 kg"
    const toledoMatch = text.match(/^(S\s+S|S\s+D|S\s+U)\s+([\d.,]+)\s*(kg|g|lb)/i);
    if (toledoMatch) {
        const stable = toledoMatch[1].includes('S S') || toledoMatch[1].includes('S D');
        const value = parseFloat(toledoMatch[2].replace(',', '.'));
        const unit = toledoMatch[3].toLowerCase() as 'g' | 'kg' | 'lb';
        const weight = unit === 'kg' ? value * 1000 : unit === 'lb' ? value * 453.592 : value;
        return { weight: Math.round(weight), unit, stable, raw };
    }

    // Mettler / Genérico -- ex: "  1234g" ou "1.500kg"
    const genericMatch = text.match(/([\d.,]+)\s*(kg|g|lb)/i);
    if (genericMatch) {
        const value = parseFloat(genericMatch[1].replace(',', '.'));
        const unit = genericMatch[2].toLowerCase() as 'g' | 'kg' | 'lb';
        const weight = unit === 'kg' ? value * 1000 : unit === 'lb' ? value * 453.592 : value;
        return { weight: Math.round(weight), unit, stable: true, raw };
    }

    // S número (assume gramas)
    const numberOnly = text.match(/^[\s+\-]*([\d.,]+)/);
    if (numberOnly) {
        const weight = parseFloat(numberOnly[1].replace(',', '.'));
        if (!isNaN(weight) && weight >= 0) {
            return { weight: Math.round(weight), unit: 'g', stable: true, raw };
        }
    }

    return null;
}
