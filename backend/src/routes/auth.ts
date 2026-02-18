import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
        throw ApiError.unauthorized('Credenciais inválidas');
    }

    const token = jwt.sign({ userId: user.id, role: user.role, companyId: user.companyId }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.json({ user, token });
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { company: true } });
    if (!user) throw ApiError.notFound('Utilizador não encontrado');
    res.json(user);
});

export default router;
