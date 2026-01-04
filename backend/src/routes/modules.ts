import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

/**
 * @swagger
 * /api/modules:
 *   get:
 *     summary: List all available business modules
 *     tags: [Modules]
 *     responses:
 *       200:
 *         description: List of available modules
 */
router.get('/', async (_req, res) => {
    try {
        const modules = await prisma.module.findMany({
            where: { isActive: true },
            select: {
                id: true,
                code: true,
                name: true,
                description: true
            },
            orderBy: { name: 'asc' }
        });

        console.log(`[Modules] Found ${modules.length} active modules`);
        res.json(modules);
    } catch (error) {
        console.error('List modules error:', error);
        res.status(500).json({ error: 'Erro ao listar módulos' });
    }
});

export default router;
