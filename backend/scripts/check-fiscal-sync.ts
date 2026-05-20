import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const grouped = await prisma.sale.groupBy({
        by: ['companyId', 'series'],
        _max: { fiscalNumber: true },
        _count: { _all: true },
    });
    console.log('\n=== Per-company max fiscalNumber in sales ===');
    for (const g of grouped) {
        console.log(
            `  company=${g.companyId} series=${g.series} ` +
            `count=${g._count._all} maxFiscalNumber=${g._max.fiscalNumber}`
        );
    }

    const series = await prisma.documentSeries.findMany();
    console.log(`\n=== document_series rows: ${series.length} ===`);
    for (const s of series) {
        console.log(
            `  company=${s.companyId} code=${s.code} prefix=${s.prefix} ` +
            `series=${s.series} lastNumber=${s.lastNumber} active=${s.isActive}`
        );
    }
}

main()
    .catch((e) => { console.error('ERR:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
