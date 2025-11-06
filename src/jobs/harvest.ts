// src/jobs/harvest.ts
import { harvestFGV } from '../adapters/fgv.js';
import { harvestCebraspe } from '../adapters/ceb.js';
import { harvestDOU } from '../adapters/dou.js';
import { harvestPlanalto } from '../adapters/planalto.js';
import { harvestCamara } from '../adapters/camara.js';
import { harvestLexML } from '../adapters/lexml.js';
import { harvestFCC } from '../adapters/fcc.js';
import { harvestVunesp } from '../adapters/vunesp.js';
import { harvestQuadrix } from '../adapters/quadrix.js';
import { harvestPCI } from '../adapters/pci.js';
import { query } from '../db/index.js';
import { isDuplicate } from '../pipeline/dedupe.js';
import { detectPII } from '../compliance/pii-detector.js';

interface HarvestResult {
  total: number;
  new: number;
  duplicates: number;
  errors: number;
  sources: string[];
}

export async function runAll(): Promise<HarvestResult> {
  console.log('🚀 Iniciando coleta do Harvester');
  
  const result: HarvestResult = {
    total: 0,
    new: 0,
    duplicates: 0,
    errors: 0,
    sources: [],
  };
  
  const sources = [
    { name: 'DOU', fn: harvestDOU },
    { name: 'Planalto', fn: harvestPlanalto },
    { name: 'Câmara', fn: harvestCamara },
    { name: 'LexML', fn: harvestLexML },
    { name: 'FGV', fn: harvestFGV },
    { name: 'CESPE', fn: harvestCebraspe },
    { name: 'FCC', fn: harvestFCC },
    { name: 'Vunesp', fn: harvestVunesp },
    { name: 'Quadrix', fn: harvestQuadrix },
    { name: 'PCI', fn: harvestPCI },
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
          if (name === 'DOU' || name === 'Planalto' || name === 'Câmara' || name === 'LexML' || name === 'FGV' || name === 'CESPE' || name === 'FCC' || name === 'Vunesp' || name === 'Quadrix' || name === 'PCI') {
            license = 'public_domain';
          }
          
          await query(
            `INSERT INTO harvest_items 
             (source, url, title, content_text, hash, license, pii_flags, meta, status, fetched_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             ON CONFLICT (source, url) DO NOTHING`,
            [
              name,
              item.url,
              item.title,
              item.content,
              hash,
              license,
              JSON.stringify(piiFlags),
              JSON.stringify(item.meta),
              'fetched',
            ]
          );
          
          result.new++;
        } catch (err) {
          result.errors++;
          console.error(`Erro ao processar item:`, err);
        }
      }
    } catch (err) {
      result.errors++;
      console.error(`Erro ao coletar de ${name}:`, err);
    }
  }
  
  console.log(`📊 Resumo: ${result.total} total, ${result.new} novos, ${result.duplicates} duplicados, ${result.errors} erros`);
  return result;
}

if (process.argv[1]?.endsWith('harvest.js') || process.argv[1]?.endsWith('harvest.ts')){
  runAll().catch(e => { console.error(e); process.exit(1); });
}
