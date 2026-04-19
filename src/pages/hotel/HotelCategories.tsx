import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui';
import Categories from '../categories';
import { HiOutlineTag } from 'react-icons/hi2';

export default function HotelCategories() {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('nav.categories')}
                subtitle="Categorias de produtos e serviços de hotelaria"
                icon={<HiOutlineTag />}
            />
            <Categories hideHeader={true} />
        </div>
    );
}
