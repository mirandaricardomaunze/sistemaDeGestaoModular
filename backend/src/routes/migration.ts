import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

/**
 * ENDPOINT TEMPORÁRIO DE MIGRAÇÃO
 * Este endpoint atualiza todos os usuários sem empresa para a empresa padrão
 */
router.post('/migrate-users-to-default-company', async (req, res) => {
    try {
        // Buscar a primeira empresa ativa
        const defaultCompany = await prisma.company.findFirst({
            where: { status: 'active' }
        });

        if (!defaultCompany) {
            return res.status(404).json({
                error: 'Nenhuma empresa ativa encontrada. Execute o script init-multi-tenant.ts primeiro.'
            });
        }

        // Atualizar todos os usuários sem companyId
        const result = await prisma.user.updateMany({
            where: { companyId: null },
            data: { companyId: defaultCompany.id }
        });

        res.json({
            message: `✅ Migração concluída com sucesso!`,
            defaultCompany: {
                id: defaultCompany.id,
                name: defaultCompany.name
            },
            usersUpdated: result.count
        });
    } catch (error) {
        console.error('Erro na migração de usuários:', error);
        res.status(500).json({ error: 'Erro ao migrar usuários para empresa padrão' });
    }
});

export default router;
