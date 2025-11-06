// src/adapters/pci.ts
import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Coleta provas antigas do PCI Concursos
 */
export async function harvestPCI(): Promise<HarvestItem[]> {
  console.log('[PCI] Iniciando coleta...');
  const items: HarvestItem[] = [];
  
  try {
    const baseUrl = 'https://www.pciconcursos.com.br';
    const urls = [
      `${baseUrl}/provas/`,
      `${baseUrl}/provas/federais`,
      `${baseUrl}/provas/estaduais`,
    ];
    
    for (const url of urls) {
      try {
        console.log(`[PCI] Buscando ${url}...`);
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        
        // Buscar links de provas
        $('a[href*="/prova/"]').each((_, el) => {
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
                  fonte: 'PCI Concursos',
                  tipo: 'prova',
                },
              });
            }
          }
        });
        
        // Buscar PDFs de provas
        $('a[href$=".pdf"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim() || $(el).attr('title') || 'Prova PCI';
          
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
            
            if (!items.find(item => item.url === fullUrl)) {
              items.push({
                url: fullUrl,
                title,
                content: `PDF: ${title}`,
                meta: {
                  fonte: 'PCI Concursos',
                  tipo: 'pdf_prova',
                },
              });
            }
          }
        });
      } catch (err) {
        console.error(`[PCI] Erro ao processar ${url}:`, err);
      }
    }
    
    console.log(`[PCI] Coletados ${items.length} itens`);
    return items;
  } catch (error) {
    console.error('[PCI] Erro geral:', error);
    return items;
  }
}
