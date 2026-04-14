import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import InventoryTable from '../../components/inventory/InventoryTable';
import ProductForm from '../../components/inventory/ProductForm';
import InventoryPrintReport from '../../components/inventory/InventoryPrintReport';
import BatchManager from '../../components/inventory/BatchManager';
import { Button } from '../../components/ui';
import {
    HiOutlinePrinter,
    HiOutlineRefresh,
    HiOutlinePlus,
    HiOutlineViewGrid,
    HiOutlineClock,
    HiOutlineCube,
} from 'react-icons/hi';
import type { Product } from '../../types';

type InventoryTab = 'products' | 'batches';

export default function CommercialInventory() {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<InventoryTab>('products');
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [showPrintReport, setShowPrintReport] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [initialSearch, setInitialSearch] = useState(searchParams.get('search') || '');

    useEffect(() => {
        const search = searchParams.get('search');
        if (search) setInitialSearch(search);
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
            {/* Header */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <HiOutlineCube className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                                Produtos Comerciais
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                Gestão de produtos, referências, stock e margens
                            </p>
                        </div>
                    </div>
                    {activeTab === 'products' && (
                        <div className="flex flex-wrap gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                leftIcon={<HiOutlineRefresh className="w-5 h-5" />}
                                onClick={() => setRefreshKey(prev => prev + 1)}
                            >
                                Actualizar
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                leftIcon={<HiOutlinePrinter className="w-5 h-5" />}
                                onClick={() => setShowPrintReport(true)}
                            >
                                Imprimir Stock
                            </Button>
                            <Button
                                size="sm"
                                leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                                onClick={handleAddProduct}
                            >
                                Novo Produto
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-dark-700">
                <nav className="flex gap-1">
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                            activeTab === 'products'
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/10 rounded-t-lg'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-800 rounded-t-lg'
                        }`}
                    >
                        <HiOutlineViewGrid className="w-5 h-5" />
                        Produtos
                    </button>
                    <button
                        onClick={() => setActiveTab('batches')}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                            activeTab === 'batches'
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 rounded-t-lg'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-800 rounded-t-lg'
                        }`}
                    >
                        <HiOutlineClock className="w-5 h-5" />
                        Lotes &amp; Validades
                    </button>
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px]">
                {activeTab === 'products' ? (
                    <>
                        <InventoryTable
                            key={`${refreshKey}-${initialSearch}`}
                            onEdit={handleEdit}
                            onAddProduct={handleAddProduct}
                            initialSearch={initialSearch}
                            originModule="commercial"
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
