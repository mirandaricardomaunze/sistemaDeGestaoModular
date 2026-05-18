import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    HiOutlineXMark,
    HiOutlinePaperAirplane,
    HiOutlineArrowDownTray,
    HiOutlineSparkles,
    HiOutlineBolt,
    HiOutlineTrash
} from 'react-icons/hi2';
import { chatAPI } from '../../services/chatAPI';
import type { Message } from '../../types/chat';
import toast from 'react-hot-toast';
import { logger } from '../../utils';
import { useChatStore } from '../../stores/useChatStore';
import { API_HOST } from '../../config/env';

interface ChatWidgetProps {
    initiallyOpen?: boolean;
    onClose?: () => void;
}

export default function ChatWidget({ initiallyOpen = false, onClose }: ChatWidgetProps) {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(initiallyOpen);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Context Detection
    const currentModule = useMemo(() => {
        const parts = location.pathname.split('/');
        return parts[1] || 'general';
    }, [location.pathname]);
    const isCommercialInsightsPage = useMemo(
        () => /^\/commercial\/(dashboard|reports|margins|insights)/.test(location.pathname),
        [location.pathname]
    );

    // Store Integration
    const { messagesByModule, addMessage, clearMessages } = useChatStore();
    const messages = messagesByModule[currentModule] || [];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    // Carregar sugestões ao abrir ou mudar de módulo
    useEffect(() => {
        const fetchSuggestions = async () => {
            if (isOpen) {
                try {
                    const data = await chatAPI.getSuggestions(currentModule);
                    if (data.suggestions && data.suggestions.length > 0) {
                        const allQuestions = data.suggestions.flatMap((s: { questions: string[] }) => s.questions);
                        setSuggestions(allQuestions.slice(0, 6));
                    }
                } catch (error) {
                    logger.error('Error loading suggestions:', error);
                }
            }
        };
        fetchSuggestions();
    }, [isOpen, currentModule]);


    const handleClose = () => {
        setIsOpen(false);
        onClose?.();
    };

    const handleSend = async (messageText?: string) => {
        const textToSend = messageText || input;
        if (!textToSend.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: textToSend,
            timestamp: new Date()
        };

        addMessage(currentModule, userMessage);
        if (!messageText) setInput('');
        setIsLoading(true);

        try {
            const response = await chatAPI.sendMessage(textToSend, currentModule);

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.message,
                timestamp: new Date(),
                pdfUrl: response.pdfUrl,
                data: response.data
            };

            addMessage(currentModule, assistantMessage);

            // Atualizar sugestões se houver novas
            if (response.suggestions && response.suggestions.length > 0) {
                setSuggestions(response.suggestions);
            }

            if (response.pdfUrl) {
                toast.success('ðŸ’¾ Relatório PDF gerado!');
            }
        } catch (error) {
            logger.error('Chat error:', error);

            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: ' Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
                timestamp: new Date()
            };

            addMessage(currentModule, errorMessage);
            toast.error('Erro ao enviar mensagem');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        handleSend(suggestion);
    };

    const handleClearHistory = () => {
        if (confirm('Deseja limpar o histórico de conversas deste módulo?')) {
            clearMessages(currentModule);
            toast.success('Histórico limpo');
        }
    };

    // UI Helpers based on module
    const moduleNameMap: Record<string, string> = {
        'pharmacy': 'Farmácia',
        'commercial': 'Comercial',
        'hospitality': 'Hospitalidade',
        'hotel': 'Hotel',
        'logistics': 'Logística',
        'restaurant': 'Restaurante',
        'general': 'Dashboard'
    };

    const assistantTitle = `Assistente ${moduleNameMap[currentModule] || 'Multicore'}`;

    return (
        <>
            {/* Botão Flutuante */}
            {!isOpen && !isCommercialInsightsPage && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 rounded-full shadow-2xl hover:shadow-primary-500/50 transition-all duration-300 flex items-center justify-center text-white z-50 group hover:scale-105"
                    title="Assistente IA"
                >
                    <HiOutlineSparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full animate-pulse border-2 border-white" />
                </button>
            )}

            {/* Janela de Chat */}
            {isOpen && (
                <div className="fixed top-20 right-6 z-50 flex justify-end items-start pointer-events-none">
                    <div 
                        className="w-[420px] min-w-[320px] max-w-[80vw] h-[calc(100vh-7rem)] shadow-2xl rounded-lg pointer-events-auto overflow-hidden border border-gray-200 dark:border-dark-700"
                    >
                        <div className="bg-white dark:bg-dark-800 flex flex-col w-full h-full">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 text-white shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                            <HiOutlineBolt className="w-6 h-6" />
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-primary-600 animate-pulse" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-base truncate">{assistantTitle}</h3>
                                        <p className="text-[10px] text-primary-100 uppercase tracking-widest font-black opacity-80">Online agora</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleClearHistory}
                                        className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors cursor-pointer"
                                        title="Limpar Histórico"
                                    >
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleClose}
                                        className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors cursor-pointer"
                                        aria-label="Fechar chat"
                                    >
                                        <HiOutlineXMark className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-gray-50 dark:bg-dark-900">
                                {messages.length === 0 && (
                                    <div className="text-center py-8">
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 flex items-center justify-center">
                                            <HiOutlineSparkles className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                            Assistente de Inteligência
                                        </h4>
                                        <p className="text-[11px] uppercase tracking-widest font-black text-gray-400 mb-6">
                                            Especializado em {moduleNameMap[currentModule] || 'Multicore'}
                                        </p>

                                        {/* Sugestões Iniciais */}
                                        <div className="space-y-2 max-w-sm mx-auto px-2">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Sugestões para você:</p>
                                            {suggestions.map((suggestion, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => handleSuggestionClick(suggestion)}
                                                    className="w-full text-left px-4 py-3 bg-white dark:bg-dark-800 rounded-lg text-xs hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all border border-gray-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700 group hover:shadow-md"
                                                >
                                                    <span className="text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 font-medium">
                                                        {suggestion}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {messages.map(message => (
                                    <div
                                        key={message.id}
                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[90%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                                ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/30 rounded-tr-none'
                                                : 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white shadow-md border border-gray-200 dark:border-dark-700 rounded-tl-none'
                                                }`}
                                        >
                                            <div className="text-sm markdown-body overflow-hidden">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        table: ({ ...props }) => (
                                                            <div className="overflow-x-auto custom-scrollbar my-4 rounded-lg border border-gray-200 dark:border-dark-700 shadow-sm">
                                                                <table className="w-full text-left border-collapse text-xs" {...props} />
                                                            </div>
                                                        ),
                                                        thead: ({ ...props }) => (
                                                            <thead className="bg-gray-50 dark:bg-dark-700 text-gray-700 dark:text-gray-300 font-bold" {...props} />
                                                        ),
                                                        th: ({ ...props }) => (
                                                            <th className="px-3 py-2 border-b border-gray-200 dark:border-dark-600" {...props} />
                                                        ),
                                                        td: ({ ...props }) => (
                                                            <td className="px-3 py-2 border-b border-gray-100 dark:border-dark-700 last:border-0" {...props} />
                                                        ),
                                                        p: ({ ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                                        strong: ({ ...props }) => <strong className="font-black text-primary-600 dark:text-primary-400" {...props} />,
                                                        ul: ({ ...props }) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                                                        ol: ({ ...props }) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                                                    }}
                                                >
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>

                                            {message.pdfUrl && (
                                                <a
                                                    href={`${API_HOST}${message.pdfUrl}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`flex items-center gap-2 mt-3 pt-3 border-t text-[11px] font-bold transition-colors ${message.role === 'user'
                                                        ? 'border-primary-400 text-primary-100 hover:text-white'
                                                        : 'border-gray-200 dark:border-dark-700 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300'
                                                        }`}
                                                >
                                                    <HiOutlineArrowDownTray className="w-4 h-4" />
                                                    BAIXAR RELATÓRIO PDF
                                                </a>
                                            )}

                                            <p className={`text-[10px] mt-2 font-medium opacity-60 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                                                {new Date(message.timestamp).toLocaleTimeString('pt-MZ', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-white dark:bg-dark-800 rounded-2xl rounded-tl-none px-4 py-3 shadow-md border border-gray-200 dark:border-dark-700">
                                            <div className="flex gap-1.5">
                                                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" />
                                                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-white dark:bg-dark-800 border-t border-gray-200 dark:border-dark-700 shrink-0">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder={`Pergunte sobre ${moduleNameMap[currentModule] || 'o sistema'}...`}
                                        className="flex-1 px-4 py-3 bg-gray-100 dark:bg-dark-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all border border-transparent focus:border-primary-500"
                                        disabled={isLoading}
                                        maxLength={1000}
                                    />
                                    <button
                                        onClick={() => handleSend()}
                                        disabled={!input.trim() || isLoading}
                                        className="p-3 bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 disabled:shadow-none"
                                    >
                                        <HiOutlinePaperAirplane className="w-5 h-5 rotate-90" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-center gap-2 mt-3">
                                    <HiOutlineSparkles className="w-3 h-3 text-primary-500" />
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
                                        Gemini AI Intelligence
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
