const fs = require('fs');
let content = fs.readFileSync('c:/Users/miran/Desktop/sistemas/src/pages/Login.tsx', 'utf8');
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');
fs.writeFileSync('c:/Users/miran/Desktop/sistemas/src/pages/Login.tsx', content);

let contentRegister = fs.readFileSync('c:/Users/miran/Desktop/sistemas/src/pages/Register.tsx', 'utf8');
contentRegister = contentRegister.replace(/\\`/g, '`');
contentRegister = contentRegister.replace(/\\\$/g, '$');
fs.writeFileSync('c:/Users/miran/Desktop/sistemas/src/pages/Register.tsx', contentRegister);

console.log('Fixed backslashes in Login.tsx and Register.tsx');
