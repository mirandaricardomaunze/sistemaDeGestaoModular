import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { documentService } from '../services/documentService';
import { ApiError } from '../middleware/error.middleware';

const router = Router();
router.use(authenticate);

router.post('/', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const { type, title, subtitle, columns, data, filename } = req.body;
    const finalFilename = filename || `Export_${new Date().getTime()}`;

    const options = { title, subtitle, columns, data, companyId: req.companyId };

    if (type === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${finalFilename}.pdf`);
        await documentService.generatePDF(res, options);
    } else if (type === 'excel') {
        await documentService.generateExcel(res, options, finalFilename);
    } else {
        throw ApiError.badRequest('Tipo de exportação inválido');
    }
});

export default router;
