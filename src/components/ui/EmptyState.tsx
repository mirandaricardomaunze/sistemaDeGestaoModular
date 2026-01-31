import type { ReactNode } from 'react';
import { cn } from '../../utils/helpers';
import { Button } from './Button';

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: ReactNode;
    };
    className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
            {icon && (
                <div className="mb-4 text-gray-400 dark:text-gray-500">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {title}
            </h3>
            {description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-6">
                    {description}
                </p>
            )}
            {action && (
                <Button onClick={action.onClick} leftIcon={action.icon}>
                    {action.label}
                </Button>
            )}
        </div>
    );
}

// Empty states pré-configurados
interface PresetEmptyStateProps {
    onAction?: () => void;
    actionLabel?: string;
    className?: string;
}

export function NoDataFound({ onAction, actionLabel = 'Tentar Novamente', className }: PresetEmptyStateProps) {
    return (
        <EmptyState
            icon={
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            }
            title="Nenhum dado encontrado"
            description="Não há informações para exibir no momento."
            action={onAction ? { label: actionLabel, onClick: onAction } : undefined}
            className={className}
        />
    );
}

export function NoResultsFound({ onAction, actionLabel = 'Limpar Filtros', className }: PresetEmptyStateProps) {
    return (
        <EmptyState
            icon={
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            }
            title="Nenhum resultado encontrado"
            description="Tente ajustar seus filtros ou termos de busca."
            action={onAction ? { label: actionLabel, onClick: onAction } : undefined}
            className={className}
        />
    );
}

export function ErrorState({ onAction, actionLabel = 'Tentar Novamente', className }: PresetEmptyStateProps) {
    return (
        <EmptyState
            icon={
                <svg className="w-16 h-16 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            }
            title="Algo deu errado"
            description="Ocorreu um erro ao carregar os dados. Por favor, tente novamente."
            action={onAction ? { label: actionLabel, onClick: onAction } : undefined}
            className={className}
        />
    );
}

export function ComingSoon({ className }: { className?: string }) {
    return (
        <EmptyState
            icon={
                <svg className="w-16 h-16 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            }
            title="Em breve"
            description="Esta funcionalidade estará disponível em breve. Fique atento!"
            className={className}
        />
    );
}

interface NoItemsProps extends PresetEmptyStateProps {
    itemName: string;
}

export function NoItems({ itemName, onAction, actionLabel, className }: NoItemsProps) {
    return (
        <EmptyState
            icon={
                <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
            }
            title={`Nenhum ${itemName} cadastrado`}
            description={`Comece adicionando seu primeiro ${itemName}.`}
            action={onAction ? {
                label: actionLabel || `Adicionar ${itemName}`,
                onClick: onAction,
                icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                )
            } : undefined}
            className={className}
        />
    );
}
