import { HiOutlineFire } from 'react-icons/hi2';
import { ModuleHRPage } from '../../components/employees/ModuleHRPage';

export default function RestaurantEmployees() {
    return (
        <ModuleHRPage
            config={{
                department: 'Restaurante',
                moduleName: 'Restaurante',
                accentColor: 'rose',
                icon: <HiOutlineFire />,
                showCommissions: false,
                documentTypes: [
                    { id: 'bi', label: 'Bilhete de Identidade', required: true },
                    { id: 'nuit', label: 'NUIT', required: true },
                    { id: 'inss', label: 'Cartão INSS', required: true },
                    { id: 'contract', label: 'Contrato de Trabalho', required: true },
                    { id: 'health', label: 'Certificado de Saúde Alimentar', required: true },
                    { id: 'hygiene', label: 'Certificado de Higiene e Manipulação de Alimentos', required: true },
                    { id: 'food_safety', label: 'Formação em Segurança Alimentar' },
                ],
            }}
        />
    );
}
