import { useState, useEffect } from 'react';
import { Card, Button, Input, Select } from '../../components/ui';
import { settingsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { HiOutlinePrinter, HiOutlineOfficeBuilding, HiOutlineSave } from 'react-icons/hi';

export default function CommercialSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await settingsAPI.getCompany();
            setSettings(data);
        } catch (error) {
            toast.error('Erro ao carregar configurações');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await settingsAPI.updateCompany(settings);
            toast.success('Configurações salvas com sucesso');
        } catch (error) {
            toast.error('Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field: string, value: any) => {
        setSettings((prev: any) => ({ ...prev, [field]: value }));
    };

    if (loading) return <div className="p-8 text-center animate-pulse">Carregando configurações...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                        Configurações do Módulo
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Personalize o comportamento do sistema e os documentos impressos
                    </p>
                </div>
                <Button 
                    type="submit" 
                    form="settings-form" 
                    isLoading={saving}
                    className="flex items-center gap-2"
                >
                    <HiOutlineSave className="w-4 h-4" />
                    Salvar Alterações
                </Button>
            </div>

            <form id="settings-form" onSubmit={handleSave} className="space-y-6">
                {/* Company Identity */}
                <Card padding="lg">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-dark-700 pb-2">
                        <HiOutlineOfficeBuilding className="text-primary-500 w-5 h-5" />
                        <h2 className="font-bold text-gray-900 dark:text-white">Identidade da Empresa</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Nome da Empresa"
                            value={settings?.companyName || ''}
                            onChange={(e) => handleChange('companyName', e.target.value)}
                        />
                        <Input
                            label="Nome Comercial"
                            value={settings?.tradeName || ''}
                            onChange={(e) => handleChange('tradeName', e.target.value)}
                        />
                        <Input
                            label="NUIT"
                            value={settings?.nuit || ''}
                            onChange={(e) => handleChange('nuit', e.target.value)}
                        />
                        <Input
                            label="Telefone"
                            value={settings?.phone || ''}
                            onChange={(e) => handleChange('phone', e.target.value)}
                        />
                        <div className="md:col-span-2">
                            <Input
                                label="Endereço Completo"
                                value={settings?.address || ''}
                                onChange={(e) => handleChange('address', e.target.value)}
                            />
                        </div>
                    </div>
                </Card>

                {/* Print & Receipt Settings */}
                <Card padding="lg">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-dark-700 pb-2">
                        <HiOutlinePrinter className="text-primary-500 w-5 h-5" />
                        <h2 className="font-bold text-gray-900 dark:text-white">Customização de Talões (Impressão Térmica)</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select
                                label="Largura do Papel"
                                value={settings?.thermalPaperWidth || '80mm'}
                                onChange={(e) => handleChange('thermalPaperWidth', e.target.value)}
                                options={[
                                    { value: '80mm', label: '80mm (Padrão)' },
                                    { value: '58mm', label: '58mm (Compacto)' }
                                ]}
                            />
                            <div className="flex flex-col justify-end pb-1 text-xs text-gray-500">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={settings?.autoPrintReceipt || false}
                                        onChange={(e) => handleChange('autoPrintReceipt', e.target.checked)}
                                        className="rounded border-gray-300 text-primary-600 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50"
                                    />
                                    Imprimir recibo automaticamente após venda
                                </label>
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="space-y-1">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                    Cabeçalho do Recibo
                                </label>
                                <p className="text-[10px] text-gray-400 mb-1">Aparece logo abaixo do logótipo ou nome da empresa.</p>
                                <textarea
                                    className="w-full rounded-lg border-gray-300 dark:border-dark-700 dark:bg-dark-800 focus:border-primary-500 focus:ring-primary-500 text-sm p-3 min-h-[80px]"
                                    placeholder="Ex: Bem-vindos à SmartS! Preços baixos sempre."
                                    value={settings?.receiptHeader || ''}
                                    onChange={(e) => handleChange('receiptHeader', e.target.value)}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                    Rodapé do Recibo
                                </label>
                                <p className="text-[10px] text-gray-400 mb-1">Aparece no fundo do recibo, ideal para políticas de devolução ou agradecimentos.</p>
                                <textarea
                                    className="w-full rounded-lg border-gray-300 dark:border-dark-700 dark:bg-dark-800 focus:border-primary-500 focus:ring-primary-500 text-sm p-3 min-h-[80px]"
                                    placeholder="Ex: Obrigado pela sua visita. Volte sempre! Mercadoria vendida não se aceita devolução."
                                    value={settings?.receiptFooter || ''}
                                    onChange={(e) => handleChange('receiptFooter', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </Card>
            </form>
        </div>
    );
}
