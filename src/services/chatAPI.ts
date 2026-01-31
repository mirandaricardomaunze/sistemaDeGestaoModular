import api from './api';
import type{ ChatResponse } from '../types/chat';

export const chatAPI = {
    /**
     * Envia mensagem para o assistente
     */
    sendMessage: async (message: string): Promise<ChatResponse> => {
        const response = await api.post('/chat/message', { message });
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
    getSuggestions: async () => {
        const response = await api.get('/chat/suggestions');
        return response.data;
    }
};
