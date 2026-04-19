import { commercialAnalyticsService } from './commercial/analytics.service';
import { commercialPurchaseOrderService } from './commercial/purchaseOrder.service';
import { commercialQuotationService } from './commercial/quotation.service';
import { commercialFinancialService } from './commercial/financial.service';
import { commercialReservationService } from './commercial/reservation.service';

// Re-export sub-services for direct import by routes that prefer them
export {
    commercialAnalyticsService,
    commercialPurchaseOrderService,
    commercialQuotationService,
    commercialFinancialService,
    commercialReservationService,
};

// Facade: preserves the single import surface used by all existing route handlers
class CommercialService {
    // Analytics
    getAnalytics       = commercialAnalyticsService.getAnalytics.bind(commercialAnalyticsService);
    getMarginAnalysis  = commercialAnalyticsService.getMarginAnalysis.bind(commercialAnalyticsService);
    getStockAging      = commercialAnalyticsService.getStockAging.bind(commercialAnalyticsService);
    getInventoryTurnover = commercialAnalyticsService.getInventoryTurnover.bind(commercialAnalyticsService);
    getSalesReport     = commercialAnalyticsService.getSalesReport.bind(commercialAnalyticsService);
    getSupplierPerformance = commercialAnalyticsService.getSupplierPerformance.bind(commercialAnalyticsService);
    getWarehouseDistribution = commercialAnalyticsService.getWarehouseDistribution.bind(commercialAnalyticsService);

    // Purchase Orders
    listPurchaseOrders         = commercialPurchaseOrderService.listPurchaseOrders.bind(commercialPurchaseOrderService);
    getPurchaseOrderById       = commercialPurchaseOrderService.getPurchaseOrderById.bind(commercialPurchaseOrderService);
    updatePurchaseOrderStatus  = commercialPurchaseOrderService.updatePurchaseOrderStatus.bind(commercialPurchaseOrderService);
    registerPartialDelivery    = commercialPurchaseOrderService.registerPartialDelivery.bind(commercialPurchaseOrderService);
    deletePurchaseOrder        = commercialPurchaseOrderService.deletePurchaseOrder.bind(commercialPurchaseOrderService);
    validateSupplierProducts   = commercialPurchaseOrderService.validateSupplierProducts.bind(commercialPurchaseOrderService);

    // Quotations
    listQuotations             = commercialQuotationService.listQuotations.bind(commercialQuotationService);
    createQuotation            = commercialQuotationService.createQuotation.bind(commercialQuotationService);
    convertQuotationToInvoice  = commercialQuotationService.convertQuotationToInvoice.bind(commercialQuotationService);

    // Financial
    getAccountsReceivable = commercialFinancialService.getAccountsReceivable.bind(commercialFinancialService);

    // Stock Reservations
    reserveItem                 = commercialReservationService.reserveItem.bind(commercialReservationService);
    releaseItem                 = commercialReservationService.releaseItem.bind(commercialReservationService);
    cleanupExpiredReservations  = commercialReservationService.cleanupExpiredReservations.bind(commercialReservationService);
}

export const commercialService = new CommercialService();
