import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/useAuthStore';
import { logger } from '../utils/logger';

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
            // Extract base URL from VITE_API_URL (remove /api suffix) - Socket.io needs the base path
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const socketUrl = apiUrl.replace(/\/api$/, '');
            
            const newSocket = io(socketUrl, {
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

            return () => {
                newSocket.disconnect();
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
