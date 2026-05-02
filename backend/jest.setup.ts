process.env.NODE_ENV = 'test';

jest.mock('./src/middleware/module', () => ({
    requireModule: () => (_req: any, _res: any, next: any) => next(),
    clearModuleCache: jest.fn(),
}));

jest.mock('./src/lib/socket', () => ({
    initSocket: jest.fn().mockReturnValue({ on: jest.fn() }),
    getIO: jest.fn(),
    emitToCompany: jest.fn(),
    emitToModule: jest.fn(),
    emitToUser: jest.fn(),
}));
