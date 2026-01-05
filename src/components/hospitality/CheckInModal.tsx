import { Modal, Input, Textarea, Select, Button, Stepper } from '../ui';
import { HiOutlineUserAdd, HiOutlineClipboardList, HiOutlineCheck } from 'react-icons/hi';

interface CheckInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (e: React.FormEvent) => void;
    room: any;
    data: any;
    setData: (data: any) => void;
    stepper: any;
    steps: any[];
}

export default function CheckInModal({ isOpen, onClose, onConfirm, room, data, setData, stepper, steps }: CheckInModalProps) {
    if (!room) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Check-in: Quarto ${room.number}`}
            size="lg"
        >
            <div className="mb-6">
                <Stepper steps={steps} currentStep={stepper.currentStep} />
            </div>

            <form onSubmit={onConfirm} className="space-y-4">
                {stepper.activeStep === 0 ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <Input
                            label="Nome do Hóspede"
                            required
                            value={data.customerName}
                            onChange={(e) => setData({ ...data, customerName: e.target.value })}
                            placeholder="Nome completo..."
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select
                                label="Documento"
                                value={data.guestDocumentType}
                                onChange={(e) => setData({ ...data, guestDocumentType: e.target.value })}
                                options={[
                                    { value: 'BI', label: 'B.I.' },
                                    { value: 'Passaporte', label: 'Passaporte' },
                                    { value: 'DIRE', label: 'DIRE' },
                                    { value: 'Outro', label: 'Outro' },
                                ]}
                            />
                            <Input
                                label="Número do Documento"
                                value={data.guestDocumentNumber}
                                onChange={(e) => setData({ ...data, guestDocumentNumber: e.target.value })}
                                placeholder="Número..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Nacionalidade"
                                value={data.guestNationality}
                                onChange={(e) => setData({ ...data, guestNationality: e.target.value })}
                                placeholder="Ex: Moçambicana"
                            />
                            <Input
                                label="Telefone"
                                type="tel"
                                value={data.guestPhone}
                                onChange={(e) => setData({ ...data, guestPhone: e.target.value })}
                                placeholder="+258..."
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-700">
                            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
                            <Button variant="primary" type="button" onClick={() => stepper.next()}>Próximo</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="p-4 bg-gray-50 dark:bg-dark-800/50 rounded-xl space-y-3">
                            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <HiOutlineClipboardList className="text-primary-500" />
                                Resumo da Estadia
                            </h4>
                            <div className="grid grid-cols-2 gap-y-2 text-sm">
                                <p className="text-gray-500">Quarto:</p>
                                <p className="font-medium text-gray-900 dark:text-white">{room.number} ({room.type})</p>
                                <p className="text-gray-500">Hóspede:</p>
                                <p className="font-medium text-gray-900 dark:text-white capitalize">{data.customerName}</p>
                                <p className="text-gray-500">Preço p/ Noite:</p>
                                <p className="font-medium text-gray-900 dark:text-white">{new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(room.price)}</p>
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
