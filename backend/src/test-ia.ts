import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const testN8N = async () => {
    const url = process.env.N8N_WEBHOOK_URL;
    console.log('Testando URL do n8n:', url);
    try {
        const res = await axios.post(url!, { message: 'Teste', companyId: 'test' }, { timeout: 5000 });
        console.log('Resposta n8n (Status):', res.status);
        console.log('Dados:', res.data);
    } catch (err: any) {
        console.error('Erro ao conectar com n8n:', err.message);
        if (err.response) console.error('Status:', err.response.status, 'Dados:', err.response.data);
    }
};

const testGemini = async () => {
    const key = process.env.GEMINI_API_KEY;
    console.log('Testando Gemini (Key presente):', !!key);
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
        const res = await axios.post(url, {
            contents: [{ parts: [{ text: 'Olá' }] }]
        });
        console.log('Resposta Gemini (Status):', res.status);
    } catch (err: any) {
        console.error('Erro Gemini:', err.message);
        if (err.response) console.error('Status:', err.response.status, 'Dados:', err.response.data);
    }
};

(async () => {
    await testN8N();
    console.log('---');
    await testGemini();
})();
