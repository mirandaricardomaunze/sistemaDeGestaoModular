import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
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
        const fieldLabels: Record<string, string> = {
            name: 'Nome',
            email: 'E-mail',
            phone: 'Telefone',
            password: 'Senha',
            code: 'Código',
            price: 'Preço',
            quantity: 'Quantidade',
            unitPrice: 'Preço unitário',
            total: 'Total',
            subtotal: 'Subtotal',
            discount: 'Desconto',
            tax: 'Imposto',
            amountPaid: 'Valor pago',
            change: 'Troco',
            paymentMethod: 'Método de pagamento',
            productId: 'Produto',
            customerId: 'Cliente',
            items: 'Itens',
            date: 'Data',
            checkIn: 'Entrada',
            checkOut: 'Saída',
            employeeId: 'Funcionário',
            roomId: 'Quarto',
            tableId: 'Mesa',
            warehouseId: 'Armazém',
            sessionId: 'Sessão',
            customerName: 'Nome do hóspede',
        };
        const errors = err.issues.map(issue => {
            const rawPath = issue.path.join('.');
            const firstKey = String(issue.path[0] ?? '');
            const label = fieldLabels[firstKey] ?? rawPath;
            return { field: rawPath, message: issue.message, label };
        });
        const firstError = errors[0];
        const summary = firstError
            ? `${firstError.label}: ${firstError.message}`
            : 'Dados inválidos. Verifique os campos e tente novamente.';
        return res.status(400).json({ message: summary, errors });
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error('Prisma Error:', { code: err.code, meta: err.meta });
        if (err.code === 'P2002') {
            const fields = (err.meta?.target as string[] | undefined) ?? [];
            const fieldLabels: Record<string, string> = {
                email: 'e-mail',
                phone: 'telefone',
                code: 'código',
                name: 'nome',
                nif: 'NIF',
                document: 'documento',
                receiptNumber: 'número de recibo',
                number: 'número',
            };
            const readable = fields.map(f => fieldLabels[f] ?? f).join(', ');
            const detail = readable ? ` (${readable})` : '';
            return res.status(409).json({ message: `Já existe um registo com este valor${detail}. Verifique e tente novamente.` });
        }
        if (err.code === 'P2025') {
            const cause = (err.meta?.cause as string | undefined) ?? '';
            const entityMatch = cause.match(/No '(\w+)' record/i);
            const entityLabels: Record<string, string> = {
                Product: 'Produto',
                Customer: 'Cliente',
                Employee: 'Funcionário',
                Sale: 'Venda',
                User: 'Utilizador',
                Warehouse: 'Armazém',
                Room: 'Quarto',
                Table: 'Mesa',
                PayrollRecord: 'Folha de pagamento',
                CommissionRule: 'Regra de comissão',
                DocumentSeries: 'Série de documento',
            };
            const entity = entityMatch ? (entityLabels[entityMatch[1]] ?? entityMatch[1]) : 'Registo';
            return res.status(404).json({ message: `${entity} não encontrado(a). Verifique se o ID é válido.` });
        }
        if (err.code === 'P2003') {
            const field = (err.meta?.field_name as string | undefined) ?? '';
            return res.status(400).json({ message: `Referência inválida${field ? ` no campo "${field}"` : ''}. O registo relacionado não existe.` });
        }
        if (err.code === 'P2034') {
            return res.status(409).json({ message: 'Operação bloqueada por conflito. Por favor, tente novamente.' });
        }
        return res.status(400).json({ message: 'Erro ao processar operação na base de dados. Por favor, tente novamente.' });
    }

    if (err instanceof Prisma.PrismaClientValidationError) {
        logger.error('Prisma Validation Error', { details: err.message });
        return res.status(400).json({ 
            message: 'Dados enviados são inválidos ou incompletos. Verifique os campos e tente novamente.',
            ...(process.env.NODE_ENV === 'development' && { details: err.message })
        });
    }

    // Default to 500 server error
    logger.error('Unhandled Error:', err);
    return res.status(500).json({
        message: 'Erro interno do servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
