import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Backfill products with originModule='inventory' that were actually created via
 * a specialized module (restaurant / commercial / bottle_store) but mis-tagged
 * because the frontend was sending `origin_module` (snake_case) while the
 * backend Zod schema expects `originModule` (camelCase) — silently dropping it
 * and applying the default 'inventory'.
 *
 * Heuristic: look at sales history. A product sold predominantly via a given
 * module's POS (Sale.originModule) should be re-tagged to that module.
 *
 * Run with:  npx ts-node backend/scripts/backfill-product-origin-module.ts
 *            (add --apply to actually write; otherwise dry-run.)
 */

const APPLY = process.argv.includes('--apply');
const TARGET_MODULES = ['restaurant', 'commercial', 'bottle_store'] as const;

async function backfill() {
    console.log(`\n=== Backfill product.originModule (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===\n`);

    // Pull all sales joined with their items, restricted to specialized modules.
    const sales = await prisma.sale.findMany({
        where: { originModule: { in: TARGET_MODULES as unknown as string[] } },
        select: {
            originModule: true,
            items: { select: { productId: true } },
        },
    });

    // Tally: productId -> { module -> count }
    const tally = new Map<string, Record<string, number>>();
    for (const sale of sales) {
        const mod = sale.originModule;
        if (!mod) continue;
        for (const it of sale.items) {
            if (!it.productId) continue;
            const row = tally.get(it.productId) || {};
            row[mod] = (row[mod] || 0) + 1;
            tally.set(it.productId, row);
        }
    }

    if (tally.size === 0) {
        console.log('No sales found in restaurant/commercial/bottle_store. Nothing to do.\n');
        return;
    }

    // For each product, pick the dominant module (highest count).
    // Only consider products currently tagged as 'inventory'.
    const candidateIds = Array.from(tally.keys());
    const products = await prisma.product.findMany({
        where: { id: { in: candidateIds }, originModule: 'inventory' },
        select: { id: true, name: true, code: true, companyId: true },
    });

    const updates: { id: string; name: string; from: string; to: string; votes: Record<string, number> }[] = [];

    for (const p of products) {
        const votes = tally.get(p.id) || {};
        const dominant = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
        if (!dominant) continue;
        updates.push({ id: p.id, name: p.name, from: 'inventory', to: dominant[0], votes });
    }

    console.log(`Found ${updates.length} products to retag.\n`);
    for (const u of updates.slice(0, 20)) {
        console.log(`  ${u.id.slice(0, 8)}  ${u.from} → ${u.to.padEnd(12)}  ${u.name}  ${JSON.stringify(u.votes)}`);
    }
    if (updates.length > 20) console.log(`  ... and ${updates.length - 20} more`);

    if (!APPLY) {
        console.log('\n(dry-run — no changes written. Re-run with --apply to commit.)\n');
        return;
    }

    let applied = 0;
    for (const u of updates) {
        await prisma.product.update({
            where: { id: u.id },
            data: { originModule: u.to },
        });
        applied++;
    }
    console.log(`\nApplied ${applied} updates.\n`);
}

backfill()
    .catch((e) => {
        console.error('Backfill failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
