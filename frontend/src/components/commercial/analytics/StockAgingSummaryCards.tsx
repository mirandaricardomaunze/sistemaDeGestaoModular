import {
    HiOutlineSparkles,
    HiOutlineClock,
    HiOutlineExclamationCircle,
    HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import type { ComponentType, SVGProps } from 'react';
import { MetricCard } from '../../common/ModuleMetricCard';
import type { StockAgingProduct, StockAgingReport } from '../../../services/api/commercial.api';

export type StockAgingBucket = StockAgingProduct['agingBucket'];

export const STOCK_AGING_BUCKETS: StockAgingBucket[] = ['fresh', 'slow', 'aging', 'critical'];

type AgingBucketConfig = {
    label: string;
    palette: string;
    badgeVariant: 'success' | 'warning' | 'danger';
    icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const STOCK_AGING_CONFIG = {
    fresh:    { label: 'Fresco',                  palette: 'success', badgeVariant: 'success', icon: HiOutlineSparkles },
    slow:     { label: 'Lento (31-60d)',          palette: 'warning', badgeVariant: 'warning', icon: HiOutlineClock },
    aging:    { label: 'A Envelhecer (61-90d)',   palette: 'orange',  badgeVariant: 'warning', icon: HiOutlineExclamationCircle },
    critical: { label: 'Crítico (>90d)',          palette: 'danger',  badgeVariant: 'danger',  icon: HiOutlineExclamationTriangle },
} satisfies Record<StockAgingBucket, AgingBucketConfig>;

interface StockAgingSummaryCardsProps {
    summary: StockAgingReport['summary'];
    activeBucket: StockAgingBucket | '';
    onBucketChange: (bucket: StockAgingBucket | '') => void;
}

export function StockAgingSummaryCards({
    summary,
    activeBucket,
    onBucketChange,
}: StockAgingSummaryCardsProps) {
    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {STOCK_AGING_BUCKETS.map((bucket) => {
                const cfg = STOCK_AGING_CONFIG[bucket];
                const Icon = cfg.icon;

                return (
                    <MetricCard
                        key={bucket}
                        label={cfg.label}
                        value={`${summary[bucket]} produtos`}
                        color={cfg.palette}
                        icon={<Icon className="w-5 h-5" />}
                        isActive={activeBucket === bucket}
                        onClick={() => onBucketChange(activeBucket === bucket ? '' : bucket)}
                    />
                );
            })}
        </div>
    );
}
