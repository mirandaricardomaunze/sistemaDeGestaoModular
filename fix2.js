const fs = require('fs');

function fixFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace all literal \` with `
    content = content.split('\\`').join('`');
    
    // Replace all literal \$ with $
    content = content.split('\\$').join('$');
    
    fs.writeFileSync(file, content);
    console.log('Fixed: ' + file);
}

fixFile('c:/Users/miran/Desktop/sistemas/src/pages/Login.tsx');
fixFile('c:/Users/miran/Desktop/sistemas/src/pages/Register.tsx');
