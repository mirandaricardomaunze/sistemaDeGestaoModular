import StockMovementHistory from '../../components/inventory/StockMovementHistory';

export default function CommercialStockMovements() {
    return (
        <div className="space-y-4 animate-fade-in pb-10">
            {/* The existing movement history component - will be rendered with the commercial filter */}
            <StockMovementHistory originModule="commercial" />
        </div>
    );
}
