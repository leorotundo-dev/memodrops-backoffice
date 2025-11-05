// src/pipeline/dedupe.ts
import { query } from '../db/index.js';
import { hashText } from './utils.js';
export async function isDuplicate(source, text) {
    const h = hashText((text || '').trim());
    const { rows } = await query('select 1 from harvest_items where source=$1 and hash=$2 limit 1', [source, h]);
    return { dup: rows.length > 0, hash: h };
}
