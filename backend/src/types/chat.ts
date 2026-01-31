export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: {
        query?: string;
        data?: any;
        pdfUrl?: string;
    };
}

export interface ChatRequest {
    message: string;
    context?: {
        module: string;
        userId: string;
        companyId: string;
    };
}

export interface ChatResponse {
    message: string;
    data?: any;
    pdfUrl?: string;
    suggestions?: string[];
}

export interface AIPrompt {
    system: string;
    user: string;
    context: any;
}

export interface Intent {
    type: 'sales' | 'inventory' | 'customers' | 'financial' | 'hospitality' | 'logistics' | 'pharmacy' | 'general';
    generatePDF: boolean;
    reportType: 'daily' | 'weekly' | 'monthly' | 'yearly';
    timeframe: {
        start: Date;
        end: Date;
    };
}
