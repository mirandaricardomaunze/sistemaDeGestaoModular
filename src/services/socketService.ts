import { io, Socket } from 'socket.io-client';

// Socket.io client for real-time alerts
let socket: Socket | null = null;

interface SocketConfig {
    url: string;
    token?: string;
}

type AlertHandler = (alert: unknown) => void;
type ConnectionHandler = () => void;

const listeners: {
    onAlert: AlertHandler[];
    onConnect: ConnectionHandler[];
    onDisconnect: ConnectionHandler[];
} = {
    onAlert: [],
    onConnect: [],
    onDisconnect: [],
};

export const socketService = {
    /**
     * Connect to the WebSocket server
     */
    connect(config?: Partial<SocketConfig>) {
        if (socket?.connected) {
            console.log('[Socket] Already connected');
            return;
        }

        const url = config?.url || import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const token = config?.token || localStorage.getItem('token');

        socket = io(url, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            console.log('[Socket] Connected:', socket?.id);
            listeners.onConnect.forEach(handler => handler());
        });

        socket.on('disconnect', (reason: string) => {
            console.log('[Socket] Disconnected:', reason);
            listeners.onDisconnect.forEach(handler => handler());
        });

        socket.on('connect_error', (error: Error) => {
            console.error('[Socket] Connection error:', error.message);
        });

        // Listen for real-time alerts
        socket.on('alert:new', (alert: unknown) => {
            console.log('[Socket] New alert received:', alert);
            listeners.onAlert.forEach(handler => handler(alert));
        });

        socket.on('alert:updated', (alert: unknown) => {
            console.log('[Socket] Alert updated:', alert);
            listeners.onAlert.forEach(handler => handler(alert));
        });
    },

    /**
     * Disconnect from the WebSocket server
     */
    disconnect() {
        if (socket) {
            socket.disconnect();
            socket = null;
            console.log('[Socket] Manually disconnected');
        }
    },

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return socket?.connected || false;
    },

    /**
     * Subscribe to new alerts
     */
    onAlert(handler: AlertHandler) {
        listeners.onAlert.push(handler);
        return () => {
            const index = listeners.onAlert.indexOf(handler);
            if (index > -1) listeners.onAlert.splice(index, 1);
        };
    },

    /**
     * Subscribe to connection events
     */
    onConnect(handler: ConnectionHandler) {
        listeners.onConnect.push(handler);
        return () => {
            const index = listeners.onConnect.indexOf(handler);
            if (index > -1) listeners.onConnect.splice(index, 1);
        };
    },

    /**
     * Subscribe to disconnection events
     */
    onDisconnect(handler: ConnectionHandler) {
        listeners.onDisconnect.push(handler);
        return () => {
            const index = listeners.onDisconnect.indexOf(handler);
            if (index > -1) listeners.onDisconnect.splice(index, 1);
        };
    },

    /**
     * Emit an event to the server
     */
    emit(event: string, data?: unknown) {
        if (socket?.connected) {
            socket.emit(event, data);
        } else {
            console.warn('[Socket] Cannot emit, not connected');
        }
    },

    /**
     * Get the socket instance (for advanced usage)
     */
    getSocket(): Socket | null {
        return socket;
    },
};

export default socketService;
