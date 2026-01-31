/**
 * Audit Page
 * Página principal de auditoria do sistema
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    HiOutlineDocumentText,
    HiOutlineCog,
    HiOutlineShieldCheck,
} from 'react-icons/hi';
import AuditLogViewer from '../components/audit/AuditLogViewer';
import { useAuditStore } from '../stores/useAuditStore';
import { Button, Card, Input, Select } from '../components/ui';
import { MODULE_LABELS, ACTION_LABELS, type AuditModule, type AuditAction, type AuditSeverity } from '../types/audit';
import toast from 'react-hot-toast';

type AuditTab = 'logs' | 'config';

export default function Audit() {
    const { config, updateConfig } = useAuditStore();
    const [activeTab, setActiveTab] = useState<AuditTab>('logs');
    const { t } = useTranslation();

    // Config form state
    const [configForm, setConfigForm] = useState(config);

    const handleSaveConfig = () => {
        updateConfig(configForm);
        toast.success('Configuração de auditoria guardada!');
    };

    const tabs = [
        { id: 'logs' as const, label: 'Logs de Auditoria', icon: HiOutlineDocumentText },
        { id: 'config' as const, label: 'Configuração', icon: HiOutlineCog },
    ];

    const severityOptions = [
        { value: 'info', label: 'Informação (todos)' },
        { value: 'warning', label: 'Aviso (aviso+)' },
        { value: 'error', label: 'Erro (erro+)' },
        { value: 'critical', label: 'Crítico (apenas crítico)' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineShieldCheck className="w-7 h-7 text-primary-500" />
                        {t('audit.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {t('audit.description')}
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 dark:border-dark-700">
                <nav className="flex gap-1 overflow-x-auto pb-px">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${isActive
                                    ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/10 rounded-t-lg'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-800 rounded-t-lg'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px]">
                {activeTab === 'logs' ? (
                    <AuditLogViewer />
                ) : (
                    <div className="max-w-2xl space-y-6">
                        <Card padding="md">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Configuração de Auditoria
                            </h3>

                            <div className="space-y-4">
                                {/* Enable/Disable */}
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-800 rounded-lg">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            Auditoria Ativa
                                        </p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Ativar ou desativar o registo de ações
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={configForm.enabled}
                                            onChange={(e) => setConfigForm({ ...configForm, enabled: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                                    </label>
                                </div>

                                {/* Retention Period */}
                                <Input
                                    label="Período de Retenção (dias)"
                                    type="number"
                                    min={7}
                                    max={365}
                                    value={configForm.retentionDays}
                                    onChange={(e) => setConfigForm({ ...configForm, retentionDays: Number(e.target.value) })}
                                    helperText="Logs mais antigos serão automaticamente eliminados"
                                />

                                {/* Minimum Severity */}
                                <Select
                                    label="Nível Mínimo de Severidade"
                                    options={severityOptions}
                                    value={configForm.logLevel}
                                    onChange={(e) => setConfigForm({ ...configForm, logLevel: e.target.value as AuditSeverity })}
                                />

                                {/* Exclude Modules */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Módulos a Excluir
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(MODULE_LABELS).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => {
                                                    const excluded = configForm.excludeModules;
                                                    const newExcluded = excluded.includes(value as AuditModule)
                                                        ? excluded.filter((m) => m !== value)
                                                        : [...excluded, value as AuditModule];
                                                    setConfigForm({ ...configForm, excludeModules: newExcluded });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${configForm.excludeModules.includes(value as AuditModule)
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Clique para excluir/incluir módulos do registo
                                    </p>
                                </div>

                                {/* Exclude Actions */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Ações a Excluir
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(ACTION_LABELS).map(([value, label]) => (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => {
                                                    const excluded = configForm.excludeActions;
                                                    const newExcluded = excluded.includes(value as AuditAction)
                                                        ? excluded.filter((a) => a !== value)
                                                        : [...excluded, value as AuditAction];
                                                    setConfigForm({ ...configForm, excludeActions: newExcluded });
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${configForm.excludeActions.includes(value as AuditAction)
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-400'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Clique para excluir/incluir ações do registo
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-dark-700">
                                <Button onClick={handleSaveConfig}>
                                    Guardar Configuração
                                </Button>
                            </div>
                        </Card>

                        {/* Info Card */}
                        <Card padding="md" className="bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800">
                            <div className="flex items-start gap-3">
                                <HiOutlineShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                                        Sobre Logs de Auditoria
                                    </h4>
                                    <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                                        <li>• Os logs são registados automaticamente para ações importantes</li>
                                        <li>• Logins, alterações de dados e exportações são sempre registados</li>
                                        <li>• Utilize os filtros para encontrar eventos específicos</li>
                                        <li>• Exporte relatórios para análise externa ou conformidade</li>
                                    </ul>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
