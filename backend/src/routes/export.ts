import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { DocumentService, ExportOptions } from '../services/document.service';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticate);

/**
 * Endpoint genérico para exportação de dados
 * POST /api/export
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthRequest;
        const { type, title, subtitle, columns, data, filename } = req.body;

        const options: ExportOptions = {
            title,
            subtitle,
            columns,
            data,
            companyId: authReq.companyId!
        };

        const finalFilename = filename || `Export_${new Date().getTime()}`;

        if (type === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${finalFilename}.pdf`);
            await DocumentService.generatePDF(res, options);
        } else if (type === 'excel') {
            await DocumentService.generateExcel(res, options, finalFilename);
        } else {
            res.status(400).json({ error: 'Tipo de exportação inválido' });
        }
    } catch (error: unknown) {
        logger.error('Export Error:', error);
        res.status(500).json({ error: 'Erro ao gerar documento' });
    }
});

export default router;
