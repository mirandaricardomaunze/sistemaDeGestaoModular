import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { pharmacyService } from '../services/pharmacy.service';
import {
    createMedicationSchema,
    updateMedicationSchema,
    createBatchSchema,
    createPharmacySaleSchema,
    createPrescriptionSchema,
    createPartnerSchema,
    updatePartnerSchema
} from '../validation';
import { ApiError } from '../middleware/error.middleware';

const router = Router();
router.use(authenticate);

router.get('/medications', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await pharmacyService.getMedications(req.companyId, req.query));
});

router.post('/medications', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = createMedicationSchema.parse(req.body);
    res.status(201).json(await pharmacyService.createMedication(req.companyId, validatedData));
});

router.get('/batches', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await pharmacyService.getBatches(req.companyId, req.query));
});

router.post('/batches', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    const validatedData = createBatchSchema.parse(req.body);
    res.status(201).json(await pharmacyService.createBatch(req.companyId, validatedData, req.userName || 'Sistema'));
});

router.get('/partners', async (req: AuthRequest, res) => {
    if (!req.companyId) throw ApiError.badRequest('Company context required');
    res.json(await pharmacyService.getPartners(req.companyId, req.query));
});

export default router;
