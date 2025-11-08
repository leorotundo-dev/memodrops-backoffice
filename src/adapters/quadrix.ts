/**
 * Adaptador Quadrix
 * 
 * Coleta editais de concursos públicos do site oficial da Quadrix
 * Site: https://www.quadrix.org.br/
 * 
 * Banca: Instituto Quadrix
 * Cobertura: Nacional
 * Tipo: Banca organizadora
 */

import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Coleta concursos da Quadrix
 */
export async function harvestQuadrix(): Promise<HarvestItem[]> {
  console.log('[Quadrix] Iniciando coleta...');
  const items: HarvestItem[] = [];
  
  try {
    const baseUrl = 'https://www.quadrix.org.br';
    const urls = [
      `${baseUrl}/`,
      `${baseUrl}/concursos.aspx`,
      `${baseUrl}/todos-os-concursos.aspx`,
      `${baseUrl}/concursos-anteriores.aspx`,
      'https://site.quadrix.org.br/'
    ];
    
    for (const url of urls) {
      try {
        console.log(`[Quadrix] Buscando ${url}...`);
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        
        // Buscar cards de concursos
        $('.concurso, .item-concurso, [class*="concurso"]').each((_, el) => {
          try {
            const $card = $(el);
            const title = $card.find('h2, h3, h4, .titulo, .nome').text().trim();
            const link = $card.find('a').attr('href');

            if (title && link) {
              // Garantir que há uma barra entre baseUrl e link
              const separator = link.startsWith('/') ? '' : '/';
              const fullUrl = link.startsWith('http') ? link : `${baseUrl}${separator}${link}`;
              
              if (!items.find(item => item.url === fullUrl)) {
                items.push({
                  url: fullUrl,
                  title,
                  content: `Concurso: ${title}\nBanca: Quadrix`,
                  meta: {
                    banca: 'Quadrix',
                    tipo: 'concurso',
                    fonte: url
                  }
                });
              }
            }
          } catch (err) {
            console.error('[Quadrix] Erro ao processar card:', err);
          }
        });
        
        // Buscar links de concursos
        $('a[href*="concurso"], a[href*="prova"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim();
          
          if (href && title && title.length > 10) {
            // Garantir que há uma barra entre baseUrl e href
            const separator = href.startsWith('/') ? '' : '/';
            const fullUrl = href.startsWith('http') ? href : `${baseUrl}${separator}${href}`;
            
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
        
        // Buscar PDFs de editais e provas
        $('a[href$=".pdf"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim() || $(el).attr('title') || 'Documento Quadrix';
          
          if (href && (
            title.toLowerCase().includes('edital') ||
            title.toLowerCase().includes('prova') ||
            title.toLowerCase().includes('retificação')
          )) {
            // Garantir que há uma barra entre baseUrl e href
            const separator = href.startsWith('/') ? '' : '/';
            const fullUrl = href.startsWith('http') ? href : `${baseUrl}${separator}${href}`;
            
            if (!items.find(item => item.url === fullUrl)) {
              items.push({
                url: fullUrl,
                title,
                content: `PDF: ${title}`,
                meta: {
                  fonte: 'Quadrix',
                  tipo: 'pdf',
                  banca: 'Quadrix',
                },
              });
            }
          }
        });
      } catch (err: any) {
        console.error(`[Quadrix] Erro ao processar ${url}:`, err.message);
      }
    }
    
    console.log(`[Quadrix] Coletados ${items.length} itens`);
    return items;
  } catch (error: any) {
    console.error('[Quadrix] Erro geral:', error.message);
    return items;
  }
}
