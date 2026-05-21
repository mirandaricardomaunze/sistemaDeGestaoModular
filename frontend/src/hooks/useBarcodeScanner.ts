import { useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
    onScan: (barcode: string) => void;
    enabled?: boolean;
    bufferTimeout?: number;
    minLength?: number;
}

/**
 * Custom hook to handle global barcode scanner input.
 * Scanners typically act as a rapid keyboard that ends with an "Enter" key.
 */
export function useBarcodeScanner({
    onScan,
    enabled = true,
    bufferTimeout = 50,
    minLength = 3
}: UseBarcodeScannerOptions) {
    const bufferRef = useRef<string>('');
    const lastKeyTimeRef = useRef<number>(0);

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            // Ignore if focus is on an input or textarea, 
            // unless it's explicitly allowed or we want to capture everything.
            const target = event.target as HTMLElement;
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            // If we are in an input, we only allow scanning if the input has a data-barcode-capture attribute
            // This allows specific search inputs to still trigger the global scanner logic if needed,
            // but generally prevents scanning from messing up form filling.
            if (isInput && !target.hasAttribute('data-barcode-capture')) {
                return;
            }

            const currentTime = Date.now();

            // Detect if this is likely a scanner based on speed
            // Scanners are MUCH faster than human typing
            const isFast = currentTime - lastKeyTimeRef.current < bufferTimeout;
            lastKeyTimeRef.current = currentTime;

            if (event.key === 'Enter') {
                if (bufferRef.current.length >= minLength) {
                    onScan(bufferRef.current);
                }
                bufferRef.current = '';
                return;
            }

            // Only append single characters
            if (event.key.length === 1) {
                // If it's been too long since the last key, reset buffer
                // This helps distinguish between slow human typing and fast scanner typing
                if (!isFast && bufferRef.current.length > 0) {
                    bufferRef.current = '';
                }

                bufferRef.current += event.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, onScan, bufferTimeout, minLength]);

    return {
        clearBuffer: () => { bufferRef.current = ''; }
    };
}
