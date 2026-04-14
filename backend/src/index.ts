import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
// ... we need to see index.ts first before replacing
import cors from 'cors';
import { prisma } from './lib/prisma';
import { errorHandler } from './middleware/error.middleware';

// Import Routes (Selection of main ones for brevity in this refactor)
import authRoutes from './routes/auth';
import salesRoutes from './routes/sales';
import productsRoutes from './routes/products';
import customersRoutes from './routes/customers';
import hospitalityRoutes from './routes/hospitality';
import logisticsRoutes from './routes/logistics';
import bottleStoreRoutes from './routes/bottle-store';
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
import suppliersRoutes from './routes/suppliers';
import warehousesRoutes from './routes/warehouses';
import backupsRoutes from './routes/backups';
import campaignsRoutes from './routes/campaigns';
import dashboardRoutes from './routes/dashboard';
import exportRoutes from './routes/export';
import hospitalityDashboardRoutes from './routes/hospitality-dashboard';
import hospitalityFinanceRoutes from './routes/hospitality-finance';
import migrationRoutes from './routes/migration';
import modulesRoutes from './routes/modules';
import ordersRoutes from './routes/orders';
import publicRoutes from './routes/public';
import restaurantRoutes from './routes/restaurant';
import batchesRoutes from './routes/batches';
import validitiesRoutes from './routes/validities';
import hospitalityChannelsRoutes from './routes/hospitality-channels';
import commercialRoutes from './routes/commercial';

import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimiters } from './middleware/rateLimit';
import path from 'path';

import { auditMiddleware } from './middleware/audit';

export const app = express();

// Security Middleware
app.use(helmet());
app.use(cookieParser());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || true,
    credentials: true
}));
app.use(express.json({ limit: '50kb' })); // Protection against large payloads
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// Serve uploaded files (prescription images, etc.)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Apply rate limiting to all requests
app.use('/api', rateLimiters.api);

// Audit mutations (POST, PUT, DELETE, PATCH)
app.use(auditMiddleware as any);

// Main API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/hospitality', hospitalityRoutes);
app.use('/api/hospitality/channels', hospitalityChannelsRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/bottle-store', bottleStoreRoutes);
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
app.use('/api/hospitality-dashboard', hospitalityDashboardRoutes);
app.use('/api/hospitality-finance', hospitalityFinanceRoutes);
app.use('/api/migration', migrationRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/batches', batchesRoutes);
app.use('/api/commercial', commercialRoutes);
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

const PORT = process.env.PORT || 3001;
const start = async () => {
    try {
        await prisma.$connect();
        
        // Start background tasks
        startCronJobs();

        app.listen(PORT, () => console.log(`🚀 MultiCore ERP running on port ${PORT}`));
    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
};

if (process.env.NODE_ENV !== 'test') {
    start();
}
