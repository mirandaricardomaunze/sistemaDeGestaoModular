
const fs = require('fs');
const path = require('path');

try {
    const srcPath = path.resolve(__dirname, 'src');
    if (!fs.existsSync(srcPath)) {
        fs.writeFileSync('repair_error.txt', `SRC path does not exist: ${srcPath}`);
        process.exit(1);
    }

    const patterns = [
        { s: /\u00C3\u00A9/g, r: 'é' },
        { s: /\u00C3\u00A1/g, r: 'á' },
        { s: /\u00C3\u00B3/g, r: 'ó' },
        { s: /\u00C3\u00AA/g, r: 'ê' },
        { s: /\u00C3\u00A7/g, r: 'ç' },
        { s: /\u00C3\u00A3/g, r: 'ã' },
        { s: /\u00C3\u00A0/g, r: 'à' },
        { s: /\u00C3\u00B5/g, r: 'õ' },
        { s: /\u00C3\u00BA/g, r: 'ú' },
        { s: /\u00C3\u00AD/g, r: 'í' },
        { s: /\u00C3\u0089/g, r: 'É' },
        { s: /\u00C3\u0081/g, r: 'Á' },
        { s: /\u00C3\u0093/g, r: 'Ó' },
        { s: /\u00C3\u0087/g, r: 'Ç' },
        { s: /\u00C3\u0095/g, r: 'Õ' },
        { s: /\u00C3\u009A/g, r: 'Ú' },
        { s: /\u00C3\u008D/g, r: 'Í' },
        { s: /\u00C0--/g, r: 'x' },
        { s: /Observaces/g, r: 'Observações' },
        { s: /movimentaces/g, r: 'movimentações' },
        { s: /manifestá/g, r: 'manifesto' },
        { s: /inventrio/g, r: 'inventário' },
        { s: /prescriptionNão/g, r: 'prescriptionNumber' }
    ];

    let log = 'Repair Started\n';
    function walk(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                    walk(fullPath);
                }
            } else if (/\.(tsx|ts|css)$/.test(file)) {
                let content = fs.readFileSync(fullPath, 'utf8');
                let modified = false;
                patterns.forEach(p => {
                    if (p.s.test(content)) {
                        content = content.replace(p.s, p.r);
                        modified = true;
                    }
                });
                if (modified) {
                    fs.writeFileSync(fullPath, content, 'utf8');
                    log += `Fixed: ${fullPath}\n`;
                }
            }
        }
    }

    walk(srcPath);
    fs.writeFileSync('repair_log.txt', log + 'Repair Finished');
} catch (e) {
    fs.writeFileSync('repair_error.txt', e.stack);
}
