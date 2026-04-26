const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'UserSettings.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the businessTypeOptions lines and log them for diagnosis
const lines = content.split('\n');
for (let i = 234; i < 243; i++) {
    const hex = Buffer.from(lines[i], 'utf8').toString('hex');
    console.log(`Line ${i+1} hex: ${hex.substring(0, 200)}...`);
}

// Replace the entire businessTypeOptions block
const oldBlock = /const businessTypeOptions = \[[\s\S]*?\];/;
const newBlock = `const businessTypeOptions = [
        { value: 'retail', label: 'Com\u00e9rcio / Retalho', icon: '\uD83D\uDCE6', description: 'Loja de artigos diversos, vestu\u00e1rio, electr\u00f3nicos' },
        { value: 'pharmacy', label: 'Farm\u00e1cia', icon: '\uD83D\uDC8A', description: 'Medicamentos, controle de lotes e validades' },
        { value: 'supermarket', label: 'Supermercado', icon: '\uD83D\uDED2', description: 'Mercearia, balan\u00e7a e alto volume de vendas' },
        { value: 'bottlestore', label: 'Bottle Store', icon: '\uD83C\uDF7E', description: 'Garrafeira, bebidas e gest\u00e3o de vasilhame' },
        { value: 'hotel', label: 'Hotel / Residencial', icon: '\uD83C\uDFE8', description: 'Hospedagem, gest\u00e3o de quartos e reservas' },
        { value: 'logistics', label: 'Log\u00edstica / Armaz\u00e9m', icon: '\uD83D\uDE9A', description: 'Gest\u00e3o de estoque multifocal e transfer\u00eancias' },
    ];`;

if (oldBlock.test(content)) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('\nEmojis fixed successfully!');
    
    // Verify
    const verify = fs.readFileSync(filePath, 'utf8');
    const match = verify.match(/const businessTypeOptions = \[[\s\S]*?\];/);
    if (match) {
        console.log('\nVerification:');
        console.log(match[0].substring(0, 500));
    }
} else {
    console.log('ERROR: Could not find businessTypeOptions block');
}
