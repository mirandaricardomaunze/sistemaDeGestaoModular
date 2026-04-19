import { Card, Button } from '../../ui';

export function POSPatientHistoryModal({
    isOpen,
    onClose,
    patientHistory
}: {
    isOpen: boolean;
    onClose: () => void;
    patientHistory: any[];
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col p-6 animate-fade-in shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-blue-600">Histórico de Receituário</h3>
                        <p className="text-sm text-gray-500">
                            Vendas de medicamentos controlados
                        </p>
                    </div>
                    <Button variant="outline" onClick={onClose}>
                        Fechar
                    </Button>
                </div>

                <div className="overflow-y-auto pr-2 space-y-4">
                    {patientHistory.length === 0 ? (
                        <p className="text-center py-8 text-gray-500">Nenhum registo encontrado para este paciente.</p>
                    ) : (
                        patientHistory.map((sale: any) => (
                            <div key={sale.id} className="p-4 border rounded-lg dark:border-dark-700 bg-gray-50 dark:bg-dark-800">
                                <div className="flex justify-between items-start mb-3 border-b dark:border-dark-700 pb-2">
                                    <div>
                                        <p className="font-semibold">{new Date(sale.date).toLocaleDateString()} - {sale.number}</p>
                                        {sale.prescription ? (
                                            <p className="text-sm text-blue-600 dark:text-blue-400">
                                                Receita: {sale.prescription.code} (Dr. {sale.prescription.doctorName})
                                            </p>
                                        ) : (
                                            <p className="text-sm text-red-500 font-medium">Sem receita registada</p>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {sale.items.map((item: any) => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <span>{item.quantity}x {item.productName}</span>
                                            <span className="text-gray-500">{Number(item.unitPrice).toLocaleString()} MT</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
}
