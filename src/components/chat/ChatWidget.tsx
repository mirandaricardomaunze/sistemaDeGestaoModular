import { useState, useRef, useEffect } from 'react';
import {
    HiOutlineX,
    HiOutlinePaperAirplane,
    HiOutlineDownload,
    HiOutlineSparkles,
    HiOutlineLightningBolt
} from 'react-icons/hi';
import { chatAPI } from '../../services/chatAPI';
import type { Message } from '../../types/chat';
import toast from 'react-hot-toast';

export default function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Carregar sugestões ao abrir
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            loadSuggestions();
        }
    }, [isOpen]);

    const loadSuggestions = async () => {
        try {
            const data = await chatAPI.getSuggestions();
            if (data.suggestions && data.suggestions.length > 0) {
                const allQuestions = data.suggestions.flatMap((s: any) => s.questions);
                setSuggestions(allQuestions.slice(0, 6));
            }
        } catch (error) {
            console.error('Error loading suggestions:', error);
        }
    };

    const handleClose = () => {
        console.log('Closing chat widget');
        setIsOpen(false);
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await chatAPI.sendMessage(input);

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.message,
                timestamp: new Date(),
                pdfUrl: response.pdfUrl,
                data: response.data
            };

            setMessages(prev => [...prev, assistantMessage]);

            // Atualizar sugestões
            if (response.suggestions && response.suggestions.length > 0) {
                setSuggestions(response.suggestions);
            }

            // Notificar se PDF foi gerado
            if (response.pdfUrl) {
                toast.success('📄 Relatório PDF gerado!');
            }
        } catch (error: any) {
            console.error('Chat error:', error);

            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, errorMessage]);
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
        setInput(suggestion);
    };

    return (
        <>
            {/* Botão Flutuante */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 rounded-full shadow-2xl hover:shadow-primary-500/50 transition-all duration-300 flex items-center justify-center text-white z-50 group hover:scale-110"
                    title="Assistente IA"
                >
                    <HiOutlineSparkles className="w-7 h-7 group-hover:rotate-12 transition-transform" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse border-2 border-white" />
                </button>
            )}

            {/* Janela de Chat */}
            {isOpen && (
                <div className="fixed top-20 right-6 w-[420px] max-h-[calc(100vh-7rem)] bg-white dark:bg-dark-800 rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 dark:border-dark-700 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 text-white">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <HiOutlineLightningBolt className="w-6 h-6" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-primary-600 animate-pulse" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Assistente IA</h3>
                                <p className="text-xs text-primary-100">Sempre pronto para ajudar</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors relative z-10 cursor-pointer"
                            style={{ pointerEvents: 'auto' }}
                            type="button"
                            aria-label="Fechar chat"
                        >
                            <HiOutlineX className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-dark-900">
                        {messages.length === 0 && (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 flex items-center justify-center">
                                    <HiOutlineSparkles className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                                </div>
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                    Olá! Como posso ajudar?
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                    Pergunte sobre vendas, stock, clientes ou finanças
                                </p>

                                {/* Sugestões Iniciais */}
                                <div className="space-y-2 max-w-sm mx-auto">
                                    {suggestions.slice(0, 4).map((suggestion, index) => (
                                        <button
                                            key={index}
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            className="w-full text-left px-4 py-3 bg-white dark:bg-dark-800 rounded-xl text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border border-gray-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700 group"
                                        >
                                            <span className="text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
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
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                        ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/30'
                                        : 'bg-white dark:bg-dark-800 text-gray-900 dark:text-white shadow-md border border-gray-200 dark:border-dark-700'
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

                                    {message.pdfUrl && (
                                        <a
                                            href={`http://localhost:3001${message.pdfUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`flex items-center gap-2 mt-3 pt-3 border-t text-xs font-medium transition-colors ${message.role === 'user'
                                                ? 'border-primary-400 text-primary-100 hover:text-white'
                                                : 'border-gray-200 dark:border-dark-700 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300'
                                                }`}
                                        >
                                            <HiOutlineDownload className="w-4 h-4" />
                                            Baixar Relatório PDF
                                        </a>
                                    )}

                                    <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-primary-200' : 'text-gray-400 dark:text-gray-500'
                                        }`}>
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
                                <div className="bg-white dark:bg-dark-800 rounded-2xl px-4 py-3 shadow-md border border-gray-200 dark:border-dark-700">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" />
                                        <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                        <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-white dark:bg-dark-800 border-t border-gray-200 dark:border-dark-700">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Digite sua pergunta..."
                                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-dark-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all"
                                disabled={isLoading}
                                maxLength={1000}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className="px-4 py-3 bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 disabled:shadow-none"
                            >
                                <HiOutlinePaperAirplane className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                            Powered by Gemini AI • Seus dados ficam seguros
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
