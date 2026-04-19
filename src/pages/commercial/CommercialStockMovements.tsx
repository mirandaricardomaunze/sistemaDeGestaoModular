import StockMovementHistory from '../../components/inventory/StockMovementHistory';
import { HiOutlineArrowPathRoundedSquare, HiOutlineArrowPath } from 'react-icons/hi2';
import { Button } from '../../components/ui';

export default function CommercialStockMovements() {
    return (
        <div className="space-y-4 animate-fade-in pb-10">
            {/* Dedicated Commercial Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white dark:bg-dark-900 p-6 rounded-lg border border-gray-100 dark:border-dark-700 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                            <HiOutlineArrowPathRoundedSquare className="text-emerald-600 w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                            Movimentos de Stock
                        </h2>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium font-mono lowercase">Rastreio completo de entradas, saídas e transferências de inventário</p>
                </div>
                
                <div className="flex items-center gap-2 relative z-10">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => window.location.reload()} 
                        className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-emerald-600"
                        leftIcon={<HiOutlineArrowPath className="w-4 h-4" />}
                    >
                        Sincronizar
                    </Button>
                </div>
            </div>

            {/* The existing movement history component - will be rendered with the commercial filter */}
            <StockMovementHistory originModule="commercial" />
        </div>
    );
}
