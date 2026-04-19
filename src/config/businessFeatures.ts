import type{ BusinessType } from '../types';

export interface BusinessConfig {
    name: string;
    modules: {
        inventory: boolean;
        sales: boolean;
        crm: boolean;
        hr: boolean;
        fiscal: boolean;
        logistics: boolean;
        hotel: boolean;
        pharmacy: boolean;
    };
    features: {
        batches: boolean;
        expiryDates: boolean;
        serialNumbers: boolean;
        roomManagement: boolean;
        tableManagement: boolean;
        barcodeScanning: boolean;
        loyaltyProgram: boolean;
    };
    posMode: 'quick' | 'detailed' | 'hospitality';
}

export const businessConfigs: Record<BusinessType, BusinessConfig> = {
    retail: {
        name: 'Loja de Varejo / Comércio',
        modules: {
            inventory: true,
            sales: true,
            crm: true,
            hr: true,
            fiscal: true,
            logistics: false,
            hotel: false,
            pharmacy: false,
        },
        features: {
            batches: false,
            expiryDates: true,
            serialNumbers: true,
            roomManagement: false,
            tableManagement: false,
            barcodeScanning: true,
            loyaltyProgram: true,
        },
        posMode: 'quick',
    },
    bottlestore: {
        name: 'Bottle Store / Garrafeira',
        modules: {
            inventory: true,
            sales: true,
            crm: true,
            hr: true,
            fiscal: true,
            logistics: false,
            hotel: false,
            pharmacy: false,
        },
        features: {
            batches: false,
            expiryDates: false,
            serialNumbers: false,
            roomManagement: false,
            tableManagement: false,
            barcodeScanning: true,
            loyaltyProgram: true,
        },
        posMode: 'quick',
    },
    pharmacy: {
        name: 'Farmácia',
        modules: {
            inventory: true,
            sales: true,
            crm: true,
            hr: true,
            fiscal: true,
            logistics: false,
            hotel: false,
            pharmacy: true,
        },
        features: {
            batches: true,
            expiryDates: true,
            serialNumbers: false,
            roomManagement: false,
            tableManagement: false,
            barcodeScanning: true,
            loyaltyProgram: true,
        },
        posMode: 'detailed',
    },
    supermarket: {
        name: 'Supermercado',
        modules: {
            inventory: true,
            sales: true,
            crm: true,
            hr: true,
            fiscal: true,
            logistics: true,
            hotel: false,
            pharmacy: false,
        },
        features: {
            batches: true,
            expiryDates: true,
            serialNumbers: false,
            roomManagement: false,
            tableManagement: false,
            barcodeScanning: true,
            loyaltyProgram: true,
        },
        posMode: 'quick',
    },
    hotel: {
        name: 'Hotel / Hospedagem',
        modules: {
            inventory: true,
            sales: true,
            crm: true,
            hr: true,
            fiscal: true,
            logistics: false,
            hotel: true,
            pharmacy: false,
        },
        features: {
            batches: false,
            expiryDates: false,
            serialNumbers: false,
            roomManagement: true,
            tableManagement: true,
            barcodeScanning: false,
            loyaltyProgram: true,
        },
        posMode: 'hospitality',
    },
    logistics: {
        name: 'Logística / Armazém',
        modules: {
            inventory: true,
            sales: false,
            crm: false,
            hr: true,
            fiscal: true,
            logistics: true,
            hotel: false,
            pharmacy: false,
        },
        features: {
            batches: true,
            expiryDates: true,
            serialNumbers: true,
            roomManagement: false,
            tableManagement: false,
            barcodeScanning: true,
            loyaltyProgram: false,
        },
        posMode: 'detailed',
    },
};

export const getBusinessConfig = (type: BusinessType): BusinessConfig => {
    return businessConfigs[type] || businessConfigs.retail;
};
