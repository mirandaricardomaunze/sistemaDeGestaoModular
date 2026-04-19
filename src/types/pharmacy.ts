import type { Product, Sale, Customer } from './index';

export interface Medication extends Product {
    requiresPrescription: boolean;
    dosageForm: string;
    strength: string;
    isControlled: boolean;
    isNarcotic: boolean;
    manufacturer: string;
    packSize: number;
    activeIngredients?: string[];
    sideEffects?: string[];
    contraindications?: string[];
    product?: { code?: string; name?: string; price?: number; costPrice?: number };
    dci?: string;
    pharmaceuticalForm?: string;
    totalStock?: number;
    nearestExpiry?: string;
}

export interface PharmacyBatch {
    id: string;
    medicationId: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    currentStock: number;
    costPrice: number;
    sellingPrice: number;
    manufacturer: string;
    manufacturingDate?: string;
    status: 'active' | 'expired' | 'low_stock' | 'recalled';
    medication?: Medication;
    createdAt: string;
    updatedAt: string;
}

export interface Prescription {
    id: string;
    number: string;
    customerId: string;
    doctorName: string;
    doctorLicense?: string;
    clinicName?: string;
    issueDate: string;
    expiryDate: string;
    status: 'pending' | 'partially_dispensed' | 'dispensed' | 'expired' | 'cancelled';
    items: PrescriptionItem[];
    customer?: Customer;
    notes?: string;
    imageUrl?: string;
    createdAt: string;
    updatedAt: string;
}

export interface PrescriptionItem {
    id: string;
    medicationId: string;
    medicationName: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    dispensedQty: number;
}

export interface PharmacySale extends Sale {
    prescriptionId?: string;
    prescription?: Prescription;
    isControlledSale: boolean;
    dispensedBy: string;
    partnerId?: string; // For insurance/partner sales
    partner?: PharmacyPartner;
}

export interface PharmacyPartner {
    id: string;
    name: string;
    code: string;
    type: 'insurance' | 'clinic' | 'government' | 'other';
    discountRate: number;
    contactPerson?: string;
    phone: string;
    email?: string;
    isActive: boolean;
    createdAt: string;
}

export interface DrugInteraction {
    id: string;
    medicationId1: string;
    medicationId2: string;
    severity: 'mild' | 'moderate' | 'severe' | 'fatal';
    description: string;
    recommendation: string;
    createdAt: string;
}

export interface StockReconciliation {
    id: string;
    medicationId: string;
    physicalCount: number;
    systemStock: number;
    difference: number;
    reason?: string;
    performedBy: string;
    createdAt: string;
}

export interface PharmacyDashboardSummary {
    totalSales: number;
    salesCount: number;
    avgSaleAmount: number;
    totalPrescriptions: number;
    lowStockItems: number;
    expiredBatches: number;
    expiringSoonBatches: number;
    topMedications: Array<{
        name: string;
        quantity: number;
        revenue: number;
    }>;
}
