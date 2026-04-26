import { MpesaService } from '../../services/mpesaService';
import { prisma } from '../../lib/prisma';

const COMPANY_ID = 'mpesa-test-co';

jest.mock('../../lib/prisma', () => ({
    prisma: {
        mpesaTransaction: {
            create: jest.fn(),
            update: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
        },
    },
}));

jest.mock('../../lib/socket', () => ({
    emitToCompany: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('MpesaService (simulation mode)', () => {
    let service: MpesaService;

    beforeEach(() => {
        // Force simulation mode: no env credentials
        process.env.MPESA_API_KEY = '';
        process.env.MPESA_PUBLIC_KEY = '';
        process.env.MPESA_SERVICE_PROVIDER_CODE = '';
        service = new MpesaService();
        jest.clearAllMocks();
    });

    it('isAvailable() returns false when credentials are not set', () => {
        expect(service.isAvailable()).toBe(false);
    });

    describe('initiatePayment', () => {
        it('creates transaction and completes in simulation mode', async () => {
            const fakeCreated = { id: 'tx-1', phone: '258841234567', amount: 100, reference: 'REF-001', module: 'pos', moduleReferenceId: null, companyId: COMPANY_ID, status: 'pending' };
            const fakeUpdated = { ...fakeCreated, status: 'completed', transactionId: 'SIM-123', conversationId: 'CONV-123', completedAt: new Date() };

            (mockPrisma.mpesaTransaction.create as jest.Mock).mockResolvedValue(fakeCreated);
            (mockPrisma.mpesaTransaction.update as jest.Mock).mockResolvedValue(fakeUpdated);

            const result = await service.initiatePayment({
                phone: '841234567',
                amount: 100,
                reference: 'REF-001',
                module: 'pos',
                companyId: COMPANY_ID,
            });

            expect(result.status).toBe('completed');
            expect(result.transactionId).toMatch(/^SIM-/);
            expect(mockPrisma.mpesaTransaction.create).toHaveBeenCalledTimes(1);
            expect(mockPrisma.mpesaTransaction.update).toHaveBeenCalledTimes(1);
        });

        it('formats Mozambican phone number correctly', async () => {
            (mockPrisma.mpesaTransaction.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'tx-2' }));
            (mockPrisma.mpesaTransaction.update as jest.Mock).mockResolvedValue({ status: 'completed', transactionId: 'SIM-X' });

            await service.initiatePayment({ phone: '0841234567', amount: 50, reference: 'R', module: 'pos', companyId: COMPANY_ID });

            const createCall = (mockPrisma.mpesaTransaction.create as jest.Mock).mock.calls[0][0];
            expect(createCall.data.phone).toBe('258841234567');
        });

        it('adds 258 prefix if not present', async () => {
            (mockPrisma.mpesaTransaction.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ ...data, id: 'tx-3' }));
            (mockPrisma.mpesaTransaction.update as jest.Mock).mockResolvedValue({ status: 'completed', transactionId: 'SIM-Y' });

            await service.initiatePayment({ phone: '841234567', amount: 50, reference: 'R', module: 'pos', companyId: COMPANY_ID });

            const createCall = (mockPrisma.mpesaTransaction.create as jest.Mock).mock.calls[0][0];
            expect(createCall.data.phone).toBe('258841234567');
        });
    });

    describe('getTransactionStatus', () => {
        it('returns transaction when found', async () => {
            const fakeTx = { id: 'tx-1', companyId: COMPANY_ID, status: 'completed' };
            (mockPrisma.mpesaTransaction.findFirst as jest.Mock).mockResolvedValue(fakeTx);

            const result = await service.getTransactionStatus('tx-1', COMPANY_ID);
            expect(result).toEqual(fakeTx);
        });

        it('throws 404 when not found', async () => {
            (mockPrisma.mpesaTransaction.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(service.getTransactionStatus('missing', COMPANY_ID)).rejects.toThrow('não encontrada');
        });
    });

    describe('cancelTransaction', () => {
        it('cancels a pending transaction', async () => {
            const fakeTx = { id: 'tx-1', companyId: COMPANY_ID, status: 'pending' };
            (mockPrisma.mpesaTransaction.findFirst as jest.Mock).mockResolvedValue(fakeTx);
            (mockPrisma.mpesaTransaction.update as jest.Mock).mockResolvedValue({ ...fakeTx, status: 'cancelled' });

            const result = await service.cancelTransaction('tx-1', COMPANY_ID);
            expect(result).toBe(true);
        });

        it('throws 400 when trying to cancel non-pending transaction', async () => {
            const fakeTx = { id: 'tx-1', companyId: COMPANY_ID, status: 'completed' };
            (mockPrisma.mpesaTransaction.findFirst as jest.Mock).mockResolvedValue(fakeTx);

            await expect(service.cancelTransaction('tx-1', COMPANY_ID)).rejects.toThrow('não pode ser cancelada');
        });

        it('throws 404 when transaction not found', async () => {
            (mockPrisma.mpesaTransaction.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(service.cancelTransaction('missing', COMPANY_ID)).rejects.toThrow('não encontrada');
        });
    });

    describe('processCallback', () => {
        it('marks transaction as completed on success callback', async () => {
            const fakeTx = { id: 'tx-1', companyId: COMPANY_ID, status: 'processing', transactionId: 'MPESA-001' };
            const fakeUpdated = { ...fakeTx, status: 'completed', completedAt: new Date() };

            (mockPrisma.mpesaTransaction.findFirst as jest.Mock).mockResolvedValue(fakeTx);
            (mockPrisma.mpesaTransaction.update as jest.Mock).mockResolvedValue(fakeUpdated);

            const result = await service.processCallback({ transactionId: 'MPESA-001', status: 'success', amount: 100 });
            expect(result.status).toBe('completed');
        });

        it('marks transaction as failed on failed callback', async () => {
            const fakeTx = { id: 'tx-1', companyId: COMPANY_ID, status: 'processing', transactionId: 'MPESA-002' };
            const fakeUpdated = { ...fakeTx, status: 'failed' };

            (mockPrisma.mpesaTransaction.findFirst as jest.Mock).mockResolvedValue(fakeTx);
            (mockPrisma.mpesaTransaction.update as jest.Mock).mockResolvedValue(fakeUpdated);

            const result = await service.processCallback({ transactionId: 'MPESA-002', status: 'failed' });
            expect(result.status).toBe('failed');
        });

        it('throws 404 when callback references unknown transaction', async () => {
            (mockPrisma.mpesaTransaction.findFirst as jest.Mock).mockResolvedValue(null);
            await expect(service.processCallback({ transactionId: 'GHOST', status: 'success' })).rejects.toThrow('não encontrada');
        });
    });

    describe('getTransactionsByReference', () => {
        it('returns list of transactions for reference', async () => {
            const fakeTxs = [{ id: 'tx-1' }, { id: 'tx-2' }];
            (mockPrisma.mpesaTransaction.findMany as jest.Mock).mockResolvedValue(fakeTxs);

            const result = await service.getTransactionsByReference('REF-001', COMPANY_ID);
            expect(result).toHaveLength(2);
            expect(mockPrisma.mpesaTransaction.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { reference: 'REF-001', companyId: COMPANY_ID } })
            );
        });
    });
});
