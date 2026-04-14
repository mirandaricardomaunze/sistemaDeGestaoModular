import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui';
import { HousekeepingPanel } from '../../components/hospitality';
import { HiOutlineSparkles } from 'react-icons/hi2';

export default function HotelHousekeeping() {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('hotel_module.housekeeping.title')}
                subtitle={t('hotel_module.housekeeping.inspect')}
                icon={<HiOutlineSparkles />}
            />

            <HousekeepingPanel />
        </div>
    );
}
