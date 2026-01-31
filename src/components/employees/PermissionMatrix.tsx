import { useState, useEffect } from 'react';
import { HiOutlineShieldCheck, HiOutlineLockClosed, HiOutlineSave } from 'react-icons/hi';
import { Card, Button, LoadingSpinner } from '../ui';
import { modulesAPI, type BusinessModule } from '../../services/api/admin.api';
import { cn } from '../../utils/helpers';

export default function PermissionMatrix() {
    const [modules, setModules] = useState<BusinessModule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Mock roles - In a real system these would come from the API
    const roles = [
        { id: 'admin', name: 'Administrador' },
        { id: 'manager', name: 'Gerente' },
        { id: 'operator', name: 'Operador' },
        { id: 'receptionist', name: 'Recepcionista' },
    ];

    // Initial permissions state
    const [permissions, setPermissions] = useState<Record<string, string[]>>({
        admin: ['COMERCIAL', 'HOTEL', 'PHARMACY', 'LOGISTICS', 'BOTTLE_STORE', 'FISCAL', 'CRM', 'HR'],
        manager: ['COMERCIAL', 'HOTEL', 'PHARMACY', 'LOGISTICS', 'CRM'],
        operator: ['COMERCIAL', 'PHARMACY'],
        receptionist: ['HOTEL'],
    });

    useEffect(() => {
        const fetchModules = async () => {
            try {
                const data = await modulesAPI.getAll();
                setModules(data);
            } catch (err) {
                console.error('Error fetching modules:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchModules();
    }, []);

    const togglePermission = (roleId: string, moduleCode: string) => {
        setPermissions(prev => {
            const rolePerms = prev[roleId] || [];
            if (rolePerms.includes(moduleCode)) {
                return { ...prev, [roleId]: rolePerms.filter(m => m !== moduleCode) };
            } else {
                return { ...prev, [roleId]: [...rolePerms, moduleCode] };
            }
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSaving(false);
        // In a real app, logic would call an API like rolesAPI.updatePermissions(permissions)
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <Card className="overflow-hidden">
            <div className="flex items-center justify-between mb-6 p-2">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineShieldCheck className="w-6 h-6 text-primary-600" />
                        Matriz de Permissões
                    </h3>
                    <p className="text-sm text-gray-500">Defina o nível de acesso para cada função do sistema</p>
                </div>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    isLoading={isSaving}
                    leftIcon={<HiOutlineSave className="w-5 h-5" />}
                >
                    Guardar Alterações
                </Button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-dark-800">
                            <th className="text-left p-4 border-b border-gray-200 dark:border-dark-700 min-w-[200px]">
                                Módulo / Funcionalidade
                            </th>
                            {roles.map(role => (
                                <th key={role.id} className="text-center p-4 border-b border-gray-200 dark:border-dark-700 min-w-[120px]">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{role.name}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {modules.map(module => (
                            <tr key={module.code} className="hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                                <td className="p-4 border-b border-gray-100 dark:border-dark-700">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-gray-900 dark:text-white uppercase text-sm">
                                            {module.name}
                                        </span>
                                        <span className="text-xs text-gray-500">{module.description}</span>
                                    </div>
                                </td>
                                {roles.map(role => {
                                    const hasAccess = permissions[role.id]?.includes(module.code);
                                    const isAdmin = role.id === 'admin';

                                    return (
                                        <td key={`${role.id}-${module.code}`} className="p-4 border-b border-gray-100 dark:border-dark-700 text-center">
                                            <button
                                                disabled={isAdmin}
                                                onClick={() => togglePermission(role.id, module.code)}
                                                className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all mx-auto",
                                                    hasAccess
                                                        ? "bg-green-100 text-green-600 border-2 border-green-200"
                                                        : "bg-gray-100 text-gray-300 border-2 border-transparent",
                                                    !isAdmin && "hover:border-primary-500 cursor-pointer",
                                                    isAdmin && "opacity-80 cursor-not-allowed"
                                                )}
                                            >
                                                {hasAccess ? (
                                                    <HiOutlineShieldCheck className="w-6 h-6" />
                                                ) : (
                                                    <HiOutlineLockClosed className="w-5 h-5" />
                                                )}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                <p className="text-sm text-blue-700 dark:text-blue-400 flex items-start gap-2">
                    <HiOutlineShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    As alterações feitas aqui afectam todos os utilizadores com a função correspondente. Utilizadores activos deverão fazer refresh para as novas permissões entrarem em vigor.
                </p>
            </div>
        </Card>
    );
}
