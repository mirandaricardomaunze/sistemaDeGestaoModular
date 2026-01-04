import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import InventoryTable from '../components/inventory/InventoryTable';
import WarehouseManager from '../components/inventory/WarehouseManager';
import StockTransferManager from '../components/inventory/StockTransferManager';
import ProductForm from '../components/inventory/ProductForm';
import InventoryPrintReport from '../components/inventory/InventoryPrintReport';
import { Button } from '../components/ui';
import { HiOutlinePrinter, HiOutlineCube, HiOutlineOfficeBuilding, HiOutlineTruck } from 'react-icons/hi';
import type { Product } from '../types';

type Tab = 'products' | 'warehouses' | 'transfers';

export default function Inventory() {
    const { t } = useTranslation();
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

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {t('products.management')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        {t('products.description')}
                    </p>
                </div>
                <div className="flex gap-2">
                    {activeTab === 'products' && (
                        <Button
                            variant="outline"
                            leftIcon={<HiOutlinePrinter className="w-5 h-5" />}
                            onClick={() => setShowPrintReport(true)}
                        >
                            {t('products.printInventory')}
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-dark-700 pb-1">
                <Button
                    variant={activeTab === 'products' ? 'primary' : 'ghost'}
                    onClick={() => setActiveTab('products')}
                    leftIcon={<HiOutlineCube className="w-5 h-5" />}
                >
                    {t('products.title')}
                </Button>
                <Button
                    variant={activeTab === 'warehouses' ? 'primary' : 'ghost'}
                    onClick={() => setActiveTab('warehouses')}
                    leftIcon={<HiOutlineOfficeBuilding className="w-5 h-5" />}
                >
                    {t('products.warehouses')}
                </Button>
                <Button
                    variant={activeTab === 'transfers' ? 'primary' : 'ghost'}
                    onClick={() => setActiveTab('transfers')}
                    leftIcon={<HiOutlineTruck className="w-5 h-5" />}
                >
                    {t('products.transfers')}
                </Button>
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
