import React, { useRef, useEffect, useState } from 'react';
import { Button } from './index';
import { HiOutlineTrash, HiOutlineCheck } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';

interface SignaturePadProps {
    onSave: (signature: string) => void;
    onClear?: () => void;
    height?: number;
}

export function SignaturePad({ onSave, onClear, height = 200 }: SignaturePadProps) {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isEmpty, setIsEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set up canvas styling
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Fix blurry canvas on high DPI screens
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        // Re-apply styling after resize/rescale
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        setIsEmpty(false);
        const pos = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const pos = getPos(e);
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);
        if (onClear) onClear();
    };

    const save = () => {
        if (isEmpty) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
    };

    return (
        <div className="space-y-3">
            <div className="relative border-2 border-dashed border-gray-300 dark:border-dark-600 rounded-2xl overflow-hidden bg-gray-50 dark:bg-dark-900/50">
                <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full cursor-crosshair touch-none"
                    style={{ height }}
                />
                
                {isEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-sm text-gray-400 dark:text-gray-500 font-medium italic">
                            {t('logistics_module.delivery.sign')}
                        </p>
                    </div>
                )}
            </div>

            <div className="flex gap-2 justify-end">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clear}
                    disabled={isEmpty}
                    leftIcon={<HiOutlineTrash className="w-4 h-4" />}
                >
                    {t('logistics_module.delivery.clear')}
                </Button>
                <Button 
                    variant="primary" 
                    size="sm" 
                    onClick={save}
                    disabled={isEmpty}
                    leftIcon={<HiOutlineCheck className="w-4 h-4" />}
                >
                    {t('common.confirm')}
                </Button>
            </div>
        </div>
    );
}
