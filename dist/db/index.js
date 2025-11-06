// src/db/index.ts
import { Pool } from 'pg';
import 'dotenv/config';
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10
});
export async function query(text, params) {
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        return res;
    }
    finally {
        client.release();
    }
}
export async function tx(fn) {
    const client = await pool.connect();
    try {
        await client.query('begin');
        await fn(client);
        await client.query('commit');
    }
    catch (e) {
        await client.query('rollback');
        throw e;
    }
    finally {
        client.release();
    }
}
