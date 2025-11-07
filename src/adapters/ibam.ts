
import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Adaptador IBAM
 * Site: https://www.ibam.org.br/concursos
 * Tipo: banca
 */
export async function harvestIBAM(): Promise<HarvestItem[]> {
  console.log('[IBAM] Iniciando coleta...');
  const items: HarvestItem[] = [];
  const base = 'https://www.ibam.org.br';
  const url = `${base}/concursos`;

  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    $('a[href*="concurso"], a[href*="edital"], article, .card, table tr').each((_, el) => {
      const a = $(el).find('a[href]').first();
      const link = a.attr('href') || '';
      const title = a.text().trim() || $(el).find('h3, h2').text().trim();
      if (!link || !title) return;
      const fullUrl = link.startsWith('http') ? link : `${base}${link}`;
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (/apostila|curso|preparatório/i.test(text)) return;
      const vagas = text.match(/(\d+)\s*vaga/i)?.[1];
      const salario = text.match(/R\$\s*[\d.,]+/i)?.[0];

      if (!items.find(i => i.url === fullUrl)) {
        items.push({ url: fullUrl, title, content: text.slice(0, 500), meta: { fonte: 'IBAM', vagas, salario } });
      }
    });
  } catch (e:any) {
    console.error('[IBAM] Erro:', e.message);
  }
  console.log(`[IBAM] Coletados ${items.length} itens`);
  return items;
}
