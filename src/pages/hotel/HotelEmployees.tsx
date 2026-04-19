import { HiOutlineHomeModern } from 'react-icons/hi2';
import { ModuleHRPage } from '../../components/employees/ModuleHRPage';

export default function HotelEmployees() {
    return (
        <ModuleHRPage
            config={{
                department: 'Hospitalidade',
                moduleName: 'Hospitalidade',
                accentColor: 'blue',
                icon: <HiOutlineHomeModern />,
                showCommissions: false,
                documentTypes: [
                    { id: 'bi', label: 'Bilhete de Identidade', required: true },
                    { id: 'nuit', label: 'NUIT', required: true },
                    { id: 'inss', label: 'Cartão INSS', required: true },
                    { id: 'contract', label: 'Contrato de Trabalho', required: true },
                    { id: 'health', label: 'Certificado de Saúde', required: true },
                    { id: 'hygiene', label: 'Certificado de Higiene e Manipulação' },
                    { id: 'training', label: 'Certificado de Formação Hoteleira' },
                ],
            }}
        />
    );
}
