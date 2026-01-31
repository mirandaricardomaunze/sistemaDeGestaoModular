import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export const errorHandler = (err: Error & { status?: number; code?: string; meta?: Record<string, unknown> }, req: Request, res: Response, _next: NextFunction) => {
    console.error(' [Error Log] ', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method
    });

    // Prisma Specific Errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            return res.status(409).json({
                error: 'Conflito de dados',
                message: 'Já existe um registo com estes dados (únicos).',
                field: (err.meta?.target as string[])?.join(', ')
            });
        }
        if (err.code === 'P2025') {
            return res.status(404).json({
                error: 'Não encontrado',
                message: 'O registo solicitado não existe ou você não tem permissão.'
            });
        }
    }

    // Default Error
    const statusCode = err.status || 500;
    return res.status(statusCode).json({
        error: statusCode === 500 ? 'Erro Interno do Servidor' : 'Erro de Requisição',
        message: err.message || 'Ocorreu um erro inesperado.'
    });
};
