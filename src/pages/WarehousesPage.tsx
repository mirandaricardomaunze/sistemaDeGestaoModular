import { useState } from 'react';
import WarehouseManager from '../components/inventory/WarehouseManager';
import { Button } from '../components/ui';
import { HiOutlinePlus, HiOutlineRefresh } from 'react-icons/hi';

export default function WarehousesPage() {
    const [refreshKey, setRefreshKey] = useState(0);

    const handleNewWarehouse = () => {
        const element = document.getElementById('new-warehouse-btn');
        if (element) (element as HTMLButtonElement).click();
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Armazéns</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Gestão de Armazéns e Depósitos</p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<HiOutlineRefresh className="w-5 h-5" />}
                            onClick={() => setRefreshKey(prev => prev + 1)}
                        >
                            Actualizar
                        </Button>
                        <Button
                            size="sm"
                            leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                            onClick={handleNewWarehouse}
                        >
                            Novo Armazém
                        </Button>
                    </div>
                </div>
            </div>

            <WarehouseManager key={refreshKey} />
        </div>
    );
}
