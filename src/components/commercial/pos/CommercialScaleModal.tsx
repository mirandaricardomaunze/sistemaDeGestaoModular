import React, { useState } from 'react';
import { HiOutlineX, HiOutlineCheck, HiOutlineRefresh } from 'react-icons/hi';
import { useScale } from '../../../hooks/useScale';
import { formatCurrency } from '../../../utils/helpers';

function ScaleIcon({ className }: { className?: string }) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 0a9 9 0 100 18A9 9 0 0012 4zm0 0c-1.657 0-3 1.79-3 4s1.343 4 3 4 3-1.79 3-4-1.343-4-3-4zM3 15h18" />
        </svg>
    );
}

interface CommercialScaleModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Produto seleccionado para pesar — null se não houver produto activo */
    product: { name: string; unitPrice: number; unit?: string } | null;
    /** Callback quando o utilizador confirma o peso e quer adicionar ao carrinho */
    onConfirm: (weight: number, qty: number) => void;
}

const STATUS_CONFIG = {
    disconnected: { label: 'Desconectado', color: 'text-gray-400', dot: 'bg-gray-400' },
    connecting:   { label: 'A conectar...', color: 'text-amber-500', dot: 'bg-amber-400 animate-pulse' },
    connected:    { label: 'Conectado', color: 'text-green-600', dot: 'bg-green-500' },
    reading:      { label: 'A ler...', color: 'text-blue-600', dot: 'bg-blue-500 animate-pulse' },
    error:        { label: 'Erro', color: 'text-red-500', dot: 'bg-red-500' },
};

export function CommercialScaleModal({ isOpen, onClose, product, onConfirm }: CommercialScaleModalProps) {
    const { status, isConnected, isSupported, reading, error, connect, disconnect } = useScale();
    const [captured, setCaptured] = useState<number | null>(null);

    if (!isOpen) return null;

    const conf = STATUS_CONFIG[status];
    const weightG = reading?.weight ?? 0;
    const weightKg = weightG / 1000;
    const isStable = reading?.stable ?? false;
    const total = product ? weightKg * product.unitPrice : 0;

    const handleCapture = () => {
        if (!isStable || weightG <= 0) return;
        setCaptured(weightG);
    };

    const handleConfirm = () => {
        const w = captured ?? weightG;
        if (w <= 0) return;
        // Passa o peso em kg como quantidade (1 kg = 1 unidade para produtos vendidos a kg)
        onConfirm(w, parseFloat(weightKg.toFixed(3)));
        setCaptured(null);
        onClose();
    };

    const handleClose = () => {
        setCaptured(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative z-10 w-full max-w-sm mx-4 bg-white dark:bg-dark-800 rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="bg-gray-900 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ScaleIcon className="w-4 h-4 text-white/70" />
                        <h2 className="text-white font-black text-sm uppercase tracking-tight">Balança</h2>
                        {/* Status dot */}
                        <div className="flex items-center gap-1.5 ml-2">
                            <span className={`w-2 h-2 rounded-full ${conf.dot}`} />
                            <span className={`text-[10px] font-black uppercase tracking-wider ${conf.color}`}>{conf.label}</span>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors">
                        <HiOutlineX className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Produto activo */}
                    {product && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-0.5">Produto</p>
                            <p className="font-black text-gray-900 dark:text-white text-sm">{product.name}</p>
                            <p className="text-xs text-blue-600 font-bold">{formatCurrency(product.unitPrice)} / kg</p>
                        </div>
                    )}

                    {/* Ecrã do peso — estilo display de balança */}
                    <div className={`rounded-2xl border-4 p-6 text-center transition-all ${
                        captured ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                        : isStable && weightG > 0 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                        : 'border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-900'
                    }`}>
                        {!isSupported ? (
                            <div className="space-y-2">
                                <p className="text-2xl">⚠️</p>
                                <p className="text-sm font-bold text-gray-600 dark:text-gray-400">Web Serial API não suportada</p>
                                <p className="text-xs text-gray-400">Use o Chrome 89+ para ligar à balança</p>
                            </div>
                        ) : !isConnected ? (
                            <div className="space-y-3">
                                <ScaleIcon className="w-12 h-12 mx-auto text-gray-300 dark:text-dark-600" />
                                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                                    Balança não conectada
                                </p>
                                <p className="text-xs text-gray-400">
                                    Clique em "Conectar" e seleccione<br />a porta da balança
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {/* Display digital */}
                                <div className={`font-mono font-black tracking-tight transition-all ${
                                    captured ? 'text-green-600' : isStable && weightG > 0 ? 'text-blue-600' : 'text-gray-400'
                                }`}>
                                    <span className="text-5xl">
                                        {captured !== null
                                            ? (captured / 1000).toFixed(3)
                                            : weightKg.toFixed(3)}
                                    </span>
                                    <span className="text-xl ml-2">kg</span>
                                </div>

                                {/* Indicador de estabilidade */}
                                <div className="flex items-center justify-center gap-2 mt-1">
                                    {captured ? (
                                        <span className="text-[10px] font-black uppercase text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                                            Capturado
                                        </span>
                                    ) : isStable && weightG > 0 ? (
                                        <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                                            Estável
                                        </span>
                                    ) : weightG > 0 ? (
                                        <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full animate-pulse">
                                            A estabilizar...
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-black uppercase text-gray-400">
                                            Aguardando peso
                                        </span>
                                    )}
                                </div>

                                {/* Total se houver produto */}
                                {product && (captured !== null ? captured : weightG) > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-dark-600">
                                        <p className="text-xs text-gray-500">
                                            {((captured ?? weightG) / 1000).toFixed(3)} kg × {formatCurrency(product.unitPrice)}
                                        </p>
                                        <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                                            {formatCurrency(captured !== null
                                                ? (captured / 1000) * product.unitPrice
                                                : total)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Erro */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                            <p className="text-xs font-bold text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Protocolo hint */}
                    {isConnected && (
                        <p className="text-[10px] text-gray-400 text-center">
                            Protocolos suportados: Toledo · Filizola · Mettler · Genérico (9600 baud, 8N1)
                        </p>
                    )}

                    {/* Acções */}
                    <div className="flex gap-2">
                        {!isConnected ? (
                            <button
                                onClick={connect}
                                disabled={!isSupported || status === 'connecting'}
                                className="flex-1 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg"
                            >
                                <ScaleIcon className="w-4 h-4" />
                                {status === 'connecting' ? 'A conectar...' : 'Conectar Balança'}
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={disconnect}
                                    className="px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-dark-600 text-gray-500 font-black text-xs uppercase hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                                    title="Desconectar"
                                >
                                    <HiOutlineX className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={handleCapture}
                                    disabled={!isStable || weightG <= 0}
                                    className="flex-1 py-3 rounded-xl border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-black text-xs uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <HiOutlineRefresh className="w-4 h-4" />
                                    Capturar
                                </button>

                                {product && (
                                    <button
                                        onClick={handleConfirm}
                                        disabled={(captured ?? weightG) <= 0}
                                        className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                                    >
                                        <HiOutlineCheck className="w-4 h-4" />
                                        Adicionar
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
