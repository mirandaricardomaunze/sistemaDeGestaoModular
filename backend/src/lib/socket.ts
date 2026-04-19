import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

let io: Server;

export function initSocket(server: HttpServer) {
    io = new Server(server, {
        cors: {
            origin: process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || false,
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    // Authentication Middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }

            const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as any;

            // Token payload uses 'userId' (set by auth route)
            const userId = decoded.userId || decoded.id;
            if (!userId) {
                return next(new Error('Authentication error: Invalid token payload'));
            }

            // Use companyId from token directly (avoids extra DB query on every connection)
            const companyId = decoded.companyId;
            if (!companyId) {
                // Fallback: fetch from DB
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { companyId: true }
                });
                if (!user?.companyId) {
                    return next(new Error('Authentication error: User or company not found'));
                }
                socket.data.companyId = user.companyId;
            } else {
                socket.data.companyId = companyId;
            }

            // Store info in socket instance
            socket.data.userId = userId;
            next();
        } catch (err) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const companyId = socket.data.companyId;
        if (process.env.NODE_ENV !== 'production') console.log(`Socket connected: user to company room`);

        // Join company-specific room
        socket.join(companyId);

        socket.on('disconnect', () => {});
    });

    return io;
}

export function getIO() {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
}

/**
 * Emits a notification to all users in a specific company
 * @param companyId Target company
 * @param event Event name (e.g., 'notification:new')
 * @param payload Data to send
 */
export function emitToCompany(companyId: string, event: string, payload: any) {
    if (io) {
        io.to(companyId).emit(event, payload);
    }
}
