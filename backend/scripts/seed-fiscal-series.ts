import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SAFETY_FLOOR = 100;

async function main() {
    const grouped = await prisma.sale.groupBy({
        by: ['companyId', 'series'],
        _max: { fiscalNumber: true },
    });

    const year = new Date().getFullYear();
    const code = `FR-${year}`;

    let inserted = 0;
    let skipped = 0;
    let bumped = 0;

    for (const g of grouped) {
        if (!g.companyId) continue;
        const maxNum = Number(g._max.fiscalNumber ?? 0);
        const seedNumber = Math.max(maxNum, SAFETY_FLOOR);

        const existing = await prisma.documentSeries.findUnique({
            where: { companyId_code: { companyId: g.companyId, code } },
        });

        if (!existing) {
            await prisma.documentSeries.create({
                data: {
                    code,
                    name: `Faturas Recibo ${year}`,
                    prefix: 'FR',
                    series: g.series,
                    lastNumber: seedNumber,
                    isActive: true,
                    companyId: g.companyId,
                },
            });
            console.log(`INSERT company=${g.companyId} series=${g.series} lastNumber=${seedNumber} (maxSale=${maxNum})`);
            inserted++;
        } else if (Number(existing.lastNumber) < seedNumber) {
            await prisma.documentSeries.update({
                where: { id: existing.id },
                data: { lastNumber: seedNumber, isActive: true, prefix: 'FR' },
            });
            console.log(`BUMP   company=${g.companyId} series=${g.series} ${existing.lastNumber} -> ${seedNumber}`);
            bumped++;
        } else {
            console.log(`SKIP   company=${g.companyId} series=${g.series} (already at ${existing.lastNumber} >= ${seedNumber})`);
            skipped++;
        }
    }

    console.log(`\nDone. inserted=${inserted} bumped=${bumped} skipped=${skipped}`);
}

main()
    .catch((e) => { console.error('ERR:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
