import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { isTokenBlacklisted } from './redis';

let io: Server;

export function initSocket(server: HttpServer) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean);
    const corsOrigin = process.env.NODE_ENV === 'production'
        ? (allowedOrigins?.length ? allowedOrigins : false)
        : true; // allow all in development

    io = new Server(server, {
        cors: {
            origin: corsOrigin,
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

            // Reject revoked tokens (logged-out sessions)
            if (await isTokenBlacklisted(cleanToken)) {
                return next(new Error('Authentication error: Token revogado'));
            }

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

    io.on('connection', async (socket) => {
        const companyId = socket.data.companyId;
        if (process.env.NODE_ENV !== 'production') console.log(`Socket connected: user to company room`);

        // Join company-wide room (core events)
        socket.join(companyId);

        // Also join module-specific rooms so module events only reach relevant users
        try {
            const activeModules = await prisma.companyModule.findMany({
                where: { companyId, isActive: true },
                select: { moduleCode: true }
            });
            for (const { moduleCode } of activeModules) {
                socket.join(`${companyId}:${moduleCode.toLowerCase()}`);
            }
        } catch {
            // Non-fatal — user stays in company room
        }

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
 * Emits to all users in the company (core events visible to everyone).
 */
export function emitToCompany(companyId: string, event: string, payload: any) {
    if (io) {
        io.to(companyId).emit(event, payload);
    }
}

/**
 * Emits to users that belong to a specific module room.
 * Falls back to company-wide if no module specified.
 * Use this for module-specific events (hospitality:checkin, logistics:incident, etc.)
 */
export function emitToModule(companyId: string, moduleCode: string, event: string, payload: any) {
    if (io) {
        io.to(`${companyId}:${moduleCode.toLowerCase()}`).emit(event, payload);
    }
}
