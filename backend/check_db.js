import dotenv from 'dotenv';
import { Client } from 'pg';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const url = process.env.DATABASE_URL;
console.log('DATABASE_URL found:', url ? 'Yes' : 'No');

if (url) {
    const client = new Client({ connectionString: url });
    client.connect()
        .then(() => {
            console.log('Successfully connected to database!');
            return client.end();
        })
        .catch(err => {
            console.error('Failed to connect to database:', err.message);
            process.exit(1);
        });
} else {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
}
