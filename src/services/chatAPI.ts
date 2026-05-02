import api from './api';
import type{ ChatResponse } from '../types/chat';

export const chatAPI = {
    /**
     * Envia mensagem para o assistente
     */
    sendMessage: async (message: string, module?: string): Promise<ChatResponse> => {
        const response = await api.post('/chat/message', { message, module });
        return response.data;
    },

    /**
     * Verifica status do assistente de IA
     */
    checkHealth: async () => {
        const response = await api.get('/chat/health');
        return response.data;
    },

    /**
     * Busca sugestões de perguntas
     */
    getSuggestions: async (module?: string) => {
        const response = await api.get('/chat/suggestions', { params: { module } });
        return response.data;
    }
};
