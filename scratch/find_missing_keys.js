import fs from 'fs';
import path from 'path';

const ptJsonPath = 'c:/Users/miran/Desktop/sistemas/src/i18n/locales/pt.json';
const ptJson = JSON.parse(fs.readFileSync(ptJsonPath, 'utf8'));

const directories = [
    'c:/Users/miran/Desktop/sistemas/src/pages/logistics',
    'c:/Users/miran/Desktop/sistemas/src/components/logistics',
    'c:/Users/miran/Desktop/sistemas/src/components/logistics/hr'
];

function getKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(getKeys(obj[key], prefix + key + '.'));
        } else {
            keys.push(prefix + key);
        }
    }
    return keys;
}

const availableKeys = new Set(getKeys(ptJson));
console.log(`Loaded ${availableKeys.size} keys from pt.json`);

const missingKeys = {};

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = /t\(['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        if (!availableKeys.has(key)) {
            if (!missingKeys[filePath]) missingKeys[filePath] = new Set();
            missingKeys[filePath].add(key);
        }
    }
}

function scanDir(dirPath) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            scanFile(fullPath);
        }
    }
}

directories.forEach(scanDir);

for (const file in missingKeys) {
    console.log(`File: ${file}`);
    missingKeys[file].forEach(key => console.log(`  - ${key}`));
}
