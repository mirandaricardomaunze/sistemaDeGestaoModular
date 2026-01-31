import { Link } from 'react-router-dom';
import {
    HiOutlineArrowNarrowRight,
    HiOutlineLightBulb,
    HiOutlineExclamationCircle,
    HiOutlineCheckCircle,
    HiOutlineInformationCircle
} from 'react-icons/hi';
import { Card, Badge, Button } from '../ui';
import { cn } from '../../utils/helpers';
import type { SmartInsight } from '../../hooks/useSmartInsights';

interface SmartInsightCardProps {
    insight: SmartInsight;
    className?: string;
}

export function SmartInsightCard({ insight, className }: SmartInsightCardProps) {
    const icons = {
        warning: <HiOutlineExclamationCircle className="w-5 h-5 text-red-500" />,
        info: <HiOutlineInformationCircle className="w-5 h-5 text-blue-500" />,
        success: <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />,
        opportunity: <HiOutlineLightBulb className="w-5 h-5 text-amber-500" />,
    };

    const variantStyles = {
        warning: 'border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-900/10',
        info: 'border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-900/10',
        success: 'border-l-4 border-l-green-500 bg-green-50/30 dark:bg-green-900/10',
        opportunity: 'border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-900/10',
    };

    const moduleLabels = {
        commercial: '🛍️ Comercial',
        hospitality: '🏨 Hotelaria',
        pharmacy: '💊 Farmácia',
        logistics: '🚚 Logística',
        hr: '👥 RH',
        financial: '💰 Financeiro',
    };

    return (
        <Card padding="md" className={cn(variantStyles[insight.type], 'relative group overflow-hidden', className)}>
            <div className="flex items-start gap-4">
                <div className="mt-1">
                    {icons[insight.type]}
                </div>
                <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                            {moduleLabels[insight.module]}
                        </span>
                        {insight.priority >= 9 && (
                            <Badge variant="danger" size="sm">Urgente</Badge>
                        )}
                    </div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                        {insight.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {insight.description}
                    </p>

                    {insight.actionText && insight.actionPath && (
                        <div className="mt-4">
                            <Link to={insight.actionPath}>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs group-hover:bg-white dark:group-hover:bg-dark-800 transition-all font-bold"
                                    rightIcon={<HiOutlineArrowNarrowRight className="w-4 h-4" />}
                                >
                                    {insight.actionText}
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}
