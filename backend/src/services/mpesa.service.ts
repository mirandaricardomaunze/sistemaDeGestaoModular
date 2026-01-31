/**
 * M-Pesa Payment Service
 * Centralized service for M-Pesa integration (Mozambique)
 * 
 * API Documentation: https://developer.mpesa.vm.co.mz/
 */

import crypto from 'crypto';
import { prisma } from '../lib/prisma';

// M-Pesa Configuration
const MPESA_CONFIG = {
    apiKey: process.env.MPESA_API_KEY || '',
    publicKey: process.env.MPESA_PUBLIC_KEY || '',
    serviceProviderCode: process.env.MPESA_SERVICE_PROVIDER_CODE || '',
    apiHost: process.env.MPESA_API_HOST || 'api.sandbox.vm.co.mz',
    origin: process.env.MPESA_ORIGIN || 'developer.mpesa.vm.co.mz',
};

// Transaction status
export type MpesaStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// Module types that can use M-Pesa
export type PaymentModule = 'pos' | 'invoice' | 'hospitality' | 'pharmacy';

interface InitiatePaymentParams {
    phone: string;
    amount: number;
    reference: string;
    module: PaymentModule;
    moduleReferenceId?: string;
    companyId?: string;
}

interface MpesaResponse {
    output_ResponseCode: string;
    output_ResponseDesc: string;
    output_TransactionID?: string;
    output_ConversationID?: string;
    output_ThirdPartyConversationID?: string;
}

class MpesaService {
    private isConfigured: boolean;

    constructor() {
        // TEMPORARY: Force simulation mode until valid M-Pesa API credentials are obtained
        // Set to true once you have valid credentials from the M-Pesa Developer Portal
        const FORCE_SIMULATION = true;

        this.isConfigured = !FORCE_SIMULATION && !!(
            MPESA_CONFIG.apiKey &&
            MPESA_CONFIG.publicKey &&
            MPESA_CONFIG.serviceProviderCode
        );

        if (!this.isConfigured) {
            console.warn('âš ï¸ M-Pesa: Modo SIMULAÇÃO activo (pagamentos serão simulados)');
        } else {
            console.log('✅ M-Pesa: Serviço configurado para API real');
        }
    }

    /**
     * Check if M-Pesa is properly configured
     */
    isAvailable(): boolean {
        return this.isConfigured;
    }

    /**
     * Generate Bearer Token for M-Pesa API
     */
    private generateBearerToken(): string {
        const publicKey = MPESA_CONFIG.publicKey;
        const apiKey = MPESA_CONFIG.apiKey;

        // Encrypt API Key with RSA public key
        const buffer = Buffer.from(apiKey, 'utf8');
        const encrypted = crypto.publicEncrypt(
            {
                key: `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`,
                padding: crypto.constants.RSA_PKCS1_PADDING,
            },
            buffer
        );

        return encrypted.toString('base64');
    }

    /**
     * Format phone number for M-Pesa (258XXXXXXXXX)
     */
    private formatPhone(phone: string): string {
        let cleaned = phone.replace(/\D/g, '');

        // Remove leading 0 if present
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }

        // Add country code if not present
        if (!cleaned.startsWith('258')) {
            cleaned = '258' + cleaned;
        }

        return cleaned;
    }

    /**
     * Generate unique transaction reference
     */
    private generateReference(): string {
        return `TXN${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    /**
     * Initiate C2B (Customer to Business) Payment
     */
    async initiatePayment(params: InitiatePaymentParams): Promise<{
        success: boolean;
        transactionId?: string;
        mpesaTransactionId?: string;
        conversationId?: string;
        message: string;
        simulated?: boolean;
    }> {
        const { phone, amount, reference, module, moduleReferenceId, companyId } = params;
        const formattedPhone = this.formatPhone(phone);
        const thirdPartyRef = this.generateReference();

        // Create pending transaction in database
        console.log('Creating M-Pesa transaction in database...');
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
        console.log('Transaction created:', transaction.id);

        // If not configured, simulate success
        if (!this.isConfigured) {
            // Simulate processing delay
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Simulate successful transaction
            const simulatedTxnId = `SIM${Date.now()}`;
            await prisma.mpesaTransaction.update({
                where: { id: transaction.id },
                data: {
                    status: 'completed',
                    transactionId: simulatedTxnId,
                    conversationId: `CONV${Date.now()}`,
                    completedAt: new Date(),
                    responsePayload: { simulated: true },
                },
            });

            return {
                success: true,
                transactionId: transaction.id,
                mpesaTransactionId: simulatedTxnId,
                message: 'Pagamento simulado com sucesso (modo sandbox)',
                simulated: true,
            };
        }

        // Real M-Pesa API call
        try {
            const bearerToken = this.generateBearerToken();
            const requestBody = {
                input_TransactionReference: thirdPartyRef,
                input_CustomerMSISDN: formattedPhone,
                input_Amount: amount.toFixed(2),
                input_ThirdPartyReference: reference,
                input_ServiceProviderCode: MPESA_CONFIG.serviceProviderCode,
            };

            // Update with request payload
            await prisma.mpesaTransaction.update({
                where: { id: transaction.id },
                data: {
                    status: 'processing',
                    requestPayload: requestBody,
                },
            });

            console.log('Calling M-Pesa API:', `https://${MPESA_CONFIG.apiHost}:18352/ipg/v1x/c2bPayment/singleStage/`);
            console.log('Request body:', JSON.stringify(requestBody, null, 2));

            const response = await fetch(
                `https://${MPESA_CONFIG.apiHost}:18352/ipg/v1x/c2bPayment/singleStage/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${bearerToken}`,
                        Origin: MPESA_CONFIG.origin,
                    },
                    body: JSON.stringify(requestBody),
                }
            );

            console.log('M-Pesa API response status:', response.status);
            const data = (await response.json()) as MpesaResponse;
            console.log('M-Pesa API response data:', JSON.stringify(data, null, 2));

            // Update transaction with response
            await prisma.mpesaTransaction.update({
                where: { id: transaction.id },
                data: {
                    responsePayload: data as any,
                    transactionId: data.output_TransactionID,
                    conversationId: data.output_ConversationID,
                },
            });

            // Check response code
            if (data.output_ResponseCode === 'INS-0') {
                // Success
                await prisma.mpesaTransaction.update({
                    where: { id: transaction.id },
                    data: {
                        status: 'completed',
                        completedAt: new Date(),
                    },
                });

                return {
                    success: true,
                    transactionId: transaction.id,
                    mpesaTransactionId: data.output_TransactionID,
                    conversationId: data.output_ConversationID,
                    message: 'Pagamento M-Pesa realizado com sucesso',
                };
            } else {
                // Failed
                await prisma.mpesaTransaction.update({
                    where: { id: transaction.id },
                    data: {
                        status: 'failed',
                        errorCode: data.output_ResponseCode,
                        errorMessage: data.output_ResponseDesc,
                    },
                });

                return {
                    success: false,
                    transactionId: transaction.id,
                    message: data.output_ResponseDesc || 'Erro no pagamento M-Pesa',
                };
            }
        } catch (error: unknown) {
            // Update transaction with error
            await prisma.mpesaTransaction.update({
                where: { id: transaction.id },
                data: {
                    status: 'failed',
                    errorMessage: error.message,
                },
            });

            console.error('M-Pesa API Error:', error);

            return {
                success: false,
                transactionId: transaction.id,
                message: 'Erro de comunicação com M-Pesa. Tente novamente.',
            };
        }
    }

    /**
     * Query transaction status
     */
    async getTransactionStatus(transactionId: string, companyId?: string): Promise<{
        status: MpesaStatus;
        transaction: any;
    } | null> {
        const where: any = { id: transactionId };
        if (companyId) where.companyId = companyId;

        const transaction = await prisma.mpesaTransaction.findUnique({
            where,
        });

        if (!transaction) {
            return null;
        }

        return {
            status: transaction.status as MpesaStatus,
            transaction,
        };
    }

    /**
     * Get transactions by module reference
     */
    async getTransactionsByReference(
        module: PaymentModule,
        moduleReferenceId: string,
        companyId?: string
    ): Promise<any[]> {
        return prisma.mpesaTransaction.findMany({
            where: {
                module,
                moduleReferenceId,
                ...(companyId && { companyId })
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Process webhook callback from M-Pesa
     */
    async processCallback(data: any): Promise<boolean> {
        try {
            const conversationId = data.output_ConversationID;
            const transactionId = data.output_TransactionID;
            const responseCode = data.output_ResponseCode;

            // Find transaction by conversation ID
            const transaction = await prisma.mpesaTransaction.findFirst({
                where: {
                    OR: [
                        { conversationId },
                        { transactionId },
                    ],
                },
            });

            if (!transaction) {
                console.error('M-Pesa Callback: Transaction not found', conversationId);
                return false;
            }

            // Update transaction status
            const status: MpesaStatus = responseCode === 'INS-0' ? 'completed' : 'failed';

            await prisma.mpesaTransaction.update({
                where: { id: transaction.id },
                data: {
                    status,
                    transactionId,
                    responsePayload: data as any,
                    completedAt: status === 'completed' ? new Date() : null,
                    errorCode: status === 'failed' ? responseCode : null,
                    errorMessage: status === 'failed' ? data.output_ResponseDesc : null,
                },
            });

            // If payment completed, trigger module-specific actions
            if (status === 'completed') {
                await this.handlePaymentCompleted(transaction);
            }

            return true;
        } catch (error) {
            console.error('M-Pesa Callback Error:', error);
            return false;
        }
    }

    /**
     * Handle completed payment - update related module
     */
    private async handlePaymentCompleted(transaction: any): Promise<void> {
        const { module, moduleReferenceId, amount } = transaction;

        if (!moduleReferenceId) return;

        try {
            switch (module) {
                case 'invoice':
                    // Add payment to invoice
                    const invoice = await prisma.invoice.findUnique({
                        where: { id: moduleReferenceId },
                    });

                    if (invoice) {
                        // Create InvoicePayment record
                        await prisma.invoicePayment.create({
                            data: {
                                invoiceId: moduleReferenceId,
                                amount: Number(amount),
                                method: 'mpesa',
                                reference: transaction.transactionId,
                                notes: `Pagamento M-Pesa - ${transaction.phone}`,
                            },
                        });

                        // Update invoice amounts
                        const newAmountPaid = Number(invoice.amountPaid) + Number(amount);
                        const newAmountDue = Number(invoice.total) - newAmountPaid;

                        await prisma.invoice.update({
                            where: { id: moduleReferenceId },
                            data: {
                                amountPaid: newAmountPaid,
                                amountDue: Math.max(0, newAmountDue),
                                status: newAmountDue <= 0 ? 'paid' : 'partial',
                                paidDate: newAmountDue <= 0 ? new Date() : null,
                            },
                        });
                    }
                    break;

                case 'hospitality':
                    // Create transaction for booking
                    if (moduleReferenceId) {
                        await prisma.transaction.create({
                            data: {
                                bookingId: moduleReferenceId,
                                type: 'income',
                                category: 'hospedagem',
                                description: `Pagamento M-Pesa - ${transaction.phone}`,
                                amount: Number(amount),
                                status: 'completed',
                                paymentMethod: 'mpesa',
                                reference: transaction.transactionId,
                                module: 'hospitality',
                                companyId: transaction.companyId,
                            },
                        });
                    }
                    break;

                // POS sales are already completed at point of sale
                // Pharmacy similar to POS
                default:
                    console.log(`M-Pesa payment completed for ${module}:${moduleReferenceId}`);
            }
        } catch (error) {
            console.error(`Error handling payment completion for ${module}:`, error);
        }
    }

    /**
     * Cancel a pending transaction
     */
    async cancelTransaction(transactionId: string, companyId?: string): Promise<boolean> {
        const where: any = { id: transactionId };
        if (companyId) where.companyId = companyId;

        const transaction = await prisma.mpesaTransaction.findUnique({
            where,
        });

        if (!transaction || transaction.status !== 'pending') {
            return false;
        }

        await prisma.mpesaTransaction.update({
            where: { id: transactionId },
            data: { status: 'cancelled' },
        });

        return true;
    }
}

// Export singleton instance
export const mpesaService = new MpesaService();
