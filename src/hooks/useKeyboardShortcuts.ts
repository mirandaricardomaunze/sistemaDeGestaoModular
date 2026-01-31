import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    action: () => void;
    description?: string;
    preventDefault?: boolean;
}

/**
 * Hook for handling keyboard shortcuts
 * @param shortcuts - Array of keyboard shortcut definitions
 * @param enabled - Whether shortcuts are enabled (default: true)
 */
export function useKeyboardShortcuts(
    shortcuts: KeyboardShortcut[],
    enabled: boolean = true
) {
    const shortcutsRef = useRef(shortcuts);
    shortcutsRef.current = shortcuts;

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (!enabled) return;

            // Don't trigger shortcuts when typing in input/textarea
            const target = event.target as HTMLElement;
            const isInputElement =
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable;

            // Allow F-keys even in input elements
            const isFunctionKey = event.key.startsWith('F') && event.key.length <= 3;
            const isEscape = event.key === 'Escape';

            if (isInputElement && !isFunctionKey && !isEscape) {
                return;
            }

            for (const shortcut of shortcutsRef.current) {
                const keyMatches = event.key.toUpperCase() === shortcut.key.toUpperCase();
                const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
                const altMatches = !!shortcut.alt === event.altKey;
                const shiftMatches = !!shortcut.shift === event.shiftKey;

                if (keyMatches && ctrlMatches && altMatches && shiftMatches) {
                    if (shortcut.preventDefault !== false) {
                        event.preventDefault();
                    }
                    shortcut.action();
                    break;
                }
            }
        },
        [enabled]
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    return null;
}

/**
 * POS-specific keyboard shortcuts configuration
 */
export const POS_SHORTCUTS = {
    SEARCH: 'F2',
    CHECKOUT: 'F4',
    DISCOUNT: 'F5',
    OPEN_DRAWER: 'F8',
    PRINT_LAST: 'F9',
    CLEAR: 'Escape',
    INCREASE_QTY: 'NumpadAdd',
    DECREASE_QTY: 'NumpadSubtract',
} as const;

export default useKeyboardShortcuts;
