/**
 * DriverPanelPage
 * Orchestrates the Driver Panel view with i18n support.
 */

import { useDriverPanel } from '../../hooks/useDriverPanel';
import { DriverDeliveryCard } from '../../components/logistics/DriverDeliveryCard';
import { LoadingSpinner } from '../../components/ui';
import { useTranslation } from 'react-i18next';
import {
    HiOutlineTruck,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineMapPin,
    HiOutlineUser,
    HiOutlineExclamationCircle,
    HiOutlineQrCode
} from 'react-icons/hi2';
import { useState } from 'react';
import QRScannerModal from '../../components/logistics/QRScannerModal';
import { Button } from '../../components/ui';
import toast from 'react-hot-toast';

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
    label: string;
    value: number;
    icon: React.ElementType;
    colorClass: string;
}

function KpiCard({ label, value, icon: Icon, colorClass }: KpiCardProps) {
    return (
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 dark:border-dark-700 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                <Icon className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
                <p className="text-2xl font-extrabold text-gray-900 dark:text-white leading-none">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
        </div>
    );
}


// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DriverPanelPage() {
    const { t } = useTranslation();
    const {
        currentDriver,
        activeDeliveries,
        summary,
        isLoading,
        updateStatus,
        isUpdating,
    } = useDriverPanel();

    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const handleScanResult = (decodedText: string) => {
        setIsScannerOpen(false);
        
        // Try to find the delivery in active deliveries
        const match = activeDeliveries.find(d => 
            d.delivery.number.toLowerCase() === decodedText.toLowerCase() ||
            d.delivery.id === decodedText
        );

        if (match) {
            toast.success(`${t('common.success')}: Encomenda ${match.delivery.number} encontrada.`);
            // Automatically scroll to the card or open a specific update if possible
            const element = document.getElementById(`delivery-card-${match.delivery.id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.classList.add('ring-2', 'ring-primary-500', 'ring-offset-2');
                setTimeout(() => element.classList.remove('ring-2', 'ring-primary-500', 'ring-offset-2'), 3000);
            }
        } else {
            toast.error(`Entrega ${decodedText} não encontrada nas suas tarefas actuais.`);
        }
    };

    // ─── Sub-components inherited from scope ───
    
    function NotLinkedState() {
        return (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
                    <HiOutlineExclamationCircle className="w-10 h-10 text-orange-500" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {t('logistics_module.drivers.notLinkedTitle')}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm text-sm">
                    {t('logistics_module.drivers.notLinkedSubtitle')}
                </p>
                <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
                    {t('logistics_module.drivers.notLinkedHint')}
                </p>
            </div>
        );
    }

    function EmptyDeliveriesState({ driverName }: { driverName: string }) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                    <HiOutlineCheckCircle className="w-8 h-8 text-emerald-500" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {t('logistics_module.deliveries.noPending')}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('common.welcome')}, {driverName}! {t('logistics_module.deliveries.noPending')}
                </p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <LoadingSpinner size="xl" />
                <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                    {t('common.loading')}...
                </p>
            </div>
        );
    }

    if (!currentDriver) {
        return <NotLinkedState />;
    }

    return (
        <div className="space-y-6 pb-12 animate-fade-in">

            {/* ── Driver Identity Header ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 dark:from-primary-700 dark:to-primary-900 p-6 shadow-lg text-white">
                {/* Decorative background icon */}
                <HiOutlineTruck
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-32 h-32 opacity-10"
                    aria-hidden="true"
                />
                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                        {currentDriver.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-widest text-white/70 font-semibold">{t('logistics_module.drivers.driverPanel')}</p>
                        <h1 className="text-2xl font-extrabold">{currentDriver.name}</h1>
                        <p className="text-sm text-white/70 font-mono">{currentDriver.code}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        <Button 
                            variant="primary" 
                            className="bg-white text-primary-700 hover:bg-primary-50 border-none shadow-md hidden sm:flex"
                            leftIcon={<HiOutlineQrCode className="w-5 h-5" />}
                            onClick={() => setIsScannerOpen(true)}
                        >
                            Scan QR
                        </Button>
                        <Button 
                            variant="primary" 
                            className="bg-white text-primary-700 hover:bg-primary-50 border-none shadow-md sm:hidden p-2"
                            onClick={() => setIsScannerOpen(true)}
                        >
                            <HiOutlineQrCode className="w-6 h-6" />
                        </Button>
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm ${
                            currentDriver.status === 'available' ? 'text-emerald-300' :
                            currentDriver.status === 'on_delivery' ? 'text-blue-300' :
                            'text-orange-300'
                        }`}>
                            {currentDriver.status === 'available' ? t('logistics_module.drivers.statuses.available') :
                             currentDriver.status === 'on_delivery' ? t('logistics_module.drivers.statuses.on_delivery') :
                             currentDriver.status === 'off_duty' ? t('logistics_module.drivers.statuses.off_duty') : t('common.inactive')}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── KPI Summary ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <KpiCard
                    label={t('common.total')}
                    value={summary.totalToday}
                    icon={HiOutlineUser}
                    colorClass="bg-primary-100 dark:bg-primary-900/30 text-primary-600"
                />
                <KpiCard
                    label={t('logistics_module.deliveries.status.pending')}
                    value={summary.pending}
                    icon={HiOutlineClock}
                    colorClass="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600"
                />
                <KpiCard
                    label={t('logistics_module.deliveries.status.in_transit')}
                    value={summary.inTransit}
                    icon={HiOutlineMapPin}
                    colorClass="bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                />
                <KpiCard
                    label={t('logistics_module.deliveries.status.delivered')}
                    value={summary.delivered}
                    icon={HiOutlineCheckCircle}
                    colorClass="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
                />
            </div>

            {/* ── Active Deliveries Section ── */}
            <section aria-label="As minhas entregas activas">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <HiOutlineTruck className="w-5 h-5 text-primary-500" aria-hidden="true" />
                    {t('logistics_module.deliveries.title')}
                    {activeDeliveries.length > 0 && (
                        <span className="ml-1 text-sm font-semibold px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                            {activeDeliveries.length}
                        </span>
                    )}
                </h2>

                {activeDeliveries.length === 0 ? (
                    <EmptyDeliveriesState driverName={currentDriver.name} />
                ) : (
                    <div className="space-y-4">
                        {activeDeliveries.map((item) => (
                            <DriverDeliveryCard
                                key={item.delivery.id}
                                item={item}
                                onStatusUpdate={updateStatus}
                                isUpdating={isUpdating}
                            />
                        ))}
                    </div>
                )}
            </section>

            <QRScannerModal 
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleScanResult}
                description="Aponte a câmara para o QR Code na Guia de Transporte"
            />
        </div>
    );
}
