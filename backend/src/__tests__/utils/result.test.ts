import { ResultHandler, Result } from '../../utils/result';

describe('ResultHandler', () => {
    describe('success()', () => {
        it('returns success: true with data', () => {
            const result = ResultHandler.success({ id: 1, name: 'test' });
            expect(result.success).toBe(true);
            expect(result.data).toEqual({ id: 1, name: 'test' });
            expect(result.error).toBeUndefined();
        });

        it('includes optional message', () => {
            const result = ResultHandler.success(42, 'Done');
            expect(result.message).toBe('Done');
        });

        it('includes ISO timestamp', () => {
            const before = new Date();
            const result = ResultHandler.success(null);
            const after = new Date();
            const ts = new Date(result.timestamp);
            expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        it('handles null data', () => {
            const result = ResultHandler.success(null);
            expect(result.success).toBe(true);
            expect(result.data).toBeNull();
        });

        it('handles array data', () => {
            const result = ResultHandler.success([1, 2, 3]);
            expect(Array.isArray(result.data)).toBe(true);
            expect((result.data as number[]).length).toBe(3);
        });
    });

    describe('failure()', () => {
        it('returns success: false with error', () => {
            const result = ResultHandler.failure('Something went wrong');
            expect(result.success).toBe(false);
            expect(result.data).toBeNull();
            expect(result.error).toBe('Something went wrong');
        });

        it('includes optional message', () => {
            const result = ResultHandler.failure('ERR_CODE', 'User-friendly message');
            expect(result.error).toBe('ERR_CODE');
            expect(result.message).toBe('User-friendly message');
        });

        it('includes ISO timestamp', () => {
            const before = new Date();
            const result = ResultHandler.failure('err');
            const after = new Date();
            const ts = new Date(result.timestamp);
            expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(ts.getTime()).toBeLessThanOrEqual(after.getTime());
        });
    });

    describe('Result type shape', () => {
        it('success result conforms to Result<T> interface', () => {
            const result: Result<string> = ResultHandler.success('hello');
            expect(typeof result.success).toBe('boolean');
            expect(typeof result.timestamp).toBe('string');
        });

        it('failure result conforms to Result<null> interface', () => {
            const result: Result<null> = ResultHandler.failure('error');
            expect(result.data).toBeNull();
        });
    });
});
