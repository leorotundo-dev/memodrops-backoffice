
import * as cheerio from 'cheerio';
import { fetchHTML } from '../fetch';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Adaptador Instituto AOCP
 * Site: https://www.institutoaocp.org.br/concursos.jsp
 * Tipo: banca
 */
export async function harvestAOCP(): Promise<HarvestItem[]> {
  console.log('[AOCP] Iniciando coleta...');
  const items: HarvestItem[] = [];
  const base = 'https://www.institutoaocp.org.br';
  const urls = [`${base}/concursos.jsp`, `${base}/concursos.jsp?page=2`, `${base}/concursos.jsp?page=3`];

  for (const url of urls) {
    try {
      const html = await fetchHTML(url);
      const $ = cheerio.load(html);

      $('.conteudo, .concurso, article, .box').each((_, el) => {
        const a = $(el).find('a[href*="concurso"], a[href*="edital"], a').first();
        const link = a.attr('href') || '';
        let title = a.text().trim();
        if (!title) title = $(el).find('h2, h3').first().text().trim();
        if (!link || !title) return;

        const fullUrl = link.startsWith('http') ? link : `${base}${link}`;
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (/apostila|curso|preparatório/i.test(text)) return; // filtrar irrelevantes

        const vagas = text.match(/(\d+)\s*vaga/i)?.[1];
        const salario = text.match(/R\$\s*[\d.,]+/i)?.[0];

        if (!items.find(i => i.url === fullUrl)) {
          items.push({
            url: fullUrl,
            title,
            content: text.slice(0, 500),
            meta: { fonte: 'AOCP', vagas, salario }
          });
        }
      });
    } catch (e: any) {
      console.error('[AOCP] Erro:', e.message);
    }
  }
  console.log(`[AOCP] Coletados ${items.length} itens`);
  return items;
}
