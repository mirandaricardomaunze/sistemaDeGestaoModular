import { useRef, type ReactNode, type CSSProperties } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '../../utils/helpers';

interface VirtualListProps<T> {
    items: T[];
    estimateSize: number;
    overscan?: number;
    height?: number | string;
    className?: string;
    renderItem: (item: T, index: number, style: CSSProperties) => ReactNode;
    getKey?: (item: T, index: number) => string | number;
    onEndReached?: () => void;
    endReachedThreshold?: number;
}

/**
 * Windowed list — only renders visible rows. Use for any list that may exceed
 * ~100 rows (sales history, audit log, etc.). The `onEndReached` hook makes it
 * trivial to plug into React Query's `fetchNextPage` for infinite scrolling.
 */
export function VirtualList<T>({
    items,
    estimateSize,
    overscan = 8,
    height = 600,
    className,
    renderItem,
    getKey,
    onEndReached,
    endReachedThreshold = 4,
}: VirtualListProps<T>) {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => estimateSize,
        overscan,
    });

    const virtualItems = virtualizer.getVirtualItems();
    const last = virtualItems[virtualItems.length - 1];
    if (onEndReached && last && last.index >= items.length - endReachedThreshold) {
        // Defer to break the render cycle
        queueMicrotask(onEndReached);
    }

    return (
        <div
            ref={parentRef}
            className={cn('overflow-auto', className)}
            style={{ height }}
        >
            <div
                style={{
                    height: virtualizer.getTotalSize(),
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualItems.map((vRow) => {
                    const item = items[vRow.index];
                    return (
                        <div
                            key={getKey ? getKey(item, vRow.index) : vRow.key}
                            data-index={vRow.index}
                            ref={virtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${vRow.start}px)`,
                            }}
                        >
                            {renderItem(item, vRow.index, { width: '100%' })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
