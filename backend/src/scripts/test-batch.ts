import axios from 'axios';

const API_URL = 'http://localhost:3000/api';
const TOKEN = 'YOUR_TOKEN_HERE'; // I need a token, but I don't have one easily.

async function testCreateBatch() {
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
    } catch (err: any) {
        console.error('Error:', err.response?.status, err.response?.data);
    }
}
