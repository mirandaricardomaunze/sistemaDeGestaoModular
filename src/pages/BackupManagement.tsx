import { useState, useEffect } from 'react';
import {
    HiOutlineDownload,
    HiOutlineRefresh,
    HiOutlineTrash,
    HiOutlineDatabase,
    HiOutlineClock,
    HiOutlineCheckCircle,
} from 'react-icons/hi';
import { Card, Button, Modal, Pagination, usePagination } from '../components/ui';
import toast from 'react-hot-toast';
import { backupsAPI, gdriveAPI } from '../services/api';
import { HiOutlineCloudUpload as HiOutlineCloud } from 'react-icons/hi';
import { HiOutlineCloudUpload } from 'react-icons/hi';

interface Backup {
    filename: string;
    size: string;
    date: Date;
}

interface BackupStats {
    totalBackups: number;
    totalSize: string;
    databaseSize?: string;
    oldestBackup?: Date;
    newestBackup?: Date;
}

export default function BackupManagement() {
    const [backups, setBackups] = useState<Backup[]>([]);
    const [stats, setStats] = useState<BackupStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreatingBackup, setIsCreatingBackup] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [backupToDelete, setBackupToDelete] = useState<string | null>(null);
    const [restoreModalOpen, setRestoreModalOpen] = useState(false);
    const [backupToRestore, setBackupToRestore] = useState<string | null>(null);
    const [gdriveStatus, setGdriveStatus] = useState<{ configured: boolean; enabled: boolean } | null>(null);
    const [isUploadingToDrive, setIsUploadingToDrive] = useState<string | null>(null);

    // Pagination
    const {
        currentPage,
        setCurrentPage,
        itemsPerPage,
        setItemsPerPage,
        paginatedItems: paginatedBackups,
        totalItems,
    } = usePagination(backups, 10);

    useEffect(() => {
        loadBackups();
        loadStats();
        loadGDriveStatus();
    }, []);

    const loadGDriveStatus = async () => {
        try {
            const status = await gdriveAPI.getStatus();
            setGdriveStatus(status);
        } catch (error) {
            console.error('Erro ao carregar status do Google Drive:', error);
        }
    };

    const loadBackups = async () => {
        setIsLoading(true);
        try {
            const response = await backupsAPI.getList();
            setBackups(response.backups);
        } catch (error) {
            console.error('Erro ao carregar backups:', error);
            toast.error('Erro ao carregar lista de backups');
        } finally {
            setIsLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await backupsAPI.getStats();
            setStats(response.stats);
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        }
    };

    const handleCreateBackup = async () => {
        setIsCreatingBackup(true);
        try {
            const response = await backupsAPI.create();
            if (response.success) {
                toast.success(`Backup criado com sucesso! (${response.size})`);
                await loadBackups();
                await loadStats();
            }
        } catch (error) {
            console.error('Erro ao criar backup:', error);
            toast.error('Erro ao criar backup');
        } finally {
            setIsCreatingBackup(false);
        }
    };

    const handleDownload = async (filename: string) => {
        try {
            const blob = await backupsAPI.download(filename);

            // Criar link de download
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Download iniciado!');
        } catch (error) {
            console.error('Erro ao fazer download:', error);
            toast.error('Erro ao fazer download do backup');
        }
    };

    const confirmDelete = (filename: string) => {
        setBackupToDelete(filename);
        setDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!backupToDelete) return;

        try {
            const response = await backupsAPI.delete(backupToDelete);
            if (response.success) {
                toast.success('Backup deletado com sucesso!');
                await loadBackups();
                await loadStats();
                setDeleteModalOpen(false);
                setBackupToDelete(null);
            }
        } catch (error) {
            console.error('Erro ao deletar backup:', error);
            toast.error('Erro ao deletar backup');
        }
    };

    const confirmRestore = (filename: string) => {
        setBackupToRestore(filename);
        setRestoreModalOpen(true);
    };

    const handleRestore = async () => {
        if (!backupToRestore) return;

        try {
            const response = await backupsAPI.restore(backupToRestore);
            if (response.success) {
                toast.success('Backup restaurado com sucesso! Recarregue a página.');
                setRestoreModalOpen(false);
                setBackupToRestore(null);
            }
        } catch (error) {
            console.error('Erro ao restaurar backup:', error);
            toast.error('Erro ao restaurar backup');
        }
    };

    const handleGDriveAuth = async () => {
        try {
            const response = await gdriveAPI.getAuthUrl();
            if (response.authUrl) {
                window.location.href = response.authUrl;
            }
        } catch (error) {
            console.error('Erro ao obter URL de autenticação:', error);
            toast.error('Erro ao iniciar autenticação com Google Drive');
        }
    };

    const handleGDriveUpload = async (filename: string) => {
        setIsUploadingToDrive(filename);
        try {
            const response = await gdriveAPI.upload(filename);
            if (response.success) {
                toast.success('Backup enviado para o Google Drive!');
            }
        } catch (error: any) {
            console.error('Erro ao fazer upload para Drive:', error);
            toast.error(error.response?.data?.error || 'Erro ao enviar para o Google Drive');
        } finally {
            setIsUploadingToDrive(null);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Gerenciamento de Backups
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400">
                        Crie, restaure e gerencie backups do banco de dados
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={loadBackups} disabled={isLoading}>
                        <HiOutlineRefresh className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                    <Button onClick={handleCreateBackup} disabled={isCreatingBackup}>
                        <HiOutlineDatabase className="w-5 h-5 mr-2" />
                        {isCreatingBackup ? 'Criando...' : 'Criar Backup'}
                    </Button>
                </div>
            </div>

            {/* Google Drive Status Alert */}
            {gdriveStatus && !gdriveStatus.configured && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-blue-700 dark:text-blue-300">
                        <HiOutlineCloud className="w-6 h-6 flex-shrink-0" />
                        <div>
                            <p className="font-semibold text-sm">Google Drive não conectado</p>
                            <p className="text-xs opacity-80 text-left">
                                Conecte sua conta do Google para ter backups automáticos na nuvem e mais segurança para os seus dados.
                            </p>
                        </div>
                    </div>
                    <Button size="sm" onClick={handleGDriveAuth}>
                        Conectar Google Drive
                    </Button>
                </div>
            )}

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <Card padding="md" className="border-l-4 border-l-primary-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total de Backups</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {stats.totalBackups}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                <HiOutlineDatabase className="w-6 h-6 text-primary-600" />
                            </div>
                        </div>
                    </Card>

                    <Card padding="md" className="border-l-4 border-l-blue-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Espaço Total</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {stats.totalSize}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <HiOutlineDownload className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </Card>

                    <Card padding="md" className="border-l-4 border-l-green-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Último Backup</p>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {stats.newestBackup ? formatDate(stats.newestBackup) : 'N/A'}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <HiOutlineCheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                    </Card>

                    <Card padding="md" className="border-l-4 border-l-orange-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Backup Agendado</p>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Diariamente 2h
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <HiOutlineClock className="w-6 h-6 text-orange-600" />
                            </div>
                        </div>
                    </Card>
                    <Card padding="md" className="border-l-4 border-l-purple-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Tamanho do Banco</p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {stats.databaseSize || 'N/A'}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <HiOutlineDatabase className="w-6 h-6 text-purple-600" />
                            </div>
                        </div>
                    </Card>

                    <Card padding="md" className={`border-l-4 ${gdriveStatus?.configured ? 'border-l-green-500' : 'border-l-gray-300'}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Google Drive</p>
                                <p className={`text-sm font-semibold ${gdriveStatus?.configured ? 'text-green-600' : 'text-gray-400'}`}>
                                    {gdriveStatus?.configured ? 'Conectado' : 'Não configurado'}
                                </p>
                            </div>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${gdriveStatus?.configured ? 'bg-green-100 dark:bg-green-900/30 shadow-sm' : 'bg-gray-100 dark:bg-dark-800'}`}>
                                <HiOutlineCloud className={`w-6 h-6 ${gdriveStatus?.configured ? 'text-green-600' : 'text-gray-400'}`} />
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Backups Table */}
            <Card padding="none">
                <div className="overflow-auto max-h-[600px] scrollbar-hide">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-700">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-gray-50 dark:bg-dark-800">
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                    Nome do Arquivo
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                    Data/Hora
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                    Tamanho
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        Carregando...
                                    </td>
                                </tr>
                            ) : backups.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        Nenhum backup encontrado
                                    </td>
                                </tr>
                            ) : (
                                paginatedBackups.map((backup) => (
                                    <tr
                                        key={backup.filename}
                                        className="bg-white dark:bg-dark-900 hover:bg-gray-50 dark:hover:bg-dark-800"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <HiOutlineDatabase className="w-5 h-5 text-gray-400 mr-3" />
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {backup.filename}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(backup.date)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {backup.size}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                {gdriveStatus?.configured && (
                                                    <button
                                                        onClick={() => handleGDriveUpload(backup.filename)}
                                                        disabled={isUploadingToDrive === backup.filename}
                                                        className={`p-2 rounded-lg transition-colors ${isUploadingToDrive === backup.filename
                                                                ? 'text-gray-400 cursor-not-allowed'
                                                                : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600'
                                                            }`}
                                                        title="Enviar para nuvem"
                                                    >
                                                        <HiOutlineCloudUpload className={`w-5 h-5 ${isUploadingToDrive === backup.filename ? 'animate-bounce' : ''}`} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDownload(backup.filename)}
                                                    className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 transition-colors"
                                                    title="Download"
                                                >
                                                    <HiOutlineDownload className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => confirmRestore(backup.filename)}
                                                    className="p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 transition-colors"
                                                    title="Restaurar"
                                                >
                                                    <HiOutlineRefresh className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete(backup.filename)}
                                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 transition-colors"
                                                    title="Deletar"
                                                >
                                                    <HiOutlineTrash className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                {backups.length > 0 && (
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-dark-700">
                        <Pagination
                            currentPage={currentPage}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setItemsPerPage}
                            itemsPerPageOptions={[5, 10, 20, 50]}
                        />
                    </div>
                )}
            </Card>

            {/* Delete Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Confirmar Exclusão"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">
                        Tem certeza que deseja deletar o backup <strong>{backupToDelete}</strong>?
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">
                        Esta ação não pode ser desfeita.
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="danger" onClick={handleDelete}>
                            Deletar
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Restore Modal */}
            <Modal
                isOpen={restoreModalOpen}
                onClose={() => setRestoreModalOpen(false)}
                title="Confirmar Restauração"
            >
                <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">
                        Tem certeza que deseja restaurar o backup <strong>{backupToRestore}</strong>?
                    </p>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold">
                            ⚠️ ATENÇÃO
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            Esta operação vai SUBSTITUIR TODOS os dados atuais do banco de dados!
                            Certifique-se de ter um backup recente antes de continuar.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setRestoreModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button variant="danger" onClick={handleRestore}>
                            Restaurar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
