process.env.NODE_ENV = 'test';

// Reduzir limite de conexões no banco durante testes para evitar estourar o limite de conexões do Supabase pooler (15)
if (process.env.DATABASE_URL) {
    let urlStr = process.env.DATABASE_URL;
    if (urlStr.includes('connection_limit=')) {
        urlStr = urlStr.replace(/connection_limit=\d+/, 'connection_limit=3');
    } else {
        urlStr += (urlStr.includes('?') ? '&' : '?') + 'connection_limit=3';
    }
    process.env.DATABASE_URL = urlStr;
}
if (process.env.DIRECT_URL) {
    let urlStr = process.env.DIRECT_URL;
    if (urlStr.includes('connection_limit=')) {
        urlStr = urlStr.replace(/connection_limit=\d+/, 'connection_limit=3');
    } else {
        urlStr += (urlStr.includes('?') ? '&' : '?') + 'connection_limit=3';
    }
    process.env.DIRECT_URL = urlStr;
}

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
