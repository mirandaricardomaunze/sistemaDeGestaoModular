import { useState, useMemo } from 'react';
import { Card, Button, Input, Modal, Badge } from '../../components/ui';
import { HiOutlinePlus, HiOutlineSearch, HiOutlinePencil, HiOutlineTrash, HiOutlineShieldCheck, HiOutlineMail, HiOutlinePhone, HiOutlineLocationMarker, HiOutlineDocumentText } from 'react-icons/hi';
import { cn } from '../../utils/helpers';
import { usePharmacyPartners, type Partner } from '../../hooks/usePharmacyPartners';

export default function PharmacyPartners() {
    const { partners, isLoading, addPartner, updatePartner, deletePartner } = usePharmacyPartners();

    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

    const filteredPartners = useMemo(() => {
        return partners.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    }, [partners, search]);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        const coverage = Number(formData.get('coverage'));

        const data = {
            name,
            category: formData.get('category') as string,
            coveragePercentage: coverage,
            email: formData.get('email') as string || null,
            phone: formData.get('phone') as string || null,
            address: formData.get('address') as string || null,
            nuit: formData.get('nuit') as string || null,
        };

        try {
            if (editingPartner) {
                await updatePartner(editingPartner.id, data);
            } else {
                await addPartner(data);
            }
            setIsModalOpen(false);
            setEditingPartner(null);
        } catch (error) {
            // Error is handled in the hook with toast
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white pb-3">Convénios e Seguradoras</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Gerir entidades parceiras e taxas de cobertura</p>
                </div>
                <Button onClick={() => setIsModalOpen(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>
                    Novo Parceiro
                </Button>
            </div>

            <Card className="p-4">
                <Input
                    placeholder="Pesquisar seguradora..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
                />
            </Card>

            {isLoading && partners.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="p-4 h-32 animate-pulse bg-gray-100 dark:bg-gray-800" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPartners.map(partner => (
                        <Card key={partner.id} className={cn("p-4 border-l-4 transition-all hover:shadow-md", partner.isActive ? "border-l-primary-500" : "border-l-gray-400")}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                        <HiOutlineShieldCheck className="w-6 h-6 text-primary-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white">{partner.name}</h3>
                                        <p className="text-xs text-gray-500">{partner.category}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => { setEditingPartner(partner); setIsModalOpen(true); }} className="p-1 hover:text-primary-600 transition-colors">
                                        <HiOutlinePencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => { if (confirm('Tem certeza que deseja remover este parceiro?')) deletePartner(partner.id); }} className="p-1 hover:text-red-600 transition-colors">
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 space-y-2">
                                {partner.phone && (
                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <HiOutlinePhone className="w-3 h-3" /> {partner.phone}
                                    </div>
                                )}
                                {partner.email && (
                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <HiOutlineMail className="w-3 h-3" /> {partner.email}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Cobertura:</span>
                                <Badge variant="success" className="text-lg px-3 py-1 font-bold">{partner.coveragePercentage}%</Badge>
                            </div>
                        </Card>
                    ))}
                    {filteredPartners.length === 0 && !isLoading && (
                        <div className="col-span-full py-12 text-center text-gray-500">
                            Nenhum parceiro encontrado.
                        </div>
                    )}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingPartner(null); }} title={editingPartner ? 'Editar Parceiro' : 'Novo Parceiro'} size="lg">
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Input label="Nome da Entidade" name="name" defaultValue={editingPartner?.name} required />
                        </div>
                        <Input label="Categoria" name="category" defaultValue={editingPartner?.category} placeholder="Ex: Seguro Privado" />
                        <Input label="Taxa de Cobertura (%)" name="coverage" type="number" defaultValue={editingPartner?.coveragePercentage} min="0" max="100" required />
                        <Input label="Telefone" name="phone" defaultValue={editingPartner?.phone} leftIcon={<HiOutlinePhone />} />
                        <Input label="Email" name="email" type="email" defaultValue={editingPartner?.email} leftIcon={<HiOutlineMail />} />
                        <Input label="NUIT" name="nuit" defaultValue={editingPartner?.nuit} leftIcon={<HiOutlineDocumentText />} />
                        <Input label="Endereço" name="address" defaultValue={editingPartner?.address} leftIcon={<HiOutlineLocationMarker />} />
                    </div>
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                        <Button variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" isLoading={isLoading}>Salvar Alterações</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
