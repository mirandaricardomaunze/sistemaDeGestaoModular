export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    pdfUrl?: string;
    data?: any;
}

export interface ChatState {
    messages: Message[];
    isLoading: boolean;
    isOpen: boolean;
}

export interface ChatResponse {
    message: string;
    data?: any;
    pdfUrl?: string;
    suggestions?: string[];
}

export interface ChatRequest {
    message: string;
}

export interface Suggestion {
    category: string;
    icon: string;
    questions: string[];
}
