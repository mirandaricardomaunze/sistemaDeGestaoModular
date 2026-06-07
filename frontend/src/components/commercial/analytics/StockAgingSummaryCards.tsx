import { MetricCard } from '../../common/ModuleMetricCard';
import type { StockAgingReport } from '../../../services/api/commercial.api';
import {
    STOCK_AGING_BUCKETS,
    STOCK_AGING_CONFIG,
    type StockAgingBucket,
} from './stockAging.config';

// Re-export so existing consumers of the cards module keep working.
export { STOCK_AGING_BUCKETS, STOCK_AGING_CONFIG } from './stockAging.config';
export type { StockAgingBucket } from './stockAging.config';

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
                        value={summary[bucket]}
                        color={cfg.palette}
                        icon={<Icon className="w-5 h-5" />}
                        badge={
                            <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-widest">
                                produtos
                            </span>
                        }
                        isActive={activeBucket === bucket}
                        onClick={() => onBucketChange(activeBucket === bucket ? '' : bucket)}
                    />
                );
            })}
        </div>
    );
}
