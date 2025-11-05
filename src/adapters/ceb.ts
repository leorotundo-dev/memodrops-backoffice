// src/adapters/ceb.ts
import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';
import type { HarvestItem } from './fgv.js';

export async function harvestCebraspe(): Promise<HarvestItem[]> {
  console.log('[CESPE] Iniciando coleta...');
  const items: HarvestItem[] = [];
  
  try {
    const listingUrls = ['https://www.cebraspe.org.br/concursos'];
    
    for (const listingUrl of listingUrls) {
      try {
        console.log(`[CESPE] Buscando ${listingUrl}...`);
        const html = await fetchHTML(listingUrl);
        const $ = cheerio.load(html);
        
        $('a[href*="concurso"], a[href*="edital"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim();
          
          if (href && title && title.length > 5) {
            const fullUrl = href.startsWith('http') ? href : `https://www.cebraspe.org.br${href}`;
            items.push({
              url: fullUrl,
              title,
              content: title,
              meta: { banca: 'CESPE/CEBRASPE', tipo: 'concurso', fonte: listingUrl },
            });
          }
        });
        
        $('a[href$=".pdf"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim() || 'Prova CESPE';
          
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `https://www.cebraspe.org.br${href}`;
            items.push({
              url: fullUrl,
              title,
              content: `PDF: ${title}`,
              meta: { banca: 'CESPE/CEBRASPE', tipo: 'pdf', fonte: listingUrl },
            });
          }
        });
      } catch (err) {
        console.error(`[CESPE] Erro ao processar ${listingUrl}:`, err);
      }
    }
    
    console.log(`[CESPE] Coletados ${items.length} itens`);
    return items;
  } catch (error) {
    console.error('[CESPE] Erro geral na coleta:', error);
    return items;
  }
}
