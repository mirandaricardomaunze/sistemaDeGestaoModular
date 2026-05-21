import { HiOutlineArrowPathRoundedSquare, HiOutlineBanknotes, HiOutlineDocumentText } from 'react-icons/hi2';
import { CreditNoteManager } from '../../components/invoices';
import { PageHeader } from '../../components/ui';
import { MetricCard } from '../../components/common/ModuleMetricCard';
import { useInvoices } from '../../hooks/useData';
import { formatCurrency } from '../../utils/helpers';

interface CommercialReturnsProps {
    hideHeader?: boolean;
}

export default function CommercialReturns({ hideHeader }: CommercialReturnsProps) {
    const { invoices, summary, isLoading } = useInvoices({
        originModule: 'commercial',
        limit: 100,
        status: undefined,
    });

    const refundableInvoices = invoices.filter(invoice =>
        ['sent', 'partial', 'paid', 'overdue'].includes(invoice.status)
    );

    return (
        <div className="space-y-6 animate-fade-in">
            {!hideHeader && (
                <PageHeader
                    title="Devolucoes Comerciais"
                    subtitle="Emissao de notas de credito, reposicao de stock e acerto de saldos de clientes"
                    icon={<HiOutlineArrowPathRoundedSquare className="text-primary-600 dark:text-primary-400" />}
                />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                    label="Faturas elegiveis"
                    value={refundableInvoices.length}
                    icon={<HiOutlineDocumentText className="w-6 h-6" />}
                    color="blue"
                    isLoading={isLoading}
                />
                <MetricCard
                    label="Valor faturado"
                    value={formatCurrency(summary?.total || invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0))}
                    icon={<HiOutlineBanknotes className="w-6 h-6" />}
                    color="emerald"
                    isLoading={isLoading}
                />
                <MetricCard
                    label="Saldo em aberto"
                    value={formatCurrency(summary?.pending || invoices.reduce((sum, invoice) => sum + Number(invoice.amountDue || 0), 0))}
                    icon={<HiOutlineArrowPathRoundedSquare className="w-6 h-6" />}
                    color="amber"
                    isLoading={isLoading}
                />
            </div>

            <CreditNoteManager invoices={refundableInvoices} />
        </div>
    );
}
