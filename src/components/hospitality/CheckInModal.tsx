import { Modal, Input, Textarea, Select, Button, Stepper } from '../ui';
import { HiOutlineClipboardList, HiOutlineCheck, HiOutlineGlobe, HiOutlineHome } from 'react-icons/hi';
import { COUNTRIES, getCountryByCode, getDocumentTypesForCountry } from '../../config/countries';

interface CheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (e: React.FormEvent) => void;
    room: any;
    onRoomSelect?: (room: any) => void;
    availableRooms?: any[];
    data: any;
    setData: (data: any) => void;
    stepper: any;
    steps: any[];
}

export default function CheckInModal({
    isOpen,
    onClose,
    onConfirm,
    room,
    onRoomSelect,
    availableRooms = [],
    data,
    setData,
    stepper,
    steps
}: CheckInModalProps) {
    const isSelectingRoom = steps[stepper.currentStep].id === 'room-select';
    const isFormStep = steps[stepper.currentStep].id === 'form';
    const isConfirmStep = steps[stepper.currentStep].id === 'confirm';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={room ? `Check-in: Quarto ${room.number}` : 'Novo Check-in'}
            size="lg"
        >
            <div className="mb-6">
                <Stepper steps={steps} currentStep={stepper.currentStep} />
            </div>

            <form onSubmit={onConfirm} className="space-y-4">
                {isSelectingRoom && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto p-1">
                            {availableRooms.length > 0 ? (
                                availableRooms.map((r) => (
                                    <div
                                        key={r.id}
                                        onClick={() => onRoomSelect?.(r)}
                                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${room?.id === r.id
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                                            : 'border-gray-100 dark:border-dark-700 hover:border-primary-200 dark:hover:border-primary-800'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300">
                                                {r.number}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900 dark:text-white uppercase">{r.type}</p>
                                                <p className="text-xs text-gray-500">{new Intl.NumberFormat('pt-MZ').format(r.price)} MT/Noite</p>
                                            </div>
                                        </div>
                                        {room?.id === r.id && <HiOutlineCheck className="text-primary-600 w-5 h-5" />}
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-2 py-10 text-center">
                                    <HiOutlineHome className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <p className="text-gray-500">Nenhum quarto disponível no momento.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
                            <Button
                                variant="primary"
                                type="button"
                                onClick={() => stepper.next()}
                                disabled={!room}
                            >
                                Próximo
                            </Button>
                        </div>
                    </div>
                )}

                {isFormStep && (() => {
                    const selectedCountry = getCountryByCode(data.guestCountry) || COUNTRIES[0];
                    const documentTypes = getDocumentTypesForCountry(data.guestCountry || 'MZ');

                    return (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <Input
                                label="Nome do Hóspede"
                                required
                                value={data.customerName}
                                onChange={(e) => setData({ ...data, customerName: e.target.value })}
                                placeholder="Nome completo..."
                            />

                            {/* Email - Important for international guests */}
                            <Input
                                label="Email"
                                type="email"
                                value={data.guestEmail || ''}
                                onChange={(e) => setData({ ...data, guestEmail: e.target.value })}
                                placeholder="email@exemplo.com"
                            />

                            {/* Country Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    <HiOutlineGlobe className="w-4 h-4 inline mr-1" />
                                    País / Nacionalidade
                                </label>
                                <select
                                    value={data.guestCountry || 'MZ'}
                                    onChange={(e) => setData({
                                        ...data,
                                        guestCountry: e.target.value,
                                        guestNationality: getCountryByCode(e.target.value)?.name || '',
                                        guestDocumentType: e.target.value !== 'MZ' ? 'passport' : 'BI'
                                    })}
                                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-sm focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500"
                                >
                                    {COUNTRIES.map(country => (
                                        <option key={country.code} value={country.code}>
                                            {country.flag} {country.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Document Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select
                                    label="Tipo de Documento"
                                    value={data.guestDocumentType}
                                    onChange={(e) => setData({ ...data, guestDocumentType: e.target.value })}
                                    options={documentTypes.map(d => ({ value: d.value, label: d.label }))}
                                />
                                <Input
                                    label="Número do Documento"
                                    value={data.guestDocumentNumber}
                                    onChange={(e) => setData({ ...data, guestDocumentNumber: e.target.value })}
                                    placeholder={data.guestDocumentType === 'passport' ? 'Ex: AB1234567' : 'Número...'}
                                    required
                                />
                            </div>

                            {/* Phone with dial code */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Telefone
                                </label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-100 dark:bg-dark-600 border border-r-0 border-gray-300 dark:border-dark-600 rounded-l-lg">
                                        {selectedCountry.flag} {selectedCountry.dialCode}
                                    </span>
                                    <input
                                        type="tel"
                                        value={data.guestPhone?.replace(/^\+\d{1,4}\s*/, '') || ''}
                                        onChange={(e) => setData({ ...data, guestPhone: e.target.value })}
                                        placeholder="84 123 4567"
                                        className="flex-1 px-3 py-2.5 rounded-r-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-sm focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                                <Button variant="outline" type="button" onClick={() => steps[0].id === 'room-select' ? stepper.prev() : onClose()}>
                                    {steps[0].id === 'room-select' ? 'Voltar' : 'Cancelar'}
                                </Button>
                                <Button variant="primary" type="button" onClick={() => stepper.next()}>Próximo</Button>
                            </div>
                        </div>
                    );
                })()}

                {isConfirmStep && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-4 bg-gray-50 dark:bg-dark-800/50 rounded-xl space-y-3">
                            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <HiOutlineClipboardList className="text-primary-500" />
                                Resumo da Estadia
                            </h4>
                            <div className="grid grid-cols-2 gap-y-2 text-sm">
                                <p className="text-gray-500">Quarto:</p>
                                <p className="font-medium text-gray-900 dark:text-white">{room?.number} ({room?.type})</p>
                                <p className="text-gray-500">Hóspede:</p>
                                <p className="font-medium text-gray-900 dark:text-white capitalize">{data.customerName}</p>
                                <p className="text-gray-500">Preço p/ Noite:</p>
                                <p className="font-medium text-gray-900 dark:text-white">{new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(Number(room?.price) || 0)}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Data Prevista de Check-out"
                                type="date"
                                required
                                value={data.checkOutDate}
                                onChange={(e) => setData({ ...data, checkOutDate: e.target.value })}
                            />
                            <Select
                                label="Plano de Refeição"
                                value={data.mealPlan}
                                onChange={(e) => setData({ ...data, mealPlan: e.target.value })}
                                options={[
                                    { value: 'none', label: 'Só Alojamento' },
                                    { value: 'breakfast', label: 'Pequeno Almoço' },
                                    { value: 'half_board', label: 'Meia Pensão' },
                                    { value: 'full_board', label: 'Pensão Completa' },
                                ]}
                            />
                        </div>

                        <Textarea
                            label="Observações Adicionais"
                            rows={2}
                            value={data.notes}
                            onChange={(e) => setData({ ...data, notes: e.target.value })}
                        />

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                            <Button variant="outline" type="button" onClick={() => stepper.prev()}>Voltar</Button>
                            <Button variant="primary" type="submit" leftIcon={<HiOutlineCheck />}>Finalizar Check-in</Button>
                        </div>
                    </div>
                )}
            </form>
        </Modal>
    );
}
