import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { PharmacyService } from '../services/pharmacy.service';

const router = Router();
router.use(authenticate);

// MEDICATIONS
router.get('/medications', async (req: Request, res: Response) => {
    try {
        const medications = await PharmacyService.getMedications((req as AuthRequest).companyId!, req.query);
        res.json(medications);
    } catch (error: any) {
        console.error('Error fetching medications:', error);
        res.status(500).json({ message: error.message || 'Erro ao buscar medicamentos' });
    }
});

router.post('/medications', async (req: Request, res: Response) => {
    try {
        const medication = await PharmacyService.createMedication((req as AuthRequest).companyId!, req.body);
        res.status(201).json(medication);
    } catch (error: any) {
        console.error('Error creating medication:', error);
        res.status(400).json({ message: error.message || 'Erro ao criar medicamento' });
    }
});

router.put('/medications/:id', async (req: Request, res: Response) => {
    try {
        const medication = await PharmacyService.updateMedication(req.params.id, req.body);
        res.json(medication);
    } catch (error: any) {
        console.error('Error updating medication:', error);
        res.status(500).json({ message: 'Erro ao atualizar medicamento' });
    }
});

router.delete('/medications/:id', async (req: Request, res: Response) => {
    try {
        await PharmacyService.deleteMedication(req.params.id);
        res.json({ message: 'Medicamento eliminado com sucesso' });
    } catch (error: any) {
        console.error('Error deleting medication:', error);
        res.status(400).json({ message: error.message || 'Erro ao eliminar medicamento' });
    }
});

// BATCHES
router.get('/batches', async (req: Request, res: Response) => {
    try {
        const batches = await PharmacyService.getBatches((req as AuthRequest).companyId!, req.query);
        res.json(batches);
    } catch (error: any) {
        console.error('Error fetching batches:', error);
        res.status(500).json({ message: 'Erro ao buscar lotes' });
    }
});

router.post('/batches', async (req: Request, res: Response) => {
    try {
        const batch = await PharmacyService.createBatch(
            (req as AuthRequest).companyId!,
            req.body,
            (req as any).user?.name || 'Sistema'
        );
        res.status(201).json(batch);
    } catch (error: any) {
        console.error('Error creating batch:', error);
        res.status(500).json({ message: error.message || 'Erro ao criar lote' });
    }
});

// SALES
router.get('/sales', async (req: Request, res: Response) => {
    try {
        const sales = await PharmacyService.getSales((req as AuthRequest).companyId!, req.query);
        res.json(sales);
    } catch (error: any) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ message: 'Erro ao buscar vendas' });
    }
});

router.post('/sales', async (req: Request, res: Response) => {
    try {
        const sale = await PharmacyService.createSale(
            (req as AuthRequest).companyId!,
            req.body,
            (req as any).user?.name || 'Sistema'
        );
        res.status(201).json(sale);
    } catch (error: any) {
        console.error('Error creating sale:', error);
        res.status(500).json({ message: error.message || 'Erro ao criar venda' });
    }
});

export default router;
