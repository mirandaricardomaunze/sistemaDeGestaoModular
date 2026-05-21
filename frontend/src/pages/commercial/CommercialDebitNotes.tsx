import {
    HiOutlineArrowTrendingUp,
    HiOutlineBanknotes,
    HiOutlineDocumentText,
} from 'react-icons/hi2';
import { DebitNoteManager } from '../../components/invoices';
import { PageHeader } from '../../components/ui';
import { MetricCard } from '../../components/common/ModuleMetricCard';
import { useInvoices } from '../../hooks/useData';
import { formatCurrency } from '../../utils/helpers';

interface CommercialDebitNotesProps {
    hideHeader?: boolean;
}

export default function CommercialDebitNotes({ hideHeader }: CommercialDebitNotesProps) {
    const { invoices, summary, isLoading } = useInvoices({
        originModule: 'commercial',
        limit: 100,
        status: undefined,
    });

    // ND aplica-se a faturas ainda activas (não canceladas, não rascunho).
    const chargeableInvoices = invoices.filter((invoice) =>
        ['sent', 'partial', 'paid', 'overdue'].includes(invoice.status),
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {!hideHeader && (
                <PageHeader
                    title="Notas de Débito"
                    subtitle="Cobrança de juros, multas e correcções de valor sobre faturas emitidas"
                    icon={<HiOutlineArrowTrendingUp className="text-amber-600 dark:text-amber-400" />}
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    label="Faturas elegíveis"
                    value={chargeableInvoices.length}
                    icon={<HiOutlineDocumentText className="w-6 h-6" />}
                    color="blue"
                    isLoading={isLoading}
                />
                <MetricCard
                    label="Valor faturado"
                    value={formatCurrency(
                        summary?.total ||
                            invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
                    )}
                    icon={<HiOutlineBanknotes className="w-6 h-6" />}
                    color="emerald"
                    isLoading={isLoading}
                />
                <MetricCard
                    label="Saldo em aberto"
                    value={formatCurrency(
                        summary?.pending ||
                            invoices.reduce((sum, invoice) => sum + Number(invoice.amountDue || 0), 0),
                    )}
                    icon={<HiOutlineArrowTrendingUp className="w-6 h-6" />}
                    color="amber"
                    isLoading={isLoading}
                />
            </div>

            <DebitNoteManager invoices={chargeableInvoices} />
        </div>
    );
}
