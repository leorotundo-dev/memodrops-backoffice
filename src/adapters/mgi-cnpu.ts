import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}
/**
 * Adaptador MGI (Concurso Nacional Unificado)
 * Site: https://www.gov.br/gestao/pt-br/concursonacional
 * Tipo: federal
 */
export async function harvestMGICNPU(): Promise<HarvestItem[]> {
  console.log('[MGI/CNPU] Iniciando coleta...');
  const items: HarvestItem[] = [];
  const url = 'https://www.gov.br/gestao/pt-br/concursonacional';

  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    $('article, .tileItem, .list-item, a[href]').each((_, el) => {
      const a = $(el).find('a[href]').first();
      const link = a.attr('href') || '';
      let title = a.text().trim() || $(el).find('h2, h3').text().trim();
      if (!link || !title) return;

      const fullUrl = link.startsWith('http') ? link : `https://www.gov.br${link}`;
      const text = $(el).text().replace(/\s+/g, ' ').trim();

      if (!items.find(i => i.url === fullUrl)) {
        items.push({ url: fullUrl, title, content: text.slice(0, 600), meta: { fonte: 'MGI/CNPU' } });
      }
    });
  } catch (e:any) {
    console.error('[MGI/CNPU] Erro:', e.message);
  }
  console.log(`[MGI/CNPU] Coletados ${items.length} itens`);
  return items;
}
