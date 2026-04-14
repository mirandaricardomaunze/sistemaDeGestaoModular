/**
 * QR Scanner Modal Component
 * Uses html5-qrcode to scan QR codes for deliveries and parcels.
 */

import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Modal, Button, Badge } from '../ui';
import { HiOutlineQrCode, HiOutlineCamera, HiOutlineXCircle } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';

interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (decodedText: string) => void;
    title?: string;
    description?: string;
}

export default function QRScannerModal({
    isOpen,
    onClose,
    onScan,
    title,
    description
}: QRScannerModalProps) {
    const { t } = useTranslation();
    const [scannerActive, setScannerActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    const SCANNER_ID = "qr-reader";

    useEffect(() => {
        if (isOpen && !scannerRef.current) {
            // Give a small delay to ensure modal animation is done and DOM is ready
            const timer = setTimeout(() => {
                try {
                    const config = {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
                    };

                    const scanner = new Html5QrcodeScanner(SCANNER_ID, config, false);
                    
                    scanner.render(
                        (decodedText) => {
                            // On success
                            scanner.clear();
                            scannerRef.current = null;
                            setScannerActive(false);
                            onScan(decodedText);
                        },
                        (errorMessage) => {
                            // Silent error during scanning is normal
                            if (!errorMessage.includes("NotFoundException")) {
                                console.debug("QR Scan effort:", errorMessage);
                            }
                        }
                    );

                    scannerRef.current = scanner;
                    setScannerActive(true);
                    setError(null);
                } catch (err: any) {
                    console.error("Scanner startup error:", err);
                    setError("Não foi possível aceder à câmara. Verifique as permissões.");
                }
            }, 500);

            return () => {
                clearTimeout(timer);
                if (scannerRef.current) {
                    scannerRef.current.clear().catch(err => console.error("Scanner cleanup error", err));
                    scannerRef.current = null;
                }
            };
        }
    }, [isOpen]);

    const handleClose = () => {
        if (scannerRef.current) {
            scannerRef.current.clear().catch(err => console.error("Scanner close error", err));
            scannerRef.current = null;
        }
        setScannerActive(false);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={title || t('logistics_module.qr.scannerTitle')}
            size="md"
        >
            <div className="space-y-6 flex flex-col items-center py-4">
                <div className="text-center">
                    <div className="w-16 h-16 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <HiOutlineQrCode className="w-8 h-8 text-primary-600" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {description || t('logistics_module.qr.scannerDescription')}
                    </p>
                </div>

                <div className="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-dashed border-primary-200 dark:border-primary-800 bg-gray-50 dark:bg-dark-900/50 relative">
                    <div id={SCANNER_ID} className="w-full h-[300px]"></div>
                    
                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 dark:bg-dark-800/90 p-6 text-center">
                            <HiOutlineXCircle className="w-12 h-12 text-red-500 mb-2" />
                            <p className="text-sm font-medium text-red-600">{error}</p>
                            <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
                                Recarregar Página
                            </Button>
                        </div>
                    )}

                    {!scannerActive && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-dark-900 p-6">
                            <HiOutlineCamera className="w-12 h-12 text-gray-300 mb-2 animate-pulse" />
                            <p className="text-xs text-gray-400 tracking-wider uppercase font-bold">Iniciando Câmara...</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant="primary" size="sm" className="px-3">Auto-focagem Activa</Badge>
                    <Badge variant="gray" size="sm" className="px-3">Apenas QR Code</Badge>
                </div>

                <div className="w-full pt-4 border-t dark:border-dark-700">
                    <Button variant="outline" className="w-full" onClick={handleClose}>
                        {t('common.cancel')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
