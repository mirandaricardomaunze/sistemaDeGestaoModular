import api from './client';

export interface SAFTParams {
    startDate: string;
    endDate: string;
    fiscalYear: string;
}

export const saftAPI = {
    /**
     * Faz download do ficheiro SAF-T XML para o período indicado.
     * O ficheiro é gerado pelo backend e descarregado automaticamente no browser.
     */
    async downloadSAFT(params: SAFTParams): Promise<void> {
        // Usamos fetch directo (não axios) porque precisamos da response como Blob
        const token = localStorage.getItem('auth_token');
        const query = new URLSearchParams({
            startDate: params.startDate,
            endDate: params.endDate,
            fiscalYear: params.fiscalYear,
        }).toString();

        const response = await fetch(
            `${(api.defaults.baseURL ?? 'http://localhost:3001/api')}/saft/export?${query}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token ?? ''}`,
                },
            }
        );

        if (!response.ok) {
            const body = await response.json().catch(() => ({})) as { error?: string };
            throw new Error(body?.error ?? `Erro ${response.status} ao gerar SAF-T`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SAFT-MZ_${params.fiscalYear}_${params.startDate}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
};
