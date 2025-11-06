// src/adapters/quadrix.ts
import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Coleta provas antigas da Quadrix
 */
export async function harvestQuadrix(): Promise<HarvestItem[]> {
  console.log('[Quadrix] Iniciando coleta...');
  const items: HarvestItem[] = [];
  
  try {
    const baseUrl = 'https://www.quadrix.org.br';
    const urls = [
      `${baseUrl}/concursos.aspx`,
      `${baseUrl}/concursos-anteriores.aspx`,
    ];
    
    for (const url of urls) {
      try {
        console.log(`[Quadrix] Buscando ${url}...`);
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        
        // Buscar links de concursos
        $('a[href*="concurso"], a[href*="prova"]').each((_, el) => {
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
                  fonte: 'Quadrix',
                  tipo: 'concurso',
                  banca: 'Quadrix',
                },
              });
            }
          }
        });
        
        // Buscar PDFs de provas
        $('a[href$=".pdf"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim() || $(el).attr('title') || 'Prova Quadrix';
          
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
            
            if (!items.find(item => item.url === fullUrl)) {
              items.push({
                url: fullUrl,
                title,
                content: `PDF: ${title}`,
                meta: {
                  fonte: 'Quadrix',
                  tipo: 'pdf_prova',
                  banca: 'Quadrix',
                },
              });
            }
          }
        });
      } catch (err) {
        console.error(`[Quadrix] Erro ao processar ${url}:`, err);
      }
    }
    
    console.log(`[Quadrix] Coletados ${items.length} itens`);
    return items;
  } catch (error) {
    console.error('[Quadrix] Erro geral:', error);
    return items;
  }
}
