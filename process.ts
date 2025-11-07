import 'dotenv/config';
import { query } from '../lib/db';
import { extractStructure } from '../lib/openai';
import cron from 'node-cron';
import fetch from 'node-fetch';

const MIN_LEN = Number(process.env.MIN_CONTENT_LENGTH || 100);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 25);
const PORT = process.env.PORT || '8080';
const BASE_URL = process.env.HARVESTER_BASE_URL || `http://127.0.0.1:${PORT}`;

type HarvestItem = {
  id: number;
  status: string;
  content_text: string | null;
  source_url?: string | null;
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function runProcessingOnce() {
  console.log('[process] Iniciando processamento…');

  const { rows: items } = await query<HarvestItem>(`
    SELECT id, status, content_text, source_url
    FROM harvest_items
    WHERE status = 'fetched' AND content_text IS NOT NULL
      AND length(content_text) >= $1
    ORDER BY id ASC
    LIMIT 1000;
  `, [MIN_LEN]);

  if (!items.length) {
    console.log('[process] Nenhum item elegível para processamento.');
    return { processed: 0 };
  }

  console.log(`[process] ${items.length} itens a processar…`);

  const groups = chunk(items, BATCH_SIZE);
  let ok = 0, fail = 0;

  for (const batch of groups) {
    await Promise.all(batch.map(async (item) => {
      try {
        await query('UPDATE harvest_items SET status = $2 WHERE id = $1', [item.id, 'processing']);
        const payload = await extractStructure(item.content_text!);
        const res = await fetch(`${BASE_URL}/api/harvester/ingest`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            itemId: item.id,
            sourceUrl: item.source_url || null,
            extracted: payload
          })
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Ingest falhou: ${res.status} - ${body}`);
        }
        await query('UPDATE harvest_items SET status = $2 WHERE id = $1', [item.id, 'stored']);
        console.log(`[process] OK item ${item.id}`);
      } catch (err: any) {
        console.error(`[process] ERRO item ${item.id}:`, err?.message || err);
        try { await query('UPDATE harvest_items SET status = $2 WHERE id = $1', [item.id, 'error']); } catch {}
        fail++;
      }
    }));
  }

  const processed = items.length - fail;
  console.log(`[process] Concluído. Sucesso: ${processed} | Falhas: ${fail}`);
  return { processed, failed: fail };
}

export function startCron() {
  const expr = process.env.CRON_EXPR || '*/30 * * * *';
  cron.schedule(expr, async () => {
    try {
      await runProcessingOnce();
    } catch (e: any) {
      console.error('[cron] erro', e?.message || e);
    }
  });
  console.log(`[cron] agendado: ${process.env.CRON_EXPR || '*/30 * * * *'}`);
}