import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/useAuthStore';
import { logger } from '../utils/logger';
import { API_HOST } from '../config/env';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, token } = useAuthStore();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Only connect if user is authenticated
        if (user && token) {
            let cancelled = false;
            let newSocket: Socket | null = null;

            // socket.io-client interpreta qualquer path no URL como namespace.
            // Em produção (Vercel/Railway) VITE_API_URL pode ter sufixos como
            // /api ou /api/v1 — usar só a origin garante namespace "/".
            const rawHost = API_HOST || 'http://localhost:3001';
            let socketUrl = rawHost;
            try {
                socketUrl = new URL(rawHost).origin;
            } catch {
                // fallback silencioso: usa rawHost se não for URL válido
            }

            void import('socket.io-client').then(({ io }) => {
                if (cancelled) return;

                newSocket = io(socketUrl, {
                    auth: { token },
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionAttempts: 10,
                });

                newSocket.on('connect', () => {
                    setIsConnected(true);
                    logger.info('Connected to Real-time Notification Server');
                });

                newSocket.on('disconnect', () => {
                    setIsConnected(false);
                    logger.info('Disconnected from Real-time Server');
                });

                newSocket.on('connect_error', (err) => {
                    logger.error('Socket connection error:', err.message);
                });

                setSocket(newSocket);
            });

            return () => {
                cancelled = true;
                newSocket?.disconnect();
            };
        } else {
            // Disconnect if user logs out
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
        }
    }, [user?.id]); // Reconnect if user changes

    return (
        <SocketContext.Provider value={{ socket, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};
