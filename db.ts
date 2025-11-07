import 'dotenv/config';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL não definida!');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function query<T = any>(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const ms = Date.now() - start;
    console.log(`[db] ${text.split('\n')[0]} - ${ms}ms`);
    return res;
  } catch (err: any) {
    console.error('[db] ERRO:', err?.message || err);
    throw err;
  }
}