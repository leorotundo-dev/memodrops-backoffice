// src/adapters/fgv.ts
import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

export async function harvestFGV(): Promise<HarvestItem[]> {
  console.log('[FGV] Iniciando coleta...');
  const items: HarvestItem[] = [];
  
  try {
    const listingUrls = ['https://conhecimento.fgv.br/concursos'];
    
    for (const listingUrl of listingUrls) {
      try {
        console.log(`[FGV] Buscando ${listingUrl}...`);
        const html = await fetchHTML(listingUrl);
        const $ = cheerio.load(html);
        
        $('a[href*="concurso"], a[href*="prova"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim();
          
          if (href && title && title.length > 5) {
            const fullUrl = href.startsWith('http') ? href : `https://conhecimento.fgv.br${href}`;
            items.push({
              url: fullUrl,
              title,
              content: title,
              meta: { banca: 'FGV', tipo: 'concurso', fonte: listingUrl },
            });
          }
        });
        
        $('a[href$=".pdf"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim() || $(el).attr('title') || 'Prova FGV';
          
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `https://conhecimento.fgv.br${href}`;
            items.push({
              url: fullUrl,
              title,
              content: `PDF: ${title}`,
              meta: { banca: 'FGV', tipo: 'pdf', fonte: listingUrl },
            });
          }
        });
      } catch (err) {
        console.error(`[FGV] Erro ao processar ${listingUrl}:`, err);
      }
    }
    
    console.log(`[FGV] Coletados ${items.length} itens`);
    return items;
  } catch (error) {
    console.error('[FGV] Erro geral na coleta:', error);
    return items;
  }
}
