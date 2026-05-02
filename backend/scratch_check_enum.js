
const fs = require('fs');
const { TransferStatus } = require('@prisma/client');
fs.writeFileSync('enum_output.json', JSON.stringify(TransferStatus, null, 2));
console.log('Done');
