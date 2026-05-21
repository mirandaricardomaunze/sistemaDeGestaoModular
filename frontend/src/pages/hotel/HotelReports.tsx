import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/ui';
import HospitalityReports from '../../components/hospitality/HospitalityReports';
import { HiOutlineChartBar } from 'react-icons/hi2';

export default function HotelReports() {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <PageHeader
                title={t('nav.reports')}
                subtitle={t('hotel_module.dashboard.insights')}
                icon={<HiOutlineChartBar />}
            />
            <HospitalityReports />
        </div>
    );
}
