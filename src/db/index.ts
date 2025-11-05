// src/db/index.ts
import { Pool } from 'pg';
import 'dotenv/config';
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 10
});
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try { const res = await client.query(text, params); return res; }
  finally { client.release(); }
}
export async function tx(fn: (c: any)=> Promise<void>) {
  const client = await pool.connect();
  try { await client.query('begin'); await fn(client); await client.query('commit'); }
  catch(e){ await client.query('rollback'); throw e; }
  finally { client.release(); }
}
