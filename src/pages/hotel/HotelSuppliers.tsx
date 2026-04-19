import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui';
import Suppliers from '../suppliers';
import { HiOutlineTruck } from 'react-icons/hi2';

export default function HotelSuppliers() {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('nav.suppliers')}
                subtitle="Fornecedores e parceiros da hotelaria"
                icon={<HiOutlineTruck />}
            />
            <Suppliers hideHeader={true} />
        </div>
    );
}
