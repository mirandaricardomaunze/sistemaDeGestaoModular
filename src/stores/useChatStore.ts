import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message } from '../types/chat';

interface ChatState {
    // Messages keyed by module ID: { "pharmacy": [...], "commercial": [...], "general": [...] }
    messagesByModule: Record<string, Message[]>;
    
    // Actions
    addMessage: (module: string, message: Message) => void;
    clearMessages: (module: string) => void;
    setMessages: (module: string, messages: Message[]) => void;
}

export const useChatStore = create<ChatState>()(
    persist(
        (set) => ({
            messagesByModule: {},

            addMessage: (module, message) => set((state) => {
                const moduleMessages = state.messagesByModule[module] || [];
                // Limit history to 50 messages per module to save space
                const newMessages = [...moduleMessages, message].slice(-50);
                
                return {
                    messagesByModule: {
                        ...state.messagesByModule,
                        [module]: newMessages
                    }
                };
            }),

            clearMessages: (module) => set((state) => ({
                messagesByModule: {
                    ...state.messagesByModule,
                    [module]: []
                }
            })),

            setMessages: (module, messages) => set((state) => ({
                messagesByModule: {
                    ...state.messagesByModule,
                    [module]: messages
                }
            })),
        }),
        {
            name: 'multicore-chat-store',
        }
    )
);
