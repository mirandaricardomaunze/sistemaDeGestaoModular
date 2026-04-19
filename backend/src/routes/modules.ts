import { Router } from 'express';
import { OPTIONAL_MODULES } from '../constants/modules.constants';

const router = Router();

/**
 * @swagger
 * /api/modules:
 *   get:
 *     summary: List all optional business modules available for selection
 *     tags: [Modules]
 *     responses:
 *       200:
 *         description: List of optional modules (core modules are always included)
 */
router.get('/', async (_req, res) => {
    res.json(OPTIONAL_MODULES);
});

export default router;
