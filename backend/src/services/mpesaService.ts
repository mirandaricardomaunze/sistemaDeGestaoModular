import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { ApiError } from '../middleware/error.middleware';
import { emitToCompany } from '../lib/socket';
import { logger } from '../utils/logger';

const MPESA_CONFIG = {
    apiKey: process.env.MPESA_API_KEY || '',
    publicKey: process.env.MPESA_PUBLIC_KEY || '',
    serviceProviderCode: process.env.MPESA_SERVICE_PROVIDER_CODE || '',
    apiHost: process.env.MPESA_API_HOST || 'api.sandbox.vm.co.mz',
    origin: process.env.MPESA_ORIGIN || 'developer.mpesa.vm.co.mz',
    callbackUrl: process.env.MPESA_CALLBACK_URL || '',
};

export type MpesaStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type PaymentModule = 'pos' | 'invoice' | 'hospitality' | 'pharmacy';

interface InitiatePaymentParams {
    phone: string;
    amount: number;
    reference: string;
    module: PaymentModule;
    moduleReferenceId?: string;
    companyId: string;
}

interface MpesaApiResponse {
    output_ResponseCode: string;
    output_ResponseDesc: string;
    output_TransactionID?: string;
    output_ConversationID?: string;
    output_ThirdPartyReference?: string;
}

export class MpesaService {
    private isConfigured: boolean;

    constructor() {
        const forceSimulation = process.env.MPESA_FORCE_SIMULATION === 'true';

        if (forceSimulation && process.env.NODE_ENV === 'production') {
            console.error('FATAL: MPESA_FORCE_SIMULATION=true is not allowed in production. Aborting.');
            process.exit(1);
        }

        this.isConfigured =
            !forceSimulation &&
            !!(MPESA_CONFIG.apiKey && MPESA_CONFIG.publicKey && MPESA_CONFIG.serviceProviderCode);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private formatPhone(phone: string): string {
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
        if (!cleaned.startsWith('258')) cleaned = '258' + cleaned;
        return cleaned;
    }

    /**
     * Encrypts the API key with the M-Pesa public key (RSA PKCS1 OAEP).
     * M-Pesa requires the bearer token to be generated this way.
     */
    private generateBearerToken(): string {
        const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${MPESA_CONFIG.publicKey}\n-----END PUBLIC KEY-----`;
        const encrypted = crypto.publicEncrypt(
            { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
            Buffer.from(MPESA_CONFIG.apiKey)
        );
        return encrypted.toString('base64');
    }

    private buildHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.generateBearerToken()}`,
            Origin: MPESA_CONFIG.origin,
        };
    }

    private async callMpesaApi(endpoint: string, body: Record<string, string>): Promise<MpesaApiResponse> {
        const url = `https://${MPESA_CONFIG.apiHost}/ipg/v1x/${endpoint}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: this.buildHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => 'no body');
            logger.error('M-Pesa API error', { status: response.status, body: text, endpoint });
            throw ApiError.internal(`M-Pesa API returned ${response.status}`);
        }

        return response.json() as Promise<MpesaApiResponse>;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    isAvailable(): boolean {
        return this.isConfigured;
    }

    async initiatePayment(params: InitiatePaymentParams) {
        const { phone, amount, reference, module, moduleReferenceId, companyId } = params;
        const formattedPhone = this.formatPhone(phone);

        const transaction = await prisma.mpesaTransaction.create({
            data: {
                phone: formattedPhone,
                amount,
                reference,
                module,
                moduleReferenceId,
                companyId,
                status: 'pending',
            },
        });

        // ── Simulation mode (no credentials) ──────────────────────────────────
        if (!this.isConfigured) {
            await new Promise(r => setTimeout(r, 800));
            const simId = `SIM-${Date.now()}`;
            const updated = await prisma.mpesaTransaction.update({
                where: { id: transaction.id },
                data: {
                    status: 'completed',
                    transactionId: simId,
                    conversationId: `CONV-${Date.now()}`,
                    completedAt: new Date(),
                },
            });

            emitToCompany(companyId, 'payment:success', {
                transactionId: simId,
                amount: updated.amount,
                module: updated.module,
                timestamp: new Date(),
            });

            return updated;
        }

        // ── Real M-Pesa C2B API ───────────────────────────────────────────────
        await prisma.mpesaTransaction.update({ where: { id: transaction.id }, data: { status: 'processing' } });

        try {
            const apiResponse = await this.callMpesaApi('c2bPayment/singleStage/', {
                input_TransactionReference: reference,
                input_CustomerMSISDN: formattedPhone,
                input_Amount: String(Math.round(amount)),
                input_ThirdPartyReference: moduleReferenceId || transaction.id,
                input_ServiceProviderCode: MPESA_CONFIG.serviceProviderCode,
            });

            // M-Pesa returns INS-0 for success
            if (apiResponse.output_ResponseCode === 'INS-0') {
                const updated = await prisma.mpesaTransaction.update({
                    where: { id: transaction.id },
                    data: {
                        status: 'completed',
                        transactionId: apiResponse.output_TransactionID,
                        conversationId: apiResponse.output_ConversationID,
                        completedAt: new Date(),
                        responsePayload: apiResponse as any,
                    },
                });

                emitToCompany(companyId, 'payment:success', {
                    transactionId: apiResponse.output_TransactionID,
                    amount: updated.amount,
                    module: updated.module,
                    timestamp: new Date(),
                });

                return updated;
            }

            // Non-zero response code = failure
            await prisma.mpesaTransaction.update({
                where: { id: transaction.id },
                data: { status: 'failed', responsePayload: apiResponse as any },
            });

            logger.warn('M-Pesa payment failed', { code: apiResponse.output_ResponseCode, desc: apiResponse.output_ResponseDesc });
            throw ApiError.badRequest(`M-Pesa: ${apiResponse.output_ResponseDesc} (${apiResponse.output_ResponseCode})`);
        } catch (err) {
            if (err instanceof ApiError) throw err;
            await prisma.mpesaTransaction.update({
                where: { id: transaction.id },
                data: { status: 'failed' },
            });
            throw ApiError.internal('Erro ao comunicar com M-Pesa');
        }
    }

    async getTransactionStatus(transactionId: string, companyId: string) {
        const tx = await prisma.mpesaTransaction.findFirst({ where: { id: transactionId, companyId } });
        if (!tx) throw ApiError.notFound('Transação não encontrada');
        return tx;
    }

    async processCallback(callbackData: any) {
        const { transactionId, status } = callbackData;

        const transaction = await prisma.mpesaTransaction.findFirst({ where: { transactionId } });
        if (!transaction) throw ApiError.notFound('Transação não encontrada');

        const updated = await prisma.mpesaTransaction.update({
            where: { id: transaction.id },
            data: {
                status: status === 'success' ? 'completed' : 'failed',
                completedAt: status === 'success' ? new Date() : null,
                responsePayload: callbackData,
            },
        });

        if (status === 'success') {
            emitToCompany(transaction.companyId!, 'payment:success', {
                transactionId,
                amount: updated.amount,
                module: updated.module,
                timestamp: new Date(),
            });
        }

        return updated;
    }

    async getTransactionsByReference(reference: string, companyId: string) {
        return prisma.mpesaTransaction.findMany({
            where: { reference, companyId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async cancelTransaction(transactionId: string, companyId: string) {
        const transaction = await prisma.mpesaTransaction.findFirst({
            where: { id: transactionId, companyId },
        });
        if (!transaction) throw ApiError.notFound('Transação não encontrada');
        if (transaction.status !== 'pending') {
            throw ApiError.badRequest('Só transações pendentes podem ser canceladas');
        }

        await prisma.mpesaTransaction.update({
            where: { id: transactionId },
            data: { status: 'cancelled' },
        });

        return true;
    }

    /**
     * Query transaction status directly from M-Pesa API (for reconciliation).
     * Only available when credentials are configured.
     */
    async queryTransactionStatus(conversationId: string): Promise<MpesaApiResponse | null> {
        if (!this.isConfigured) return null;

        return this.callMpesaApi('queryTransactionStatus/', {
            input_QueryReference: conversationId,
            input_ServiceProviderCode: MPESA_CONFIG.serviceProviderCode,
            input_ThirdPartyReference: conversationId,
        });
    }

    /**
     * Reconcile pending/processing transactions older than 10 minutes.
     * Called by a cron job to handle callbacks that were never received.
     */
    async reconcileStalePendingTransactions(): Promise<void> {
        if (!this.isConfigured) return;

        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        const stale = await prisma.mpesaTransaction.findMany({
            where: {
                status: { in: ['pending', 'processing'] },
                createdAt: { lt: tenMinutesAgo },
            },
        });

        for (const tx of stale) {
            if (!tx.conversationId) {
                await prisma.mpesaTransaction.update({ where: { id: tx.id }, data: { status: 'failed' } });
                continue;
            }

            try {
                const result = await this.queryTransactionStatus(tx.conversationId);
                if (result?.output_ResponseCode === 'INS-0') {
                    await prisma.mpesaTransaction.update({
                        where: { id: tx.id },
                        data: { status: 'completed', completedAt: new Date(), responsePayload: result as any },
                    });
                } else {
                    await prisma.mpesaTransaction.update({ where: { id: tx.id }, data: { status: 'failed' } });
                }
            } catch {
                logger.warn('M-Pesa reconciliation failed for transaction', { id: tx.id });
            }
        }
    }
}

export const mpesaService = new MpesaService();
