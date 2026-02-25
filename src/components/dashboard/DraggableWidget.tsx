import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { HiOutlineMenu } from 'react-icons/hi';

interface DraggableWidgetProps {
    id: string;
    children: React.ReactNode;
}

export function DraggableWidget({ id, children }: DraggableWidgetProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="relative group">
            <div
                {...attributes}
                {...listeners}
                className="absolute top-2 right-2 p-1 bg-white/50 dark:bg-dark-800/50 rounded-md cursor-move opacity-0 group-hover:opacity-100 transition-opacity z-20"
            >
                <HiOutlineMenu className="w-4 h-4 text-gray-500" />
            </div>
            {children}
        </div>
    );
}
