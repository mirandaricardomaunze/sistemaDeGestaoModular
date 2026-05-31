import { useState } from 'react';
import WarehouseManager from '../components/inventory/WarehouseManager';
import { Button } from '../components/ui';
import { HiOutlinePlus, HiOutlineArrowPath } from 'react-icons/hi2';

export default function WarehousesPage() {
    const [refreshKey, setRefreshKey] = useState(0);

    const handleNewWarehouse = () => {
        const element = document.getElementById('new-warehouse-btn');
        if (element) (element as HTMLButtonElement).click();
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-dark-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Armazéns</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Gestão de Armazéns e Depósitos</p>
                    </div>
                    <div className="grid w-full md:w-auto md:flex-1 max-w-[400px] grid-cols-2 gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full font-black text-[10px] uppercase tracking-widest text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10"
                            leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                            onClick={() => setRefreshKey(prev => prev + 1)}
                        >
                            Actualizar
                        </Button>
                        <Button
                            size="sm"
                            className="w-full font-black text-[10px] uppercase tracking-widest"
                            leftIcon={<HiOutlinePlus className="w-4 h-4" />}
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
