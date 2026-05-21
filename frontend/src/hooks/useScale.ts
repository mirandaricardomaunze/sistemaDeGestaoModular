import { useState, useCallback, useRef, useEffect } from 'react';
import { parseScaleData, hasSerialSupport, type ScaleReading } from '../utils/hardware';

// ── Estado da balança ─────────────────────────────────────────────────────────

type ScaleStatus = 'disconnected' | 'connecting' | 'connected' | 'reading' | 'error';

export interface UseScaleReturn {
    // Estado
    status: ScaleStatus;
    isConnected: boolean;
    isSupported: boolean;
    reading: ScaleReading | null;
    weight: number;
    error: string | null;

    // Acções
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    captureWeight: () => ScaleReading | null; // captura o último peso estvel
}

// Buffer para acumular bytes parciais da porta série
let lineBuffer = '';

export function useScale(): UseScaleReturn {
    const [status, setStatus] = useState<ScaleStatus>('disconnected');
    const [reading, setReading] = useState<ScaleReading | null>(null);
    const [error, setError] = useState<string | null>(null);

    interface SerialPort {
        readable: ReadableStream<Uint8Array> | null;
        open(options: object): Promise<void>;
        close(): Promise<void>;
    }
    interface SerialReader {
        read(): Promise<{ value?: Uint8Array; done: boolean }>;
        releaseLock(): void;
        cancel(): Promise<void>;
    }

    const portRef = useRef<SerialPort | null>(null);
    const readerRef = useRef<SerialReader | null>(null);
    const abortRef = useRef<boolean>(false);

    const isSupported = hasSerialSupport();

    // ── Leitura contínua ──────────────────────────────────────────────────────
    const startReading = useCallback(async (port: SerialPort) => {
        abortRef.current = false;
        setStatus('reading');

        const decoder = new TextDecoder();

        try {
            while (!abortRef.current && port.readable) {
                readerRef.current = port.readable.getReader();
                try {
                    while (!abortRef.current) {
                        const { value, done } = await readerRef.current!.read();
                        if (done) break;

                        lineBuffer += decoder.decode(value, { stream: true });

                        // Processa linhas completas (terminadas com \n ou \r\n)
                        const lines = lineBuffer.split(/\r?\n/);
                        lineBuffer = lines.pop() ?? ''; // guarda fragmento incompleto

                        for (const line of lines) {
                            const parsed = parseScaleData(line);
                            if (parsed && parsed.weight >= 0) {
                                setReading(parsed);
                                setError(null);
                            }
                        }
                    }
                } catch (err) {
                    if (!abortRef.current) {
                        setError('Erro na leitura: ' + (err as Error).message);
                    }
                } finally {
                    try { readerRef.current?.releaseLock(); } catch { /* ignore */ }
                }
            }
        } catch {
            // porta fechada normalmente
        }

        if (!abortRef.current) {
            setStatus('error');
            setError('Ligação à balança perdida');
        }
    }, []);

    // ── Conectar ──────────────────────────────────────────────────────────────
    const connect = useCallback(async () => {
        if (!isSupported) {
            setError('Web Serial API não suportada. Use Chrome 89+');
            setStatus('error');
            return;
        }
        if (portRef.current) return; // já conectado

        setStatus('connecting');
        setError(null);

        try {
            // Tenta porta já autorizada primeiro
            const existingPorts = await (navigator as Navigator & { serial: { getPorts(): Promise<SerialPort[]>; requestPort(options?: { filters?: object[] }): Promise<SerialPort> } }).serial.getPorts();
            let port = existingPorts[0];

            if (!port) {
                // Pede ao utilizador para seleccionar a porta da balança
                port = await (navigator as Navigator & { serial: { getPorts(): Promise<SerialPort[]>; requestPort(options?: { filters?: object[] }): Promise<SerialPort> } }).serial.requestPort({
                    filters: [] // aceita qualquer dispositivo série
                });
            }

            // Configuração padrão para balanças comerciais
            // Toledo/Filizola: 9600, 8N1 | Mettler: 9600, 8N1
            await port.open({
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                flowControl: 'none',
            });

            portRef.current = port;
            setStatus('connected');

            // Inicia leitura em background
            startReading(port);
        } catch (err) {
            const e = err as Error;
            if (e.name !== 'NotFoundError') { // utilizador cancelou a seleção
                setError(e.message || 'Erro ao conectar à balança');
                setStatus('error');
            } else {
                setStatus('disconnected');
            }
        }
    }, [isSupported, startReading]);

    // ── Desconectar ───────────────────────────────────────────────────────────
    const disconnect = useCallback(async () => {
        abortRef.current = true;
        try { readerRef.current?.cancel(); } catch { /* ignore */ }
        try { await portRef.current?.close(); } catch { /* ignore */ }
        portRef.current = null;
        lineBuffer = '';
        setStatus('disconnected');
        setReading(null);
        setError(null);
    }, []);

    // ── Captura de peso ───────────────────────────────────────────────────────
    const captureWeight = useCallback((): ScaleReading | null => {
        return reading;
    }, [reading]);

    // Cleanup ao desmontar
    useEffect(() => {
        return () => {
            abortRef.current = true;
            try { readerRef.current?.cancel(); } catch { /* ignore */ }
            try { portRef.current?.close(); } catch { /* ignore */ }
        };
    }, []);

    return {
        status,
        isConnected: status === 'reading' || status === 'connected',
        isSupported,
        reading,
        weight: reading?.weight ?? 0,
        error,
        connect,
        disconnect,
        captureWeight,
    };
}
