import {
    HiOutlineShare,
    HiOutlineMail,
    HiOutlineDocumentDownload,
    HiOutlineX,
    HiOutlineTable,
    HiOutlineClipboardCopy,
    HiOutlineCheck,
} from 'react-icons/hi';
import { FaWhatsapp } from 'react-icons/fa';
import { useState } from 'react';
import { Button, Modal } from '../ui';
import toast from 'react-hot-toast';

interface ShareButtonProps {
    title: string;
    description?: string;
    fileName?: string;
    onGeneratePDF?: () => void;
    onGenerateExcel?: () => void;
    companyName?: string;
    variant?: 'button' | 'icon';
    size?: 'sm' | 'md' | 'lg';
}

export default function ShareButton({
    title,
    description = '',
    fileName = 'documento',
    onGeneratePDF,
    onGenerateExcel,
    companyName = 'Sistema de Gestão',
    variant = 'button',
    size = 'md',
}: ShareButtonProps) {
    const [showModal, setShowModal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [step, setStep] = useState<'download' | 'share'>('download');

    // Download PDF
    const handleDownloadPDF = () => {
        if (onGeneratePDF) {
            onGeneratePDF();
            toast.success('📥 PDF baixado! Agora pode partilhar.');
            setStep('share');
        } else {
            toast.error('Função de gerar PDF não disponível');
        }
    };

    // Download Excel
    const handleDownloadExcel = () => {
        if (onGenerateExcel) {
            onGenerateExcel();
            toast.success('📥 Excel baixado! Agora pode partilhar.');
            setStep('share');
        } else {
            toast.error('Função de gerar Excel não disponível');
        }
    };

    const shareMessage = `📊 *${title}*\n\n${description}\n\n📎 Documento: ${fileName}.pdf\n\n✅ Gerado por ${companyName}`;
    const emailSubject = `${title} - ${companyName}`;
    const emailBody = `Olá,\n\nSegue em anexo o documento: ${title}\n\n${description}\n\nPor favor, veja o ficheiro anexo.\n\nAtenciosamente,\n${companyName}`;

    // Copy message to clipboard
    const handleCopyMessage = async () => {
        try {
            await navigator.clipboard.writeText(shareMessage.replace(/\*/g, ''));
            setCopied(true);
            toast.success('📋 Mensagem copiada!');
            setTimeout(() => setCopied(false), 3000);
        } catch {
            toast.error('Erro ao copiar');
        }
    };

    // Share via WhatsApp
    const handleShareWhatsApp = () => {
        const encodedMessage = encodeURIComponent(shareMessage.replace(/\*/g, ''));
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
        toast.success('💬 Abrindo WhatsApp... Anexe o ficheiro baixado!');
    };

    // Share via Email
    const handleShareEmail = () => {
        const mailtoUrl = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        window.location.href = mailtoUrl;
        toast.success('📧 Abrindo email... Anexe o ficheiro baixado!');
    };

    return (
        <>
            {variant === 'button' ? (
                <Button
                    variant="outline"
                    size={size}
                    onClick={() => {
                        setShowModal(true);
                        setStep('download');
                        setCopied(false);
                    }}
                    leftIcon={<HiOutlineShare className="w-4 h-4" />}
                >
                    Partilhar
                </Button>
            ) : (
                <button
                    onClick={() => {
                        setShowModal(true);
                        setStep('download');
                        setCopied(false);
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400 transition-colors"
                    title="Partilhar"
                >
                    <HiOutlineShare className="w-5 h-5" />
                </button>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title="Partilhar Documento"
                size="md"
            >
                <div className="space-y-5">
                    {/* Document Info */}
                    <div className="p-4 bg-gray-50 dark:bg-dark-700 rounded-xl">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            {title}
                        </h3>
                        {description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Step Indicator */}
                    <div className="flex items-center justify-center gap-4">
                        <div className={`flex items-center gap-2 ${step === 'download' ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'download' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
                            <span className="text-sm">Baixar</span>
                        </div>
                        <div className="w-8 h-0.5 bg-gray-200" />
                        <div className={`flex items-center gap-2 ${step === 'share' ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 'share' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                            <span className="text-sm">Partilhar</span>
                        </div>
                    </div>

                    {step === 'download' && (
                        <>
                            {/* Download Options */}
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    📥 <strong>Passo 1:</strong> Primeiro, baixe o ficheiro
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={handleDownloadPDF}
                                        disabled={!onGeneratePDF}
                                        className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-dark-600 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                            <HiOutlineDocumentDownload className="w-5 h-5 text-red-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-gray-900 dark:text-white">PDF</p>
                                            <p className="text-xs text-gray-500">Documento PDF</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={handleDownloadExcel}
                                        disabled={!onGenerateExcel}
                                        className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-dark-600 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                            <HiOutlineTable className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-gray-900 dark:text-white">Excel</p>
                                            <p className="text-xs text-gray-500">Planilha XLS</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={() => setStep('share')}
                                className="w-full text-sm text-primary-600 hover:underline"
                            >
                                Já tenho o ficheiro → Ir para partilha
                            </button>
                        </>
                    )}

                    {step === 'share' && (
                        <>
                            {/* Share Options */}
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    📤 <strong>Passo 2:</strong> Escolha como partilhar e anexe o ficheiro
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {/* WhatsApp */}
                                    <button
                                        onClick={handleShareWhatsApp}
                                        className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-dark-600 hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                                            <FaWhatsapp className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-gray-900 dark:text-white">WhatsApp</p>
                                            <p className="text-xs text-gray-500">Enviar mensagem</p>
                                        </div>
                                    </button>

                                    {/* Email */}
                                    <button
                                        onClick={handleShareEmail}
                                        className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 dark:border-dark-600 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                                            <HiOutlineMail className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium text-gray-900 dark:text-white">Email</p>
                                            <p className="text-xs text-gray-500">Enviar por email</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Copy Message */}
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                                <p className="text-sm text-amber-800 dark:text-amber-300 mb-2">
                                    💡 <strong>Dica:</strong> Copie a mensagem e anexe o ficheiro manualmente
                                </p>
                                <button
                                    onClick={handleCopyMessage}
                                    className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
                                >
                                    {copied ? (
                                        <>
                                            <HiOutlineCheck className="w-4 h-4" />
                                            Copiado!
                                        </>
                                    ) : (
                                        <>
                                            <HiOutlineClipboardCopy className="w-4 h-4" />
                                            Copiar mensagem
                                        </>
                                    )}
                                </button>
                            </div>

                            <button
                                onClick={() => setStep('download')}
                                className="w-full text-sm text-gray-500 hover:text-gray-700"
                            >
                                ← Voltar para baixar ficheiro
                            </button>
                        </>
                    )}

                    {/* Close */}
                    <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => setShowModal(false)}
                        leftIcon={<HiOutlineX className="w-4 h-4" />}
                    >
                        Fechar
                    </Button>
                </div>
            </Modal>
        </>
    );
}

// Export helper functions for use without the component
export const shareUtils = {
    shareViaWhatsApp: (message: string) => {
        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    },

    shareViaEmail: (subject: string, body: string, to?: string) => {
        const toParam = to ? to : '';
        window.location.href = `mailto:${toParam}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    },

    downloadBlob: (blob: Blob, fileName: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    },

    copyToClipboard: async (text: string): Promise<boolean> => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return false;
        }
    },

    // Generate CSV from data array
    generateCSV: (data: Record<string, unknown>[], headers?: string[]): Blob => {
        if (data.length === 0) return new Blob([''], { type: 'text/csv' });

        const keys = headers || Object.keys(data[0]);
        const csvRows = [
            keys.join(','),
            ...data.map(row => keys.map(key => JSON.stringify(row[key] ?? '')).join(','))
        ];

        return new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    },
};
