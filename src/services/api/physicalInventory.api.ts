import api from './client';
import type { PhysicalInventory, PhysicalInventoryDetail } from '../../types/inventory';

export const physicalInventoryAPI = {
    async list(warehouseId?: string): Promise<PhysicalInventory[]> {
        const response = await api.get('/physical-inventory', { params: { warehouseId } });
        return response.data;
    },

    async getDetail(id: string): Promise<PhysicalInventoryDetail> {
        const response = await api.get(`/physical-inventory/${id}`);
        return response.data;
    },

    async create(data: { warehouseId: string; notes?: string | null }): Promise<PhysicalInventory> {
        const response = await api.post('/physical-inventory', data);
        return response.data;
    },

    async submitCounts(id: string, lines: Array<{ lineId: string; countedQuantity: number; notes?: string | null }>): Promise<PhysicalInventoryDetail> {
        const response = await api.post(`/physical-inventory/${id}/counts`, { lines });
        return response.data;
    },

    async approve(id: string): Promise<PhysicalInventoryDetail> {
        const response = await api.post(`/physical-inventory/${id}/approve`);
        return response.data;
    },

    async cancel(id: string): Promise<PhysicalInventory> {
        const response = await api.post(`/physical-inventory/${id}/cancel`);
        return response.data;
    },
};
