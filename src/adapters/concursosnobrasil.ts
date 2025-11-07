import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Adaptador Concursos no Brasil (agregador)
 * Site: https://concursosnobrasil.com/
 * Tipo: agregador
 */
export async function harvestConcursosNoBrasil(): Promise<HarvestItem[]> {
  console.log('[CnB] Iniciando coleta...');
  const items: HarvestItem[] = [];
  const base = 'https://concursosnobrasil.com/';

  try {
    const html = await fetchHTML(base);
    const $ = cheerio.load(html);

    $('article, .card, .concurso, a[href*="/concursos/"]').each((_, el) => {
      const a = $(el).find('a[href]').first();
      const link = a.attr('href') || '';
      const title = a.text().trim() || $(el).find('h3, h2').text().trim();
      if (!link || !title) return;

      const fullUrl = link.startsWith('http') ? link : (link.startsWith('/') ? `https://concursosnobrasil.com${link}` : `${base}${link}`);
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (/apostila|curso|preparatório/i.test(text)) return;

      const vagas = text.match(/(\d+)\s*vaga/i)?.[1];
      const salario = text.match(/R\$\s*[\d.,]+/i)?.[0];

      if (!items.find(i => i.url === fullUrl)) {
        items.push({ url: fullUrl, title, content: text.slice(0, 500), meta: { fonte: 'Concursos no Brasil', vagas, salario } });
      }
    });
  } catch (e:any) {
    console.error('[CnB] Erro:', e.message);
  }
  console.log(`[CnB] Coletados ${items.length} itens`);
  return items;
}
