import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma';

// Import Routes
import authRoutes from './routes/auth';
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
import auditRoutes from './routes/audit';
import crmRoutes from './routes/crm';
import fiscalRoutes from './routes/fiscal';
import hospitalityRoutes from './routes/hospitality';
import hospitalityDashboardRoutes from './routes/hospitality-dashboard';
import hospitalityFinanceRoutes from './routes/hospitality-finance';
import ordersRoutes from './routes/orders';
import pharmacyRoutes from './routes/pharmacy';
import adminRoutes from './routes/admin';
import backupsRoutes from './routes/backups';
import gdriveRoutes from './routes/gdrive';
import paymentsRoutes from './routes/payments';
import modulesRoutes from './routes/modules';
import logisticsRoutes from './routes/logistics';

// Initialize Prisma is now handled in lib/prisma.ts

// Initialize Express
const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging (Development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
        next();
    });
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/fiscal', fiscalRoutes);
app.use('/api/hospitality', hospitalityRoutes);
app.use('/api/hospitality/dashboard', hospitalityDashboardRoutes);
app.use('/api/hospitality/finance', hospitalityFinanceRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/backups', backupsRoutes);
app.use('/api/gdrive', gdriveRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/logistics', logisticsRoutes);

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

        app.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
            console.log(`📖 API Health: http://localhost:${PORT}/api/health`);
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
