// src/adapters/vunesp.ts
import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Coleta provas antigas da Vunesp
 */
export async function harvestVunesp(): Promise<HarvestItem[]> {
  console.log('[Vunesp] Iniciando coleta...');
  const items: HarvestItem[] = [];
  
  try {
    const baseUrl = 'https://www.vunesp.com.br';
    const urls = [
      `${baseUrl}/concursos`,
      `${baseUrl}/concursos-encerrados`,
    ];
    
    for (const url of urls) {
      try {
        console.log(`[Vunesp] Buscando ${url}...`);
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        
        // Buscar links de concursos
        $('a[href*="/concurso"], a[href*="/prova"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim();
          
          if (href && title && title.length > 10) {
            const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
            
            if (!items.find(item => item.url === fullUrl)) {
              items.push({
                url: fullUrl,
                title,
                content: title,
                meta: {
                  fonte: 'Vunesp',
                  tipo: 'concurso',
                  banca: 'Vunesp',
                },
              });
            }
          }
        });
        
        // Buscar PDFs de provas
        $('a[href$=".pdf"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim() || $(el).attr('title') || 'Prova Vunesp';
          
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
            
            if (!items.find(item => item.url === fullUrl)) {
              items.push({
                url: fullUrl,
                title,
                content: `PDF: ${title}`,
                meta: {
                  fonte: 'Vunesp',
                  tipo: 'pdf_prova',
                  banca: 'Vunesp',
                },
              });
            }
          }
        });
      } catch (err) {
        console.error(`[Vunesp] Erro ao processar ${url}:`, err);
      }
    }
    
    console.log(`[Vunesp] Coletados ${items.length} itens`);
    return items;
  } catch (error) {
    console.error('[Vunesp] Erro geral:', error);
    return items;
  }
}
