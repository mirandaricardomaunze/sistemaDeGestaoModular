import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';

export class ApiError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public errors: any[] = []
    ) {
        super(message);
        this.name = 'ApiError';
        Object.setPrototypeOf(this, ApiError.prototype);
    }

    static badRequest(msg: string, errors: any[] = []) {
        return new ApiError(400, msg, errors);
    }

    static unauthorized(msg: string = 'Não autorizado') {
        return new ApiError(401, msg);
    }

    static forbidden(msg: string = 'Acesso negado') {
        return new ApiError(403, msg);
    }

    static notFound(msg: string = 'Recurso não encontrado') {
        return new ApiError(404, msg);
    }

    static internal(msg: string = 'Erro interno do servidor') {
        return new ApiError(500, msg);
    }
}

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            message: err.message,
            errors: err.errors
        });
    }

    if (err instanceof z.ZodError) {
        logger.warn('Validation Error', { issues: err.issues });
        return res.status(400).json({
            message: 'Erro de validação',
            errors: err.issues.map(issue => ({
                path: issue.path.join('.'),
                message: issue.message
            }))
        });
    }

    // Default to 500 server error
    logger.error('Unhandled Error:', err);
    return res.status(500).json({
        message: 'Erro interno do servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
