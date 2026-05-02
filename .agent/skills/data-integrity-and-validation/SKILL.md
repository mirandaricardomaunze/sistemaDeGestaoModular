---
name: data-integrity-and-validation
description: "Guidelines and rules for ensuring financial data integrity through server-side authority, calculation verification, and strict operational prerequisites."
---

# 💎 Data Integrity & Server-Side Validation

> 🤖 **AI INSTRUCTION (MANDATORY)**: You MUST enforce server-side authority for all financial transactions. NEVER trust subtotals, taxes, or final totals provided by the client. ALWAYS recalculate these values using authoritative data from the database.

This skill ensures that the Multicore system is resilient against malicious payload manipulation and human error in the frontend.

## 1. The Principle of Server-Side Authority

The backend is the **Source of Truth**. The frontend provides "intent" (e.g., "I want to sell these 5 items"), but the backend determines the "result" (e.g., "The total is X, the tax is Y").

### 🚫 Anti-Patterns to Avoid:
- Saving `total` or `tax` directly from `req.body` without verification.
- Trusting `unitPrice` from the client without checking the `Product` table.
- Allowing financial transactions when required states (like an open cash session) are missing.

## 2. Authoritative Recalculation Pattern

Every service handling Sales, Invoices, or Orders MUST follow this workflow within a database transaction (`prisma.$transaction`):

1. **Fetch Product Data**: Get real prices, tax rates, and stock levels from the DB using the IDs provided in the request.
2. **Verify Unit Prices**: Compare the client-provided `unitPrice` with the DB price.
   - If the discrepancy is > 0.01 (rounding tolerance), log a warning and **use the DB price** as the authoritative value.
3. **Recalculate Totals**:
   - Compute `itemTotal` (quantity * verifiedPrice).
   - Compute `subtotal` (sum of item totals).
   - Compute `tax` (based on company settings or product tax rates).
   - Compute `total` (subtotal - discounts + tax).
4. **Enforce Precision**: Always use `Math.round(value * 100) / 100` to prevent floating-point errors.

## 3. Operational Prerequisites

Financial actions must validate the system state before proceeding:

- **Cash Sessions**: For POS-related modules (Commercial, Bottle Store, Restaurant), verify that a `sessionId` is provided and that the session is currently `open`.
- **Credit Limits**: If a customer is linked, verify that the new transaction won't exceed their `creditLimit` by aggregating open invoices and orders.
- **Stock Integrity**: Ensure items are in stock and properly reserved before finalizing a sale.

## 4. Implementation Example (Service Layer)

```typescript
// Fetch real prices
const products = await tx.product.findMany({
    where: { id: { in: itemIds }, companyId },
    select: { id: true, price: true }
});
const priceMap = new Map(products.map(p => [p.id, Number(p.price)]));

// Recalculate
const verifiedItems = items.map(item => {
    const dbPrice = priceMap.get(item.productId) || 0;
    // Enforce DB price if mismatch detected
    const unitPrice = (dbPrice > 0 && Math.abs(dbPrice - item.unitPrice) > 0.01) 
        ? dbPrice 
        : item.unitPrice;
    
    return {
        ...item,
        unitPrice,
        total: Math.round(unitPrice * item.quantity * 100) / 100
    };
});

const finalTotal = verifiedItems.reduce((sum, i) => sum + i.total, 0);
```

## 5. Validation Checklist

1. [ ] Is the backend recalculating all financial totals?
2. [ ] Are unit prices being verified against the database?
3. [ ] If this is a POS sale, is an open cash session required?
4. [ ] Are floating-point values being rounded to 2 decimal places?
5. [ ] Is the entire operation wrapped in a transaction?
