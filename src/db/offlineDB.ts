import Dexie, { type Table } from 'dexie';
import type { Product, Customer } from '../types/index';

export interface PendingSale {
    id?: number;
    data: any; // Sale creation data
    timestamp: number;
    synced: boolean;
    error?: string;
}

export class OfflineDB extends Dexie {
    pendingSales!: Table<PendingSale>;
    products!: Table<Product>;
    customers!: Table<Customer>;

    constructor() {
        super('OfflineDB');
        this.version(2).stores({
            pendingSales: '++id, timestamp, synced',
            products: 'id, name, code, category',
            customers: 'id, name, phone, document'
        });
    }
}

export const db = new OfflineDB();
