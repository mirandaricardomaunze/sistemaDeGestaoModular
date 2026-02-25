import { useState, useCallback, useEffect } from 'react';

export interface ScaleData {
    weight: number;
    unit: string;
    stable: boolean;
}

export const useScale = () => {
    const [port, setPort] = useState<any>(null);
    const [weight, setWeight] = useState<number>(0);
    const [isReading, setIsReading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const connect = useCallback(async () => {
        try {
            if (!('serial' in navigator)) {
                throw new Error('Web Serial API não suportada');
            }

            const p = await (navigator as any).serial.requestPort();
            await p.open({ baudRate: 9600 });
            setPort(p);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        }
    }, []);

    const startReading = useCallback(async () => {
        if (!port || isReading) return;

        setIsReading(true);
        const reader = port.readable.getReader();

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                // Simple parser for common scale protocols (STX + weight + ETX)
                // This is generic and might need specific adjustments for Toledo/Filizola
                const text = new TextDecoder().decode(value);
                const match = text.match(/(\d+\.\d+|\d+)/);
                if (match) {
                    setWeight(parseFloat(match[0]));
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            reader.releaseLock();
            setIsReading(false);
        }
    }, [port, isReading]);

    useEffect(() => {
        return () => {
            if (port) port.close();
        };
    }, [port]);

    return {
        connect,
        startReading,
        weight,
        isReading,
        error,
        isConnected: !!port
    };
};
