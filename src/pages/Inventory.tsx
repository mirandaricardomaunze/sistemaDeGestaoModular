import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import InventoryTable from '../components/inventory/InventoryTable';
import ProductForm from '../components/inventory/ProductForm';
import InventoryPrintReport from '../components/inventory/InventoryPrintReport';
import BatchManager from '../components/inventory/BatchManager';
import { cn } from '../utils/helpers';
import { Button, PageHeader } from '../components/ui';
import {
    HiOutlinePrinter,
    HiOutlineArrowPath,
    HiOutlinePlus,
    HiOutlineSquares2X2,
    HiOutlineClock,
    HiOutlineCube
} from 'react-icons/hi2';
import type { Product } from '../types';

type InventoryTab = 'products' | 'batches';

export default function Inventory() {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<InventoryTab>('products');
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [showPrintReport, setShowPrintReport] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [initialSearch, setInitialSearch] = useState(searchParams.get('search') || '');

    useEffect(() => {
        const search = searchParams.get('search');
        if (search) {
            setInitialSearch(search);
        }
    }, [searchParams]);

    const handleAddProduct = () => {
        setEditingProduct(null);
        setShowProductForm(true);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setShowProductForm(true);
    };

    const handleCloseForm = () => {
        setShowProductForm(false);
        setEditingProduct(null);
    };

    const handleProductSuccess = useCallback(() => {
        setRefreshKey(prev => prev + 1);
        handleCloseForm();
    }, []);

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Gestão de Inventário"
                subtitle="Controlo de Produtos, Stock e Lotes de Validade"
                icon={<HiOutlineCube className="text-primary-600 dark:text-primary-400" />}
                actions={
                    <>
                        {activeTab === 'products' && (
                            <>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-blue-600"
                                    leftIcon={<HiOutlineArrowPath className="w-5 h-5 text-primary-600 dark:text-primary-400" />} 
                                    onClick={() => setRefreshKey(prev => prev + 1)}
                                >
                                    Actualizar
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="font-black text-[10px] uppercase tracking-widest text-slate-700 dark:text-slate-300"
                                    leftIcon={<HiOutlinePrinter className="w-5 h-5 text-primary-600 dark:text-primary-400" />} 
                                    onClick={() => setShowPrintReport(true)}
                                >
                                    Imprimir Stock
                                </Button>
                                <Button 
                                    size="sm" 
                                    className="font-black text-[10px] uppercase tracking-widest"
                                    leftIcon={<HiOutlinePlus className="w-5 h-5 text-white dark:text-primary-400" />} 
                                    onClick={handleAddProduct}
                                >
                                    Novo Produto
                                </Button>
                            </>
                        )}
                    </>
                }
                tabs={
                    <nav className="flex gap-1">
                        <button
                            onClick={() => setActiveTab('products')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 px-2 md:px-6 py-4 text-xs md:text-sm font-black border-b-2 transition-all whitespace-nowrap uppercase tracking-widest",
                                activeTab === 'products'
                                    ? "border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/10 rounded-t-lg"
                                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-800 rounded-t-lg"
                            )}
                        >
                            <HiOutlineSquares2X2 className="w-5 h-5 text-current" />
                            Produtos
                        </button>
                        <button
                            onClick={() => setActiveTab('batches')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 px-2 md:px-6 py-4 text-xs md:text-sm font-black border-b-2 transition-all whitespace-nowrap uppercase tracking-widest",
                                activeTab === 'batches'
                                    ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-t-lg"
                                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-800 rounded-t-lg"
                            )}
                        >
                            <HiOutlineClock className="w-5 h-5 text-current" />
                            Lotes & Validades
                        </button>
                    </nav>
                }
            />

            {/* Tab Content */}
            <div className="min-h-[500px]">
                {activeTab === 'products' ? (
                    <>
                        <InventoryTable
                            key={`${refreshKey}-${initialSearch}`}
                            onEdit={handleEdit}
                            onAddProduct={handleAddProduct}
                            initialSearch={initialSearch}
                        />
                        <ProductForm
                            isOpen={showProductForm}
                            onClose={handleCloseForm}
                            product={editingProduct}
                            onSuccess={handleProductSuccess}
                        />
                        <InventoryPrintReport
                            isOpen={showPrintReport}
                            onClose={() => setShowPrintReport(false)}
                        />
                    </>
                ) : (
                    <BatchManager />
                )}
            </div>
        </div>
    );
}
