import { prisma } from '../lib/prisma';
import { aiService } from './aiService';
import { pdfService } from './pdfService';
import { ApiError } from '../middleware/error.middleware';

export class ChatService {
    async processMessage(message: string, userId: string, companyId: string, module?: string) {
        const intent = await this.detectIntent(message);
        const [data, company] = await Promise.all([
            this.fetchRelevantData(intent, companyId, module),
            prisma.company.findUnique({ where: { id: companyId }, select: { name: true, businessType: true, address: true, nuit: true, phone: true, email: true } })
        ]);

        const result = await aiService.generateResponse(message, companyId, { ...data, companyInfo: company }, module);
        
        let pdfUrl = null;
        if (result.toolCall && result.toolCall.name === 'generate_pdf_report') {
            const reportType = result.toolCall.args.reportType;
            const reportData = this.prepareReportData(reportType, data);
            pdfUrl = await pdfService.generateReport(reportData, reportType, company);
        }

        return { 
            message: result.message, 
            data, 
            pdfUrl 
        };
    }

    async getSuggestions(module?: string) {
        let questions = [
            'Como estão as vendas hoje?',
            'Quais produtos estão com stock baixo?',
            'Análise de margem dos produtos Classe A',
            'Lista de clientes em risco de inactividade'
        ];

        if (module === 'pharmacy') {
            questions = [
                'Resumo de medicamentos próximos da validade',
                'Quais medicamentos controlados foram vendidos hoje?',
                'Alertas de stock crítico na farmácia',
                'Análise de vendas por farmacêutico'
            ];
        } else if (module === 'hospitality' || module === 'hotel') {
            questions = [
                'Qual a taxa de ocupação para hoje?',
                'Quais quartos precisam de limpeza (housekeeping)?',
                'Lista de check-ins pendentes',
                'Resumo financeiro de reservas do mês'
            ];
        } else if (module === 'restaurant') {
            questions = [
                'Quais pratos foram mais vendidos hoje?',
                'Resumo de pedidos em aberto na cozinha',
                'Status de ocupação das mesas',
                'Vendas totais do restaurante'
            ];
        } else if (module === 'logistics') {
            questions = [
                'Status das rotas de entrega hoje',
                'Quais veículos estão em manutenção?',
                'Resumo de combustível e despesas',
                'Entregas pendentes por motorista'
            ];
        }

        return {
            suggestions: [
                {
                    category: module ? `Assistente ${module.charAt(0).toUpperCase() + module.slice(1)}` : 'Geral',
                    questions
                }
            ]
        };
    }

    async checkHealth() {
        return {
            status: process.env.GEMINI_API_KEY ? 'online' : 'offline',
            capabilities: ['analytics', 'nlp', 'predictions'],
            provider: 'Google Gemini'
        };
    }

    private async detectIntent(message: string) {
        const lower = message.toLowerCase();
        
        if (lower.includes('venda') || lower === '1' || lower.includes('opção 1')) return { type: 'sales' };
        if (lower.includes('stock') || lower.includes('estoque') || lower.includes('inventrio') || lower.includes('produto') || lower.includes('lista') || lower === '2' || lower.includes('opção 2')) return { type: 'inventory' };
        if (lower.includes('cliente') || lower === '3' || lower.includes('opção 3')) return { type: 'customers' };
        if (lower.includes('rh') || lower.includes('recursos humanos') || lower.includes('funcionário') || lower.includes('colaborador') || lower.includes('folha') || lower.includes('salário')) return { type: 'hr' };
        if (lower.includes('relatório') || lower.includes('resumo') || lower.includes('analise')) return { type: 'report' };
        
        return { type: 'general' };
    }

    private async fetchRelevantData(intent: any, companyId: string, _module?: string) {
        try {
            const now = new Date();
            const todayStart = new Date(now.setHours(0, 0, 0, 0));
            const yesterdayStart = new Date(new Date(todayStart).setDate(todayStart.getDate() - 1));

            const responseData: any = { status: 'success' };

            // 1. Sales & Performance (Always requested)
            const [todaySales, yesterdaySales, topProducts] = await Promise.all([
                prisma.sale.aggregate({ where: { companyId, createdAt: { gte: todayStart } }, _sum: { total: true }, _count: true }),
                prisma.sale.aggregate({ where: { companyId, createdAt: { gte: yesterdayStart, lt: todayStart } }, _sum: { total: true } }),
                prisma.saleItem.groupBy({
                    by: ['productName'],
                    where: { sale: { companyId, createdAt: { gte: todayStart } } },
                    _sum: { quantity: true, total: true },
                    orderBy: { _sum: { quantity: 'desc' } },
                    take: 10 // Increased for better analysis but still safe
                })
            ]);
            responseData.today = { total: todaySales._sum.total || 0, count: todaySales._count };
            responseData.yesterday = { total: yesterdaySales._sum.total || 0 };
            responseData.top_products = topProducts.map(p => ({ name: p.productName, qty: p._sum.quantity, total: p._sum.total }));

            // 2. Inventory & Warehouses (Deep Context)
            const totalProducts = await prisma.product.count({ where: { companyId } });
            
            if (totalProducts > 0) {
                const [stockValue, lowStockRecords, warehouses] = await Promise.all([
                    prisma.product.aggregate({ where: { companyId }, _sum: { currentStock: true } }),
                    prisma.$queryRaw<{ name: string; currentStock: number; minStock: number | null; price: number }[]>`
                        SELECT name, "currentStock", "minStock", price
                        FROM products
                        WHERE "companyId" = ${companyId}
                          AND "minStock" IS NOT NULL
                          AND "currentStock" <= "minStock"
                        ORDER BY "currentStock" ASC
                        LIMIT 10
                    `,
                    prisma.warehouse.findMany({
                        where: { companyId, isActive: true },
                        select: { name: true, location: true }
                    })
                ]);

                responseData.total_products = totalProducts;
                responseData.total_items = stockValue._sum.currentStock || 0;
                responseData.low_stock = lowStockRecords.length;
                responseData.low_stock_details = lowStockRecords;
                responseData.active_warehouses = warehouses;
                
                // Essential product list for AI context (limited to 50 for stability)
                const essentials = await prisma.product.findMany({
                    where: { companyId },
                    select: { name: true, currentStock: true, price: true },
                    take: 50,
                    orderBy: { currentStock: 'asc' }
                });

                responseData.products_summary = essentials;
            } else {
                responseData.inventory_status = 'empty_inventory';
            }

            // 3. HR Metrics
            const [activeCount, totalCount, payrollSummary, pendingVacations] = await Promise.all([
                prisma.employee.count({ where: { companyId, isActive: true } }),
                prisma.employee.count({ where: { companyId } }),
                prisma.payrollRecord.aggregate({
                    where: { employee: { companyId }, month: now.getMonth() + 1, year: now.getFullYear() },
                    _sum: { netSalary: true, totalEarnings: true, totalDeductions: true }
                }),
                prisma.vacationRequest.count({ where: { employee: { companyId }, status: 'pending' } })
            ]);

            responseData.employees = { active: activeCount, total: totalCount };
            responseData.payroll = {
                month: now.getMonth() + 1,
                year: now.getFullYear(),
                total_net: payrollSummary._sum.netSalary || 0,
                total_earnings: payrollSummary._sum.totalEarnings || 0,
                total_deductions: payrollSummary._sum.totalDeductions || 0
            };
            responseData.vacations = { pending: pendingVacations };

            // 4. Financial Spending (Purchase Orders proxy)
            const expenses = await prisma.purchaseOrder.aggregate({
                where: { companyId, status: { in: ['received', 'ordered'] }, createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
                _sum: { total: true }
            });
            responseData.financial_expenses = {
                monthly_supplier_spend: expenses._sum.total || 0
            };

            // 5. Specific Quotes if intent triggers it
            if (intent.type === 'quotation') {
                const quote = await prisma.customerOrder.findFirst({
                    where: { companyId, orderType: 'quotation' },
                    include: { items: true },
                    orderBy: { createdAt: 'desc' }
                });
                responseData.quote = quote;
            }

            return responseData;
        } catch (error) {
            console.error('Error fetching data for AI:', error);
            // Return safe fallback containing original shapes so UI doesn't crash
            return { today: { total: 0, count: 0 }, low_stock: 0, total_products: 0 };
        }
    }

    private prepareReportData(type: string, data: any) {
        if (type === 'sales') {
            return {
                total: data.today?.total || 0,
                count: data.today?.count || 0,
                average: data.today?.count > 0 ? (data.today.total / data.today.count) : 0,
                sales: []
            };
        }
        if (type === 'inventory') {
            return {
                totalProducts: data.total_products || 0,
                lowStockCount: data.low_stock || 0,
                totalCost: data.valuation?.total_cost || 0,
                totalValue: data.valuation?.total_sale || 0,
                potentialProfit: data.valuation?.potential_profit || 0,
                lowStockProducts: data.low_stock_details || []
            };
        }
        if (type === 'inventory_table' || type === 'price_list') {
            return {
                products: data.products || []
            };
        }
        if (type === 'quotation') {
            return {
                quote: data.quote || null
            };
        }
        if (type === 'hr') {
            return {
                employees: data.employees,
                payroll: data.payroll,
                vacations: data.vacations
            };
        }
        return data; // Generic fallback
    }
}

export const chatService = new ChatService();
