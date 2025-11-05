// src/jobs/harvest.ts
import { harvestFGV } from '../adapters/fgv.js';
import { harvestCebraspe } from '../adapters/ceb.js';
import { query } from '../db/index.js';
import { isDuplicate } from '../pipeline/dedupe.js';
import { detectPII } from '../compliance/pii-detector.js';
export async function runAll() {
    console.log('🚀 Iniciando coleta do Harvester');
    const result = {
        total: 0,
        new: 0,
        duplicates: 0,
        errors: 0,
        sources: [],
    };
    const sources = [
        { name: 'FGV', fn: harvestFGV },
        { name: 'CESPE', fn: harvestCebraspe },
    ];
    for (const { name, fn } of sources) {
        try {
            console.log(`📥 Coletando de ${name}...`);
            result.sources.push(name);
            const items = await fn();
            result.total += items.length;
            for (const item of items) {
                try {
                    const { dup, hash } = await isDuplicate(name, item.content || item.title);
                    if (dup) {
                        result.duplicates++;
                        continue;
                    }
                    const piiResult = detectPII(item.content || item.title);
                    const piiFlags = piiResult.matches.map(m => ({
                        type: m.type,
                        confidence: m.confidence,
                    }));
                    let license = 'unknown';
                    if (name === 'FGV' || name === 'CESPE') {
                        license = 'public_domain';
                    }
                    await query(`INSERT INTO harvest_items 
             (source, url, title, content_text, hash, license, pii_flags, meta, status, fetched_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT (source, url) DO NOTHING`, [
                        name,
                        item.url,
                        item.title,
                        item.content,
                        hash,
                        license,
                        JSON.stringify(piiFlags),
                        JSON.stringify(item.meta),
                        'fetched',
                    ]);
                    result.new++;
                }
                catch (err) {
                    result.errors++;
                    console.error(`Erro ao processar item:`, err);
                }
            }
        }
        catch (err) {
            result.errors++;
            console.error(`Erro ao coletar de ${name}:`, err);
        }
    }
    console.log(`📊 Resumo: ${result.total} total, ${result.new} novos, ${result.duplicates} duplicados, ${result.errors} erros`);
    return result;
}
if (process.argv[1]?.endsWith('harvest.js') || process.argv[1]?.endsWith('harvest.ts')) {
    runAll().catch(e => { console.error(e); process.exit(1); });
}
