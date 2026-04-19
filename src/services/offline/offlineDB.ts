import Dexie, { Table } from 'dexie';

export interface OfflineProduct {
  id: string;
  code: string;
  name: string;
  price: number;
  currentStock: number;
  category: string;
  unit: string;
  warehouseId?: string;
}

export interface OfflineCustomer {
  id: string;
  name: string;
  phone: string;
  code: string;
}

export interface SyncItem {
  id?: number;
  type: 'SALE' | 'CUSTOMER' | 'RESERVATION';
  data: any;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
  attempts: number;
  error?: string;
}

export class MulticoreOfflineDB extends Dexie {
  products!: Table<OfflineProduct>;
  customers!: Table<OfflineCustomer>;
  syncQueue!: Table<SyncItem>;

  constructor() {
    super('MulticoreOfflineDB');
    this.version(1).stores({
      products: 'id, code, name, category',
      customers: 'id, name, phone, code',
      syncQueue: '++id, type, status, timestamp'
    });
  }
  
  // Helper to clear cache
  async clearCache() {
    await this.products.clear();
    await this.customers.clear();
  }
}

export const offlineDB = new MulticoreOfflineDB();
