
import * as cheerio from 'cheerio';
import { fetchHTML } from '../fetch.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Adaptador FGD
 * Site: https://fgd.org.br/
 * Tipo: banca
 */
export async function harvestFGD(): Promise<HarvestItem[]> {
  console.log('[FGD] Iniciando coleta...');
  const items: HarvestItem[] = [];
  const base = 'https://fgd.org.br';
  const url = base + '/';

  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    $('a[href*="concurso"], a[href*="edital"], article, .card').each((_, el) => {
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
        items.push({ url: fullUrl, title, content: text.slice(0, 500), meta: { fonte: 'FGD', vagas, salario } });
      }
    });
  } catch (e:any) {
    console.error('[FGD] Erro:', e.message);
  }
  console.log(`[FGD] Coletados ${items.length} itens`);
  return items;
}
