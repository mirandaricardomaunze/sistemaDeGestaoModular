import { FilterCard } from '../../common/ModuleMetricCard';
import type { StockAgingProduct, StockAgingReport } from '../../../services/api/commercial.api';

export type StockAgingBucket = StockAgingProduct['agingBucket'];

export const STOCK_AGING_BUCKETS: StockAgingBucket[] = ['fresh', 'slow', 'aging', 'critical'];

export const STOCK_AGING_CONFIG = {
    fresh: { label: 'Fresco', palette: 'success', badgeVariant: 'success' as const },
    slow: { label: 'Lento (31-60d)', palette: 'warning', badgeVariant: 'warning' as const },
    aging: { label: 'A Envelhecer (61-90d)', palette: 'orange', badgeVariant: 'warning' as const },
    critical: { label: 'Crítico (>90d)', palette: 'danger', badgeVariant: 'danger' as const },
} satisfies Record<StockAgingBucket, { label: string; palette: string; badgeVariant: 'success' | 'warning' | 'danger' }>;

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

                return (
                    <FilterCard
                        key={bucket}
                        label={cfg.label}
                        value={summary[bucket]}
                        sublabel="produtos"
                        color={cfg.palette}
                        isActive={activeBucket === bucket}
                        onClick={() => onBucketChange(activeBucket === bucket ? '' : bucket)}
                    />
                );
            })}
        </div>
    );
}
