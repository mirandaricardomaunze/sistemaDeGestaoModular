import 'dotenv/config';
import express from 'express';
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

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Main API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/hospitality', hospitalityRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/bottle-store', bottleStoreRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gdrive', gdriveRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
const start = async () => {
    try {
        await prisma.$connect();
        app.listen(PORT, () => console.log(`🚀 MultiCore ERP running on port ${PORT}`));
    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
};

start();
