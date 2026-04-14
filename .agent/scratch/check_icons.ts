import * as hi2 from 'react-icons/hi2';

const requestedIcons = [
    'HiOutlineX',
    'HiOutlineDocumentReport',
    'HiOutlinePrinter',
    'HiOutlineCalendar',
    'HiOutlineUser',
    'HiOutlineBanknotes',
    'HiOutlineArrowUpCircle',
    'HiOutlineArrowDownCircle',
    'HiOutlineExclamationTriangle',
    'HiOutlineCheckCircle'
];

console.log('--- ICON CHECK ---');
requestedIcons.forEach(name => {
    if ((hi2 as any)[name]) {
        console.log(`[OK] ${name}`);
    } else {
        console.log(`[MISSING] ${name}`);
        // Try to find similar names
        const base = name.replace('HiOutline', '');
        const similar = Object.keys(hi2).filter(key => key.includes(base) || base.includes(key.replace('HiOutline', '')));
        console.log(`  Similar: ${similar.slice(0, 5).join(', ')}`);
    }
});
