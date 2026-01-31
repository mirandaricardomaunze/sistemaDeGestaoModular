import api from './client';

export interface ExportPayload {
    type: 'pdf' | 'excel';
    title: string;
    subtitle?: string;
    columns: { header: string; key: string; width?: number }[];
    data: any[];
    filename?: string;
}

export const exportAPI = {
    /**
     * Triggers a professional document export (PDF or Excel)
     */
    async export(payload: ExportPayload) {
        const response = await api.post('/export', payload, {
            responseType: 'blob'
        });

        // Create a blob from the response data
        const blob = new Blob([response.data], {
            type: payload.type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        // Create a download link and trigger it
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const extension = payload.type === 'pdf' ? 'pdf' : 'xlsx';
        link.setAttribute('download', `${payload.filename || 'Relatorio'}.${extension}`);
        document.body.appendChild(link);
        link.click();

        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
    }
};
