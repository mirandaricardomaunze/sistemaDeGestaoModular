import { ApiError, errorHandler } from '../../middleware/error.middleware';
import { z } from 'zod';

// ── ApiError ─────────────────────────────────────────────────────────────────

describe('ApiError', () => {
    describe('constructors', () => {
        it('badRequest creates 400 error', () => {
            const err = ApiError.badRequest('Invalid input');
            expect(err.statusCode).toBe(400);
            expect(err.message).toBe('Invalid input');
            expect(err instanceof ApiError).toBe(true);
        });

        it('unauthorized creates 401 error', () => {
            const err = ApiError.unauthorized();
            expect(err.statusCode).toBe(401);
            expect(err.message).toBe('Não autorizado');
        });

        it('unauthorized accepts custom message', () => {
            const err = ApiError.unauthorized('Token expirado');
            expect(err.message).toBe('Token expirado');
        });

        it('forbidden creates 403 error', () => {
            const err = ApiError.forbidden();
            expect(err.statusCode).toBe(403);
        });

        it('notFound creates 404 error', () => {
            const err = ApiError.notFound('Item not found');
            expect(err.statusCode).toBe(404);
            expect(err.message).toBe('Item not found');
        });

        it('internal creates 500 error', () => {
            const err = ApiError.internal();
            expect(err.statusCode).toBe(500);
        });

        it('preserves errors array', () => {
            const errors = [{ field: 'email', msg: 'Required' }];
            const err = ApiError.badRequest('Validation failed', errors);
            expect(err.errors).toEqual(errors);
        });

        it('defaults errors to empty array', () => {
            const err = ApiError.badRequest('msg');
            expect(err.errors).toEqual([]);
        });

        it('is instanceof Error', () => {
            expect(ApiError.badRequest('x') instanceof Error).toBe(true);
        });
    });
});

// ── errorHandler middleware ───────────────────────────────────────────────────

function makeResMock() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('errorHandler middleware', () => {
    const req = {} as any;
    const next = jest.fn();

    it('handles ApiError with correct status and body', () => {
        const err = ApiError.notFound('Product not found');
        const res = makeResMock();
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Product not found' }));
    });

    it('handles ApiError with errors array', () => {
        const errors = [{ path: 'name', message: 'Required' }];
        const err = ApiError.badRequest('Validation', errors);
        const res = makeResMock();
        errorHandler(err, req, res, next);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ errors }));
    });

    it('handles ZodError with 400 status', () => {
        const schema = z.object({ name: z.string() });
        let zodErr: z.ZodError;
        try {
            schema.parse({ name: 123 });
        } catch (e) {
            zodErr = e as z.ZodError;
        }
        const res = makeResMock();
        errorHandler(zodErr!, req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        const body = res.json.mock.calls[0][0];
        expect(body.message).toBe('Erro de validação');
        expect(Array.isArray(body.errors)).toBe(true);
    });

    it('handles unknown errors with 500 status', () => {
        const err = new Error('Unexpected crash');
        const res = makeResMock();
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Erro interno do servidor' }));
    });

    it('does not expose stack trace in production', () => {
        const orig = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const err = new Error('crash');
        const res = makeResMock();
        errorHandler(err, req, res, next);
        const body = res.json.mock.calls[0][0];
        expect(body.stack).toBeUndefined();
        process.env.NODE_ENV = orig;
    });
});
