/**
 * Adaptador Cesgranrio
 * 
 * Coleta editais de concursos públicos do site oficial da Cesgranrio
 * Site: https://www.cesgranrio.org.br/concursos
 * 
 * Banca: Centro de Seleção de Candidatos ao Ensino Superior do Grande Rio
 * Cobertura: Nacional
 * Tipo: Banca organizadora
 */

import { fetchHTML } from './fetch.js';
import * as cheerio from 'cheerio';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Coleta concursos da Cesgranrio
 */
export async function harvestCesgranrio(): Promise<HarvestItem[]> {
  console.log('[Cesgranrio] Iniciando coleta...');
  const items: HarvestItem[] = [];

  try {
    const baseUrl = 'https://www.cesgranrio.org.br';
    const urls = [
      `${baseUrl}/concursos/principal.aspx`,
      `${baseUrl}/concursos`,
      `${baseUrl}/categoria/concursos`
    ];

    for (const url of urls) {
      try {
        console.log(`[Cesgranrio] Buscando ${url}...`);
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);

        // Buscar cards de concursos
        $('.concurso, .item-concurso, [class*="concurso"]').each((_, element) => {
          try {
            const $card = $(element);
            
            const title = $card.find('h2, h3, h4, .titulo, .nome').text().trim();
            const link = $card.find('a').attr('href');

            if (title && link) {
              const fullUrl = link.startsWith('http') ? link : `${baseUrl}${link}`;
              
              if (!items.find(item => item.url === fullUrl)) {
                items.push({
                  url: fullUrl,
                  title: title,
                  content: `Concurso: ${title}\nBanca: Cesgranrio`,
                  meta: {
                    banca: 'Cesgranrio',
                    tipo: 'concurso',
                    fonte: url
                  }
                });
              }
            }
          } catch (err) {
            console.error('[Cesgranrio] Erro ao processar card:', err);
          }
        });

        // Buscar links gerais
        $('a[href*="concurso"]').each((_, element) => {
          try {
            const $link = $(element);
            const href = $link.attr('href');
            const text = $link.text().trim();

            if (href && text && text.length > 10) {
              const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
              
              if (!items.find(item => item.url === fullUrl)) {
                items.push({
                  url: fullUrl,
                  title: text,
                  content: text,
                  meta: {
                    banca: 'Cesgranrio',
                    tipo: 'concurso',
                    fonte: url
                  }
                });
              }
            }
          } catch (err) {
            console.error('[Cesgranrio] Erro ao processar link:', err);
          }
        });

      } catch (err: any) {
        console.error(`[Cesgranrio] Erro ao processar ${url}:`, err.message);
      }
    }

    console.log(`[Cesgranrio] Coletados ${items.length} itens`);
    return items;

  } catch (error: any) {
    console.error('[Cesgranrio] Erro geral:', error.message);
    return items;
  }
}
