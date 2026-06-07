/**
 * Stock aging buckets — labels, palette, badge variant and icon per bucket.
 *
 * Lives in its own file so React Fast Refresh keeps working in components
 * that import these constants. Mixing constant exports with component
 * exports in the same file makes vite-plugin-react invalidate the module
 * on every HMR.
 */
import {
    HiOutlineSparkles,
    HiOutlineClock,
    HiOutlineExclamationCircle,
    HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import type { ComponentType, SVGProps } from 'react';
import type { StockAgingProduct } from '../../../services/api/commercial.api';

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
