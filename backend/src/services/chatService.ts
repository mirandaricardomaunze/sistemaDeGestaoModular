import { prisma } from '../lib/prisma';
import { aiService } from './aiService';
import { pdfService } from './pdfService';
import { ApiError } from '../middleware/error.middleware';

export class ChatService {
    async processMessage(message: string, userId: string, companyId: string) {
        const intent = await this.detectIntent(message);
        const [data, company] = await Promise.all([
            this.fetchRelevantData(intent, companyId),
            prisma.company.findUnique({ where: { id: companyId }, select: { name: true, businessType: true, address: true, nuit: true, phone: true, email: true } })
        ]);

        const result = await aiService.generateResponse(message, companyId, { ...data, companyInfo: company });
        
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

    async getSuggestions() {
        return {
            suggestions: [
                {
                    category: 'Geral',
                    questions: [
                        'Como estão as vendas hoje?',
                        'Quais produtos estão com stock baixo?',
                        'Análise de margem dos produtos Classe A',
                        'Lista de clientes em risco de inactividade'
                    ]
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

    private async fetchRelevantData(intent: any, companyId: string) {
        try {
            const now = new Date();
            const todayStart = new Date(now.setHours(0, 0, 0, 0));
            const yesterdayStart = new Date(new Date(todayStart).setDate(todayStart.getDate() - 1));

            if (intent.type === 'sales' || intent.type === 'report') {
                const [todaySales, yesterdaySales, topProducts] = await Promise.all([
                    prisma.sale.aggregate({ where: { companyId, createdAt: { gte: todayStart } }, _sum: { total: true }, _count: true }),
                    prisma.sale.aggregate({ where: { companyId, createdAt: { gte: yesterdayStart, lt: todayStart } }, _sum: { total: true } }),
                    prisma.saleItem.groupBy({
                        by: ['productName'],
                        where: { sale: { companyId, createdAt: { gte: todayStart } } },
                        _sum: { quantity: true, total: true },
                        orderBy: { _sum: { quantity: 'desc' } },
                        take: 3
                    })
                ]);

                return {
                    today: { total: todaySales._sum.total || 0, count: todaySales._count },
                    yesterday: { total: yesterdaySales._sum.total || 0 },
                    top_products: topProducts.map(p => ({ name: p.productName, qty: p._sum.quantity, total: p._sum.total }))
                };
            }

            if (intent.type === 'inventory') {
                const totalProducts = await prisma.product.count({ where: { companyId } });
                
                if (totalProducts === 0) {
                    return { 
                        status: 'empty_inventory',
                        message: 'Ainda não existem produtos registados para esta empresa.',
                        suggestions: ['Registar novo produto', 'Importar ficheiro de inventrio']
                    };
                }

                const [stockValue, allProducts] = await Promise.all([
                    prisma.product.aggregate({ where: { companyId }, _sum: { currentStock: true } }),
                    prisma.product.findMany({
                        where: { companyId },
                        select: { name: true, code: true, barcode: true, currentStock: true, minStock: true, costPrice: true, price: true }
                    })
                ]);

                // Detect low stock and calculate valuation in memory for accuracy and stability
                const lowStockDetails = allProducts
                    .filter(p => p.currentStock <= p.minStock)
                    .map(p => ({
                        name: p.name,
                        code: p.code,
                        barcode: p.barcode,
                        currentStock: p.currentStock,
                        minStock: p.minStock,
                        price: p.price
                    }));

                const valuation = allProducts.reduce((acc, p) => ({
                    totalCost: acc.totalCost + (Number(p.currentStock) * Number(p.costPrice || 0)),
                    totalSale: acc.totalSale + (Number(p.currentStock) * Number(p.price || 0))
                }), { totalCost: 0, totalSale: 0 });

                return {
                    status: 'success',
                    low_stock: lowStockDetails.length,
                    total_products: totalProducts,
                    total_items: stockValue._sum.currentStock || 0,
                    low_stock_details: lowStockDetails.slice(0, 20), // Detailed list of 20 products for tables
                    all_products: allProducts.slice(0, 100).map(p => ({ name: p.name, code: p.code, barcode: p.barcode, stock: p.currentStock })), // Increased to 100 for better listings
                    valuation: {
                        total_cost: valuation.totalCost,
                        total_sale: valuation.totalSale,
                        potential_profit: valuation.totalSale - valuation.totalCost
                    }
                };
            }

            if (intent.type === 'hr') {
                const now = new Date();
                const [activeCount, totalCount, payrollSummary, pendingVacations] = await Promise.all([
                    prisma.employee.count({ where: { companyId, isActive: true } }),
                    prisma.employee.count({ where: { companyId } }),
                    prisma.payrollRecord.aggregate({
                        where: { employee: { companyId }, month: now.getMonth() + 1, year: now.getFullYear() },
                        _sum: { netSalary: true, totalEarnings: true, totalDeductions: true }
                    }),
                    prisma.vacationRequest.count({ where: { employee: { companyId }, status: 'pending' } })
                ]);

                return {
                    employees: { active: activeCount, total: totalCount },
                    payroll: {
                        month: now.getMonth() + 1,
                        year: now.getFullYear(),
                        total_net: payrollSummary._sum.netSalary || 0,
                        total_earnings: payrollSummary._sum.totalEarnings || 0,
                        total_deductions: payrollSummary._sum.totalDeductions || 0
                    },
                    vacations: { pending: pendingVacations }
                };
            }

            if (intent.type === 'inventory' || intent.type === 'price_list') {
                // Return all products for detailed tables/price lists
                const products = await prisma.product.findMany({
                    where: { companyId },
                    select: { name: true, code: true, barcode: true, currentStock: true, price: true, category: true }
                });
                return { products };
            }

            if (intent.type === 'quotation') {
                // Fetch the latest quotation
                const quote = await prisma.customerOrder.findFirst({
                    where: { companyId, notes: { contains: '__QUOTE__' } },
                    include: { items: true },
                    orderBy: { createdAt: 'desc' }
                });
                return { quote };
            }

            return {};
        } catch (error) {
            console.error('Error fetching data for AI:', error);
            return {};
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
