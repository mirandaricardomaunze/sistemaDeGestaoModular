import { useState, useMemo } from 'react';
import {
    HiOutlinePlus, HiOutlineMagnifyingGlass, HiOutlinePencil, HiOutlineTrash,
    HiOutlineChevronRight, HiOutlineFunnel, HiOutlineCamera
} from 'react-icons/hi2';
import { Card, Button, Input, Modal, Badge, LoadingSpinner, Select, Textarea } from '../../components/ui';
import { 
    useRestaurantMenu, useCreateMenuItem, useUpdateMenuItem, 
    useDeleteMenuItem, useToggleMenuItemAvailability 
} from '../../hooks/useRestaurant';
import type { RestaurantMenuItem } from '../../services/api/restaurant.api';
import { cn, formatCurrency } from '../../utils';

// ============================================================================
// MENU ITEM MODAL
// ============================================================================

interface MenuItemForm {
    name: string;
    description: string;
    price: number;
    category: string;
    prepTime: number;
    isAvailable: boolean;
    imageUrl: string;
}

const EMPTY_FORM: MenuItemForm = {
    name: '',
    description: '',
    price: 0,
    category: '',
    prepTime: 15,
    isAvailable: true,
    imageUrl: ''
};

function MenuItemModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: RestaurantMenuItem | null }) {
    const [form, setForm] = useState<MenuItemForm>(
        editing ? {
            name: editing.name,
            description: editing.description || '',
            price: editing.price,
            category: editing.category,
            prepTime: editing.prepTime || 15,
            isAvailable: editing.isAvailable,
            imageUrl: editing.imageUrl || ''
        } : EMPTY_FORM
    );

    const create = useCreateMenuItem();
    const update = useUpdateMenuItem();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editing) {
                await update.mutateAsync({ id: editing.id, data: form });
            } else {
                await create.mutateAsync(form);
            }
            onClose();
        } catch (e) { /* error handled by hook toast */ }
    };

    const isBusy = create.isLoading || update.isLoading;

    return (
        <Modal isOpen={open} onClose={onClose} title={editing ? 'Editar Prato' : 'Adicionar ao Cardápio'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-6">
                    {/* Left: Image Upload Placeholder */}
                    <div className="w-1/3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Imagem do Prato</label>
                        <div className="aspect-square rounded-lg border-2 border-dashed border-gray-200 dark:border-dark-600 flex flex-col items-center justify-center text-gray-400 gap-2 hover:border-primary-500 hover:text-primary-500 transition-colors cursor-pointer group">
                             <HiOutlineCamera className="w-8 h-8 group-hover:scale-110 transition-transform" />
                             <span className="text-xs">Clique para enviar</span>
                        </div>
                    </div>

                    {/* Right: Info */}
                    <div className="flex-1 space-y-4">
                        <Input 
                            label="Nome do Prato *" 
                            value={form.name} 
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
                            placeholder="Ex: Picanha na Grelha" 
                            required 
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Categoria *" 
                                value={form.category} 
                                onChange={e => setForm(p => ({ ...p, category: e.target.value }))} 
                                placeholder="Ex: Grelhados" 
                                required 
                            />
                            <Input 
                                label="Preço (MZN) *" 
                                type="number" 
                                value={form.price || ''} 
                                onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))} 
                                required 
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        label="Tempo de Preparo (min)" 
                        type="number" 
                        value={form.prepTime} 
                        onChange={e => setForm(p => ({ ...p, prepTime: Number(e.target.value) }))} 
                    />
                    <div className="flex flex-col">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Disponibilidade</label>
                        <Select
                            value={form.isAvailable ? 'true' : 'false'}
                            onChange={e => setForm(p => ({ ...p, isAvailable: e.target.value === 'true' }))}
                            options={[
                                { value: 'true', label: 'Disponível' },
                                { value: 'false', label: 'Esgotado' }
                            ]}
                        />
                    </div>
                </div>

                <Textarea 
                    label="Descrição / Ingredientes"
                    placeholder="Ex: Acompanha arroz, feijão e farofa..."
                    rows={3}
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                />

                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
                    <Button type="submit" isLoading={isBusy} className="bg-primary-600 hover:bg-primary-700">
                        {editing ? 'Salvar Alterações' : 'Adicionar ao Cardápio'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ============================================================================
// MENU CARD
// ============================================================================

function MenuCard({ item, onEdit, onDelete }: { item: RestaurantMenuItem; onEdit: () => void; onDelete: () => void }) {
    const toggleAvailability = useToggleMenuItemAvailability();

    return (
        <Card className="overflow-hidden group hover:shadow-lg transition-all border-none bg-white dark:bg-dark-800">
            <div className="relative aspect-[4/3] bg-gray-100 dark:bg-dark-700 overflow-hidden">
                {/* Fallback pattern if no image */}
                {!item.imageUrl && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-1 opacity-50">
                        <HiOutlinePlus className="w-8 h-8" />
                        <span className="text-[10px] uppercase font-bold tracking-widest">{item.category}</span>
                    </div>
                )}
                
                <div className="absolute bottom-2 left-2 flex gap-1">
                    <Badge variant={item.isAvailable ? 'success' : 'gray'}>
                        {item.isAvailable ? 'Disponível' : 'Esgotado'}
                    </Badge>
                </div>

                {/* Overlays on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button onClick={onEdit} className="w-10 h-10 rounded-full bg-white text-gray-900 flex items-center justify-center hover:scale-110 transition-transform">
                        <HiOutlinePencil className="w-5 h-5" />
                    </button>
                    <button onClick={onDelete} className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center hover:scale-110 transition-transform">
                        <HiOutlineTrash className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="p-4">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-gray-900 dark:text-white truncate pr-2">{item.name}</h3>
                    <span className="text-primary-600 dark:text-primary-400 font-extrabold text-sm whitespace-nowrap">
                        {formatCurrency(item.price)}
                    </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem] mb-3">
                    {item.description || "Nenhuma descrição disponível."}
                </p>
                
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-dark-700">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        <HiOutlinePlus className="w-3 h-3" />
                        {item.prepTime || 15} MIN
                    </div>
                    <button 
                        onClick={() => toggleAvailability.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                        disabled={toggleAvailability.isLoading}
                        className={cn(
                            "text-xs font-bold transition-colors",
                            item.isAvailable ? "text-red-500 hover:text-red-600" : "text-emerald-500 hover:text-emerald-600"
                        )}
                    >
                        {item.isAvailable ? 'Marcar Esgotado' : 'Marcar Disponível'}
                    </button>
                </div>
            </div>
        </Card>
    );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function RestaurantMenuPage() {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<RestaurantMenuItem | null>(null);
    const [deleting, setDeleting] = useState<RestaurantMenuItem | null>(null);

    const { data: menuData, isLoading, refetch } = useRestaurantMenu({ 
        search: search || undefined, 
        category: category || undefined 
    });
    
    const deleteMutation = useDeleteMenuItem();
    const items = menuData?.data || [];

    const categories = useMemo(() => {
        const set = new Set(items.map(i => i.category));
        return Array.from(set);
    }, [items]);

    const handleEdit = (item: RestaurantMenuItem) => {
        setEditing(item);
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleting) return;
        await deleteMutation.mutateAsync(deleting.id);
        setDeleting(null);
        refetch();
    };

    return (
        <div className="space-y-6 pb-12 animate-fade-in">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-1">
                        <HiOutlineChevronRight className="w-3 h-3" />
                        Serviço Profissional
                    </div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Cardápio</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestão de pratos, bebidas e disponibilidade em tempo real.</p>
                </div>
                <Button 
                    onClick={() => setModalOpen(true)}
                    leftIcon={<HiOutlinePlus className="w-5 h-5" />}
                    className="bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-500/20"
                >
                    Novo Item
                </Button>
            </div>

            {/* Filters bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center bg-white dark:bg-dark-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-dark-700">
                <div className="flex-1 w-full">
                    <Input 
                        placeholder="Pesquisar no menu..." 
                        leftIcon={<HiOutlineMagnifyingGlass className="w-5 h-5" />}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-gray-50 dark:bg-dark-700 border-none"
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-hidden">
                    <Button 
                        variant={!category ? 'primary' : 'secondary'}
                        onClick={() => setCategory('')}
                        size="sm"
                        className={cn("rounded-lg whitespace-nowrap", !category ? "shadow-md shadow-primary-500/20" : "")}
                    >
                        Todos
                    </Button>
                    {categories.map(cat => (
                        <Button 
                            key={cat}
                            variant={category === cat ? 'primary' : 'secondary'}
                            onClick={() => setCategory(cat)}
                            size="sm"
                            className={cn("rounded-lg whitespace-nowrap", category === cat ? "shadow-md shadow-primary-500/20" : "")}
                        >
                            {cat}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Content Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-24">
                     <LoadingSpinner size="xl" />
                </div>
            ) : items.length === 0 ? (
                <div className="py-24 text-center">
                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center mx-auto mb-4">
                        <HiOutlineFunnel className="w-10 h-10 text-gray-300" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cardápio Vazio</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Nenhum item encontrado com estes filtros.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {items.map(item => (
                        <MenuCard 
                            key={item.id} 
                            item={item} 
                            onEdit={() => handleEdit(item)}
                            onDelete={() => setDeleting(item)}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            {modalOpen && (
                <MenuItemModal 
                    open={modalOpen} 
                    onClose={() => { setModalOpen(false); setEditing(null); refetch(); }} 
                    editing={editing} 
                />
            )}

            {deleting && (
                <Modal isOpen={!!deleting} onClose={() => setDeleting(null)} title="Eliminar Item">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Tem certeza que deseja eliminar <span className="font-bold text-gray-900 dark:text-white">{deleting.name}</span> do cardápio?
                        </p>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" onClick={() => setDeleting(null)}>Cancelar</Button>
                            <Button variant="danger" onClick={handleDelete} isLoading={deleteMutation.isLoading}>
                                Sim, Eliminar
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
