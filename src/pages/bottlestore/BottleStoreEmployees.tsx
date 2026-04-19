import { HiOutlineBeaker } from 'react-icons/hi2';
import { ModuleHRPage } from '../../components/employees/ModuleHRPage';

export default function BottleStoreEmployees() {
    return (
        <ModuleHRPage
            config={{
                department: 'Bottle Store',
                moduleName: 'Bottle Store',
                accentColor: 'orange',
                icon: <HiOutlineBeaker />,
                showCommissions: true,
                documentTypes: [
                    { id: 'bi', label: 'Bilhete de Identidade', required: true },
                    { id: 'nuit', label: 'NUIT', required: true },
                    { id: 'inss', label: 'Cartão INSS', required: true },
                    { id: 'contract', label: 'Contrato de Trabalho', required: true },
                    { id: 'health', label: 'Certificado de Saúde' },
                    { id: 'alcohol_license', label: 'Habilitação para Venda de Bebidas Alcoólicas', required: true },
                ],
            }}
        />
    );
}
