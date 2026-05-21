export type PhysicalInventoryStatus = 'DRAFT' | 'COUNTING' | 'REVIEW' | 'APPROVED' | 'CANCELLED';

export interface PhysicalInventoryLine {
    id: string;
    productId: string;
    expectedQuantity: number;
    countedQuantity: number;
    difference: number;
    notes?: string | null;
    product?: {
        id: string;
        code: string;
        name: string;
        unit: string;
        currentStock: number;
    };
}

export interface PhysicalInventory {
    id: string;
    reference: string;
    warehouseId: string;
    status: PhysicalInventoryStatus;
    notes?: string | null;
    startedAt: string;
    finishedAt?: string | null;
    warehouse?: {
        id: string;
        code: string;
        name: string;
    };
    _count?: {
        lines: number;
    };
}

export interface PhysicalInventoryDetail extends PhysicalInventory {
    lines: PhysicalInventoryLine[];
}
