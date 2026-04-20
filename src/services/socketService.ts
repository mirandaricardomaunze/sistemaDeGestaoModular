import { logger } from '../utils/logger';
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

// Generic event listener registry (for real-time data sync)
const eventListeners: Map<string, Set<(data: unknown) => void>> = new Map();

export const socketService = {
    /**
     * Connect to the WebSocket server
     */
    connect(config?: Partial<SocketConfig>) {
        if (socket?.connected) {
            logger.info('[Socket] Already connected');
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
            logger.info('[Socket] Connected:', socket?.id);
            listeners.onConnect.forEach(handler => handler());
            // Re-register all generic event listeners after reconnect
            eventListeners.forEach((handlers, event) => {
                handlers.forEach(handler => socket!.on(event, handler));
            });
        });

        socket.on('disconnect', (reason: string) => {
            logger.info('[Socket] Disconnected:', reason);
            listeners.onDisconnect.forEach(handler => handler());
        });

        socket.on('connect_error', (error: Error) => {
            logger.error('[Socket] Connection error:', error.message);
        });

        // Listen for real-time alerts
        socket.on('alert:new', (alert: unknown) => {
            logger.info('[Socket] New alert received:', alert);
            listeners.onAlert.forEach(handler => handler(alert));
        });

        socket.on('alert:updated', (alert: unknown) => {
            logger.info('[Socket] Alert updated:', alert);
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
            logger.info('[Socket] Manually disconnected');
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
            logger.warn('[Socket] Cannot emit, not connected');
        }
    },

    /**
     * Subscribe to any server-emitted event (data sync events).
     * Returns an unsubscribe function.
     */
    on(event: string, handler: (data: unknown) => void): () => void {
        if (!eventListeners.has(event)) {
            eventListeners.set(event, new Set());
        }
        eventListeners.get(event)!.add(handler);
        if (socket?.connected) {
            socket.on(event, handler);
        }
        return () => this.off(event, handler);
    },

    /**
     * Unsubscribe a previously registered handler.
     */
    off(event: string, handler: (data: unknown) => void) {
        eventListeners.get(event)?.delete(handler);
        socket?.off(event, handler);
    },

    /**
     * Get the socket instance (for advanced usage)
     */
    getSocket(): Socket | null {
        return socket;
    },
};

export default socketService;
