import Dexie, { type Table } from 'dexie';
import type { Product, Customer } from '../types/index';

export interface PendingSale {
    id?: number;
    data: any; // Sale creation data
    timestamp: number;
    synced: boolean;
    error?: string;
}

export interface PendingOperation {
    id?: number;
    module: string;
    endpoint: string;
    method: 'POST' | 'PUT' | 'DELETE';
    data: any;
    timestamp: number;
    synced: boolean;
    error?: string;
    priority?: number;
}

export class OfflineDB extends Dexie {
    pendingSales!: Table<PendingSale>;
    pendingOperations!: Table<PendingOperation>;
    products!: Table<Product>;
    customers!: Table<Customer>;
    medications!: Table<any>; // For Pharmacy
    rooms!: Table<any>;        // For Hotel

    constructor() {
        super('OfflineDB');
        this.version(3).stores({
            pendingSales: '++id, timestamp, synced',
            pendingOperations: '++id, module, method, synced, timestamp',
            products: 'id, name, code, category',
            customers: 'id, name, phone, document',
            medications: 'id, name, registrationNumber',
            rooms: 'id, number, type'
        });
    }
}

export const db = new OfflineDB();
