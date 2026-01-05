import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import InventoryTable from '../components/inventory/InventoryTable';
import WarehouseManager from '../components/inventory/WarehouseManager';
import StockTransferManager from '../components/inventory/StockTransferManager';
import ProductForm from '../components/inventory/ProductForm';
import InventoryPrintReport from '../components/inventory/InventoryPrintReport';
import { Button } from '../components/ui';
import {
    HiOutlinePrinter,
    HiOutlineCube,
    HiOutlineOfficeBuilding,
    HiOutlineTruck,
    HiOutlineRefresh,
    HiOutlinePlus,
    HiOutlineCalculator
} from 'react-icons/hi';
import ModuleFiscalView from '../components/shared/ModuleFiscalView';
import { cn } from '../utils/helpers';
import type { Product } from '../types';

type Tab = 'products' | 'warehouses' | 'transfers' | 'fiscal';

export default function Inventory() {
    useTranslation();
    const [activeTab, setActiveTab] = useState<Tab>('products');
    const [showProductForm, setShowProductForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [showPrintReport, setShowPrintReport] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

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

    // Callback to refresh product list after create/update
    const handleProductSuccess = useCallback(() => {
        setRefreshKey(prev => prev + 1);
        handleCloseForm();
    }, []);

    const tabs = [
        { id: 'products' as const, label: 'Produtos', icon: <HiOutlineCube className="w-5 h-5" /> },
        { id: 'warehouses' as const, label: 'Armazéns', icon: <HiOutlineOfficeBuilding className="w-5 h-5" /> },
        { id: 'transfers' as const, label: 'Transferências', icon: <HiOutlineTruck className="w-5 h-5" /> },
        { id: 'fiscal' as const, label: 'Fiscal', icon: <HiOutlineCalculator className="w-5 h-5" /> },
    ];

    return (
        <div className="space-y-6">
            {/* Standardized Header with Responsive Tabs */}
            <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">Stock & Inventário</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Gestão de Produtos, Armazéns e Movimentações</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" size="sm" leftIcon={<HiOutlineRefresh className="w-5 h-5" />}>Actualizar</Button>
                        {activeTab === 'products' && (
                            <>
                                <Button variant="outline" size="sm" leftIcon={<HiOutlinePrinter className="w-5 h-5" />} onClick={() => setShowPrintReport(true)}>Imprimir Stock</Button>
                                <Button size="sm" leftIcon={<HiOutlinePlus className="w-5 h-5" />} onClick={handleAddProduct}>Novo Produto</Button>
                            </>
                        )}
                        {activeTab === 'warehouses' && (
                            <Button size="sm" leftIcon={<HiOutlinePlus className="w-5 h-5" />}>Novo Armazém</Button>
                        )}
                    </div>
                </div>

                {/* Responsive Navigation */}
                <div className="mt-6 border-b border-gray-100 dark:border-dark-700">
                    <div className="flex overflow-x-auto no-scrollbar -mb-px">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                className={cn(
                                    "flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap uppercase tracking-wider",
                                    activeTab === tab.id
                                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-dark-600"
                                )}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            {activeTab === 'products' && (
                <InventoryTable
                    key={refreshKey}
                    onEdit={handleEdit}
                    onAddProduct={handleAddProduct}
                />
            )}

            {activeTab === 'warehouses' && <WarehouseManager />}

            {activeTab === 'transfers' && <StockTransferManager />}

            {activeTab === 'fiscal' && <ModuleFiscalView module="inventory" title="Produtos & Inventário" />}

            {/* Product Form Modal */}
            <ProductForm
                isOpen={showProductForm}
                onClose={handleCloseForm}
                product={editingProduct}
                onSuccess={handleProductSuccess}
            />

            {/* Print Report Modal */}
            <InventoryPrintReport
                isOpen={showPrintReport}
                onClose={() => setShowPrintReport(false)}
            />
        </div>
    );
}
