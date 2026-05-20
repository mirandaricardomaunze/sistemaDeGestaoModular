import axios, { AxiosError } from 'axios';

const API_URL = 'http://localhost:3000/api';
const TOKEN = 'YOUR_TOKEN_HERE'; // I need a token, but I don't have one easily.

async function runTestCreateBatch() {
    try {
        const res = await axios.post(`${API_URL}/batches`, {
            batchNumber: 'TEST-' + Date.now(),
            productId: 'some-id',
            quantity: 10,
            receivedDate: new Date().toISOString()
        }, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });
        console.log('Success:', res.data);
    } catch (err) {
        const e = err as AxiosError;
        console.error('Error:', e.response?.status, e.response?.data);
    }
}

runTestCreateBatch();
