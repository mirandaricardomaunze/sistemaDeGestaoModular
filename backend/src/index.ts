import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { logger } from './utils/logger';

// 🔒 CRITICAL: Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    logger.error(`❌ ERRO CRÍTICO: Variáveis de ambiente obrigatórias não definidas: ${missingEnvVars.join(', ')}`);
    logger.error('Configure estas variáveis no arquivo .env antes de iniciar o servidor.');
    process.exit(1);
}

// Import Routes
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import productsRoutes from './routes/products';
import customersRoutes from './routes/customers';
import suppliersRoutes from './routes/suppliers';
import salesRoutes from './routes/sales';
import invoicesRoutes from './routes/invoices';
import employeesRoutes from './routes/employees';
import warehousesRoutes from './routes/warehouses';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';
import campaignsRoutes from './routes/campaigns';
import alertsRoutes from './routes/alerts';
import ordersRoutes from './routes/orders';
import crmRoutes from './routes/crm';
import fiscalRoutes from './routes/fiscal';
import auditRoutes from './routes/audit';
import backupsRoutes from './routes/backups';
import gdriveRoutes from './routes/gdrive';
import hospitalityRoutes from './routes/hospitality';
import hospitalityDashboardRoutes from './routes/hospitality-dashboard';
import hospitalityFinanceRoutes from './routes/hospitality-finance';
import publicRoutes from './routes/public';
import pharmacyRoutes from './routes/pharmacy';
import migrationRoutes from './routes/migration';
import modulesRoutes from './routes/modules';
import chatRoutes from './routes/chat';
import { authenticate } from './middleware/auth';


// Initialize Prisma
export const prisma = new PrismaClient();

// Initialize Express
const app = express();

// 🔒 Security Headers with Helmet
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
}));

// 🚀 Compression
app.use(compression());

// 🔒 CORS Configuration (Secure - No Wildcards)
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Audit Middleware (Logs all POST, PUT, DELETE requests)
import { auditMiddleware } from './middleware/audit';
import { tenantMiddleware } from './middleware/tenant';
app.use(auditMiddleware);

// Request Logging (All Environments with Winston)
app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });

    next();
});


// 📖 API Documentation (Swagger)
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Sistema API Documentation',
}));

// PUBLIC API Routes (No Authentication Required)
app.use('/api/public', publicRoutes);

// MIGRATION Routes (Temporary - No Auth Required)
app.use('/api/migration', migrationRoutes);

// MODULES Routes (Public - for registration form)
app.use('/api/modules', modulesRoutes);

// API Routes (Authentication Required)
// Note: Some routes like /auth handle their own authentication, 
// but for the rest, we apply global tenant isolation.
app.use('/api/auth', authRoutes);

// Admin Routes (Super Admin Only - No Tenant Isolation)
app.use('/api/admin', adminRoutes);

// Apply tenantMiddleware to all other business routes
app.use('/api/products', authenticate, tenantMiddleware, productsRoutes);
app.use('/api/customers', authenticate, tenantMiddleware, customersRoutes);
app.use('/api/suppliers', authenticate, tenantMiddleware, suppliersRoutes);
app.use('/api/sales', authenticate, tenantMiddleware, salesRoutes);
app.use('/api/invoices', authenticate, tenantMiddleware, invoicesRoutes);
app.use('/api/employees', authenticate, tenantMiddleware, employeesRoutes);
app.use('/api/warehouses', authenticate, tenantMiddleware, warehousesRoutes);
app.use('/api/dashboard', authenticate, tenantMiddleware, dashboardRoutes);
app.use('/api/settings', authenticate, tenantMiddleware, settingsRoutes);
app.use('/api/campaigns', authenticate, tenantMiddleware, campaignsRoutes);
app.use('/api/alerts', authenticate, tenantMiddleware, alertsRoutes);
app.use('/api/orders', authenticate, tenantMiddleware, ordersRoutes);
app.use('/api/crm', authenticate, tenantMiddleware, crmRoutes);
app.use('/api/fiscal', authenticate, tenantMiddleware, fiscalRoutes);
app.use('/api/audit', authenticate, tenantMiddleware, auditRoutes);
app.use('/api/backups', authenticate, tenantMiddleware, backupsRoutes);
app.use('/api/gdrive', gdriveRoutes);
app.use('/api/hospitality', authenticate, tenantMiddleware, hospitalityRoutes);
app.use('/api/hospitality/dashboard', authenticate, tenantMiddleware, hospitalityDashboardRoutes);
app.use('/api/hospitality/finance', authenticate, tenantMiddleware, hospitalityFinanceRoutes);
app.use('/api/pharmacy', authenticate, tenantMiddleware, pharmacyRoutes);
app.use('/api/chat', authenticate, tenantMiddleware, chatRoutes);


// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint não encontrado',
        path: req.path
    });
});

// Error Handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start Server
const PORT = process.env.PORT || 3001;

const start = async () => {
    try {
        await prisma.$connect();
        console.log('✅ Conectado ao PostgreSQL');

        // Initialize Workers (Temporarily disabled due to Redis connection issues)
        // import('./workers/emailWorker').then(() => {
        //     console.log('📨 Email Worker iniciado');
        // }).catch(err => {
        //     console.warn('⚠️ Email Worker não iniciado (Redis indisponível):', err.message);
        // });

        // Initialize Backup Service
        import('./services/backup.service').then(async ({ backupService }) => {
            await backupService.initialize();
            console.log('📦 Serviço de Backup iniciado');
        }).catch(err => {
            console.warn('⚠️ Serviço de Backup não iniciado:', err.message);
        });

        app.listen(PORT, () => {
            console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
            console.log(`📖 API Health: http://localhost:${PORT}/api/health`);
        });

        // Schedule Expiration Alerts (Daily at 08:00)
        import('./services/alert.service').then(({ checkExpiringBatches }) => {
            cron.schedule('0 8 * * *', () => {
                checkExpiringBatches();
            });

            // Run once on startup for testing in dev
            if (process.env.NODE_ENV === 'development') {
                console.log('🧪 Executando verificação de validade inicial (Ambiente Dev)...');
                checkExpiringBatches();
            }
        }).catch(err => {
            console.warn('⚠️ Alert Service não iniciado:', err.message);
        });

    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
};

// Graceful Shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

start();

// Force restart to apply route changes - 504 fix
