// src/adapters/fcc.ts
import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Coleta provas antigas da FCC (Fundação Carlos Chagas)
 */
export async function harvestFCC(): Promise<HarvestItem[]> {
  console.log('[FCC] Iniciando coleta...');
  const items: HarvestItem[] = [];
  
  try {
    const baseUrl = 'https://www.concursosfcc.com.br';
    const urls = [
      `${baseUrl}/concursos`,
      `${baseUrl}/concursos/encerrados`,
    ];
    
    for (const url of urls) {
      try {
        console.log(`[FCC] Buscando ${url}...`);
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
                  fonte: 'FCC',
                  tipo: 'concurso',
                  banca: 'FCC',
                },
              });
            }
          }
        });
        
        // Buscar PDFs de provas
        $('a[href$=".pdf"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim() || $(el).attr('title') || 'Prova FCC';
          
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
            
            if (!items.find(item => item.url === fullUrl)) {
              items.push({
                url: fullUrl,
                title,
                content: `PDF: ${title}`,
                meta: {
                  fonte: 'FCC',
                  tipo: 'pdf_prova',
                  banca: 'FCC',
                },
              });
            }
          }
        });
      } catch (err) {
        console.error(`[FCC] Erro ao processar ${url}:`, err);
      }
    }
    
    console.log(`[FCC] Coletados ${items.length} itens`);
    return items;
  } catch (error) {
    console.error('[FCC] Erro geral:', error);
    return items;
  }
}
