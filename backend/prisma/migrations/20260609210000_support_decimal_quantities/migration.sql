-- Support weighed and measured products while preserving existing integer quantities.

ALTER TABLE "products"
    ALTER COLUMN "currentStock" TYPE DECIMAL(10,3) USING "currentStock"::DECIMAL(10,3),
    ALTER COLUMN "minStock" TYPE DECIMAL(10,3) USING "minStock"::DECIMAL(10,3),
    ALTER COLUMN "maxStock" TYPE DECIMAL(10,3) USING "maxStock"::DECIMAL(10,3),
    ALTER COLUMN "reservedStock" TYPE DECIMAL(10,3) USING "reservedStock"::DECIMAL(10,3);

ALTER TABLE "price_tiers"
    ALTER COLUMN "minQty" TYPE DECIMAL(10,3) USING "minQty"::DECIMAL(10,3);

ALTER TABLE "warehouse_stocks"
    ALTER COLUMN "quantity" TYPE DECIMAL(10,3) USING "quantity"::DECIMAL(10,3),
    ALTER COLUMN "reserved_quantity" TYPE DECIMAL(10,3) USING "reserved_quantity"::DECIMAL(10,3);

ALTER TABLE "stock_transfer_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(10,3) USING "quantity"::DECIMAL(10,3),
    ALTER COLUMN "received_quantity" TYPE DECIMAL(10,3) USING "received_quantity"::DECIMAL(10,3);

ALTER TABLE "purchase_order_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(10,3) USING "quantity"::DECIMAL(10,3),
    ALTER COLUMN "receivedQty" TYPE DECIMAL(10,3) USING "receivedQty"::DECIMAL(10,3);

ALTER TABLE "supplier_invoice_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(10,3) USING "quantity"::DECIMAL(10,3);

ALTER TABLE "customer_order_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(10,3) USING "quantity"::DECIMAL(10,3);

ALTER TABLE "sale_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(10,3) USING "quantity"::DECIMAL(10,3);

ALTER TABLE "invoice_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(10,3) USING "quantity"::DECIMAL(10,3);

ALTER TABLE "credit_note_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(10,3) USING "quantity"::DECIMAL(10,3);

ALTER TABLE "debit_note_items"
    ALTER COLUMN "quantity" TYPE DECIMAL(10,3) USING "quantity"::DECIMAL(10,3);

ALTER TABLE "stock_movements"
    ALTER COLUMN "quantity" TYPE DECIMAL(10,3) USING "quantity"::DECIMAL(10,3),
    ALTER COLUMN "balanceBefore" TYPE DECIMAL(10,3) USING "balanceBefore"::DECIMAL(10,3),
    ALTER COLUMN "balanceAfter" TYPE DECIMAL(10,3) USING "balanceAfter"::DECIMAL(10,3);

ALTER TABLE "physical_inventory_lines"
    ALTER COLUMN "expectedQuantity" TYPE DECIMAL(10,3) USING "expectedQuantity"::DECIMAL(10,3),
    ALTER COLUMN "countedQuantity" TYPE DECIMAL(10,3) USING "countedQuantity"::DECIMAL(10,3),
    ALTER COLUMN "difference" TYPE DECIMAL(10,3) USING "difference"::DECIMAL(10,3);

ALTER TABLE "stock_reservations"
    ALTER COLUMN "quantity" TYPE DECIMAL(10,3) USING "quantity"::DECIMAL(10,3);
