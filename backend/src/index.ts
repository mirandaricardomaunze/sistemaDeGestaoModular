import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { prisma } from './lib/prisma';
import { initSocket } from './lib/socket';
import { errorHandler } from './middleware/error.middleware';
import { authenticate, AuthRequest } from './middleware/auth';
import { ApiError } from './middleware/error.middleware';

// Import Routes (Selection of main ones for brevity in this refactor)
import authRoutes from './routes/auth';
import salesRoutes from './routes/sales';
import productsRoutes from './routes/products';
import commercialRoutes from './routes/commercial';
import commercialFinanceRoutes from './routes/commercialFinance';
import customersRoutes from './routes/customers';
import hospitalityRoutes from './routes/hospitality';
import logisticsRoutes from './routes/logistics';
import logisticsFinanceRoutes from './routes/logisticsFinance';
import bottleStoreRoutes from './routes/bottleStore';
import bottleStoreFinanceRoutes from './routes/bottleStoreFinance';
import aiRoutes from './routes/ai';
import chatRoutes from './routes/chat';
import gdriveRoutes from './routes/gdrive';
import alertsRoutes from './routes/alerts';
import settingsRoutes from './routes/settings';
import auditRoutes from './routes/audit';
import crmRoutes from './routes/crm';
import fiscalRoutes from './routes/fiscal';
import adminRoutes from './routes/admin';
import employeesRoutes from './routes/employees';
import invoicesRoutes from './routes/invoices';
import paymentsRoutes from './routes/payments';
import pharmacyRoutes from './routes/pharmacy';
import pharmacyFinanceRoutes from './routes/pharmacyFinance';
import suppliersRoutes from './routes/suppliers';
import warehousesRoutes from './routes/warehouses';
import backupsRoutes from './routes/backups';
import campaignsRoutes from './routes/campaigns';
import dashboardRoutes from './routes/dashboard';
import exportRoutes from './routes/export';
import hospitalityDashboardRoutes from './routes/hospitalityDashboard';
import hospitalityFinanceRoutes from './routes/hospitalityFinance';
import migrationRoutes from './routes/migration';
import modulesRoutes from './routes/modules';
import ordersRoutes from './routes/orders';
import publicRoutes from './routes/public';
import restaurantRoutes from './routes/restaurant';
import restaurantFinanceRoutes from './routes/restaurantFinance';
import batchesRoutes from './routes/batches';
import validitiesRoutes from './routes/validities';
import hospitalityChannelsRoutes from './routes/hospitalityChannels';
import calendarRoutes from './routes/calendar';

import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimiters } from './middleware/rateLimit';
import path from 'path';

import { auditMiddleware } from './middleware/audit';
import { logger } from './utils/logger';

// ── Startup Validation ──────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET must be set and at least 32 characters long.');
    process.exit(1);
}

export const app = express();

// Security Middleware
app.use(helmet({
    strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    contentSecurityPolicy: false // Frontend handles its own CSP
}));
app.use(cookieParser());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    console.error('FATAL: ALLOWED_ORIGINS must be configured in production.');
    process.exit(1);
}

app.use(cors({
    origin: (origin, callback) => {
        // In development without an allowlist, permit all origins
        if (process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0) {
            return callback(null, true);
        }
        // Reject requests without an Origin header in production (prevents CSRF from forms)
        if (!origin) {
            if (process.env.NODE_ENV === 'production') {
                return callback(new Error('Origin header is required'));
            }
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
    },
    credentials: true,
    maxAge: 3600
}));
app.use(express.json({ limit: '50kb' })); // Protection against large payloads
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Authenticated endpoint for prescription images (medical PII — must not be public)
app.get('/uploads/prescriptions/:filename', authenticate, async (req: AuthRequest, res) => {
    const filename = path.basename(req.params.filename); // strip any path traversal
    const filePath = path.join(process.cwd(), 'uploads', 'prescriptions', filename);

    const prescription = await prisma.prescription.findFirst({
        where: { imageUrl: { contains: filename }, companyId: req.companyId }
    });
    if (!prescription) throw ApiError.forbidden('Acesso negado');

    res.sendFile(filePath);
});

// HTTP request/response logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            ip: req.ip,
            userId: (req as any).userId,
            companyId: (req as any).companyId
        });
    });
    next();
});

// Apply rate limiting to all requests
app.use('/api', rateLimiters.api);
// Stricter limits on financial and export endpoints
app.use('/api/sales', rateLimiters.financial);
app.use('/api/payments', rateLimiters.financial);
app.use('/api/invoices', rateLimiters.financial);
app.use('/api/pharmacy/sales', rateLimiters.financial);
app.use('/api/export', rateLimiters.export);

// Clamp pagination params to prevent DoS via large limit values
app.use((req, _res, next) => {
    if (req.query.limit !== undefined) {
        const parsed = parseInt(req.query.limit as string);
        if (!isNaN(parsed)) {
            req.query.limit = Math.min(500, Math.max(1, parsed)).toString();
        }
    }
    next();
});

// Audit mutations (POST, PUT, DELETE, PATCH)
app.use(auditMiddleware as any);

// Main API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/commercial', commercialRoutes);
app.use('/api/commercial/finance', commercialFinanceRoutes);
app.use('/api/customers', customersRoutes);

// Specific Hospitality Routes First
app.use('/api/hospitality/dashboard', hospitalityDashboardRoutes);
app.use('/api/hospitality/finance', hospitalityFinanceRoutes);
app.use('/api/hospitality/channels', hospitalityChannelsRoutes);

// General Hospitality Route Last
app.use('/api/hospitality', hospitalityRoutes);

app.use('/api/logistics', logisticsRoutes);
app.use('/api/logistics/finance', logisticsFinanceRoutes);
app.use('/api/bottleStore', bottleStoreRoutes);
app.use('/api/bottle-store/finance', bottleStoreFinanceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gdrive', gdriveRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/fiscal', fiscalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/backups', backupsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/hospitalityDashboard', hospitalityDashboardRoutes);
app.use('/api/hospitalityFinance', hospitalityFinanceRoutes);
app.use('/api/pharmacy/finance', pharmacyFinanceRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/restaurant/finance', restaurantFinanceRoutes);
app.use('/api/batches', batchesRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api', validitiesRoutes);

app.get('/api/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'OK', database: 'CONNECTED', timestamp: new Date() });
    } catch (error) {
        res.status(503).json({ status: 'ERROR', database: 'DISCONNECTED', timestamp: new Date() });
    }
});
app.use(errorHandler);

import { startCronJobs } from './cron/automation';
import { initRedis } from './config/redis';
import { createEmailWorker } from './workers/emailWorker';

const PORT = process.env.PORT || 3001;
const httpServer = createServer(app);
const io = initSocket(httpServer);

let emailWorker: ReturnType<typeof createEmailWorker> = null;

const start = async () => {
    try {
        await prisma.$connect();

        // Initialize Redis (probes port first — no noise if Redis is down)
        await initRedis();

        // Start background tasks
        startCronJobs();

        // BullMQ email worker (only when Redis is available)
        emailWorker = createEmailWorker();
        if (emailWorker) {
            logger.info('Email worker started (Redis connected)');
        } else {
            logger.warn('Email worker disabled (Redis not available)');
        }

        httpServer.listen(PORT, () => console.log(`🚀 MultiCore ERP running on port ${PORT} (with WebSockets)`));
    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
};

if (process.env.NODE_ENV !== 'test') {
    start();
}

// ── Graceful Shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
    console.log(`\n${signal} received -- shutting down gracefully...`);
    httpServer.close(async () => {
        try {
            if (emailWorker) await emailWorker.close();
            await prisma.$disconnect();
            console.log('Database disconnected. Goodbye.');
            process.exit(0);
        } catch (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
    });

    // Force shutdown after 10s if connections are still open
    setTimeout(() => {
        console.error('Forcing shutdown after timeout.');
        process.exit(1);
    }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
