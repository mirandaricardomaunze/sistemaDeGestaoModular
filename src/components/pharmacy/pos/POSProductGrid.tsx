import { Input, Badge, Pagination } from '../../ui';
import { HiOutlineSearch } from 'react-icons/hi';

export function POSProductGrid({
    searchInputRef,
    posSearch,
    setPosSearch,
    filteredMedications,
    posPagination,
    addToCart
}: {
    searchInputRef?: React.RefObject<HTMLInputElement>;
    posSearch: string;
    setPosSearch: (v: string) => void;
    filteredMedications: any[];
    posPagination: any;
    addToCart: (med: any) => void;
}) {
    return (
        <div className="space-y-4">
            <Input
                ref={searchInputRef}
                placeholder="Pesquisar medicamento..."
                value={posSearch}
                onChange={(e) => setPosSearch(e.target.value)}
                leftIcon={<HiOutlineSearch className="w-5 h-5 text-gray-400" />}
            />
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[700px] overflow-y-auto pr-2">
                {posPagination.paginatedItems.map((med: any) => (
                    <div
                        key={med.id}
                        className="p-5 cursor-pointer bg-white dark:bg-dark-800 border-2 border-gray-100 dark:border-dark-700 rounded-3xl hover:border-teal-500 hover:shadow-2xl hover:shadow-teal-500/10 transition-all flex flex-col min-h-[160px] group"
                        onClick={() => addToCart(med)}
                    >
                        <div className="flex-1">
                            <p className="font-black text-lg text-gray-900 dark:text-white truncate mb-1">{med.product.name}</p>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{med.dosage} • {med.pharmaceuticalForm}</p>
                            {med.dci && <p className="text-[10px] text-gray-400 italic truncate mt-1">{med.dci}</p>}
                        </div>
                        <div className="mt-4 flex items-end justify-between">
                            <div className="flex flex-col">
                                <span className="text-2xl font-black text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform origin-left block">
                                    {Number(med.batches[0]?.sellingPrice || med.product.price).toLocaleString()} <span className="text-sm font-bold">MT</span>
                                </span>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant={med.isLowStock ? 'warning' : 'success'} className="text-xs px-2 py-0.5 font-bold">
                                    {med.totalStock} UN
                                </Badge>
                                {med.requiresPrescription && (
                                    <Badge variant="info" className="text-[10px] px-2 py-0.5 font-bold uppercase ring-1 ring-blue-500/50">Receita</Badge>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {filteredMedications.length === 0 && (
                    <div className="col-span-full py-8 text-center text-gray-400">
                        Nenhum medicamento encontrado
                    </div>
                )}
            </div>

            {filteredMedications.length > 0 && (
                <Pagination
                    currentPage={posPagination.currentPage}
                    totalItems={posPagination.totalItems}
                    itemsPerPage={posPagination.itemsPerPage}
                    onPageChange={posPagination.setCurrentPage}
                    onItemsPerPageChange={posPagination.setItemsPerPage}
                    itemsPerPageOptions={[12, 24, 48]}
                    showInfo={false}
                    className="mt-4"
                />
            )}
        </div>
    );
}
