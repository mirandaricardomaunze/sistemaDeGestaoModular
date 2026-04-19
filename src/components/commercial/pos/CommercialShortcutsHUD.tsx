interface ShortcutItem {
    key: string;
    description: string;
    category: 'venda' | 'turno' | 'hardware' | 'navegação';
}

const SHORTCUTS: ShortcutItem[] = [
    { key: 'F1',  description: 'Mostrar/ocultar atalhos',    category: 'navegação' },
    { key: 'F2',  description: 'Focar pesquisa de produto',  category: 'venda'     },
    { key: 'F4',  description: 'Finalizar & Pagar',          category: 'venda'     },
    { key: 'F5',  description: 'Suspender venda (parking)',  category: 'venda'     },
    { key: 'F8',  description: 'Abrir/fechar gaveta',        category: 'hardware'  },
    { key: 'F9',  description: 'Reimprimir último talão',    category: 'hardware'  },
    { key: 'F10', description: 'Abrir / Fechar turno',       category: 'turno'     },
    { key: 'Esc', description: 'Limpar carrinho',            category: 'venda'     },
];

const CATEGORY_COLORS: Record<string, string> = {
    venda:     'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    turno:     'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    hardware:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    navegação: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
};

interface CommercialShortcutsHUDProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CommercialShortcutsHUD({ isOpen, onClose }: CommercialShortcutsHUDProps) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            {/* Panel */}
            <div
                className="relative bg-white dark:bg-dark-800 rounded-lg shadow-2xl border border-gray-100 dark:border-dark-700 p-6 w-full max-w-md mx-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                            Atalhos de Teclado
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">PDV - Módulo Comercial</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-2">
                    {SHORTCUTS.map(s => (
                        <div
                            key={s.key}
                            className="flex items-center justify-between gap-3 py-1.5"
                        >
                            <div className="flex items-center gap-2.5">
                                <kbd className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-lg bg-gray-900 dark:bg-dark-900 text-white text-[11px] font-black shadow-md border border-gray-700 font-mono leading-none">
                                    {s.key}
                                </kbd>
                                <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                    {s.description}
                                </span>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${CATEGORY_COLORS[s.category]}`}>
                                {s.category}
                            </span>
                        </div>
                    ))}
                </div>

                <p className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-700 text-[10px] text-gray-400 text-center">
                    Prima <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-dark-700 rounded text-[9px] font-mono">F1</kbd> para fechar · Os atalhos funcionam em qualquer campo de texto
                </p>
            </div>
        </div>
    );
}

// ── Floating hint badge shown permanently in POS ──────────────────────────────
export function ShortcutsHintBadge({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="fixed bottom-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 dark:bg-dark-900/90 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-gray-800 transition-colors backdrop-blur-sm border border-white/10"
            title="Ver atalhos de teclado (F1)"
        >
            <kbd className="font-mono">F1</kbd>
            <span>Atalhos</span>
        </button>
    );
}
