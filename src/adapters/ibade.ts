/**
 * Adaptador IBADE
 * 
 * Coleta editais de concursos públicos do site oficial do IBADE
 * Site: https://ibade.org.br/concursos
 * 
 * Banca: Instituto Brasileiro de Apoio e Desenvolvimento Executivo
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
 * Coleta concursos do IBADE
 */
export async function harvestIBADE(): Promise<HarvestItem[]> {
  console.log('[IBADE] Iniciando coleta...');
  const items: HarvestItem[] = [];

  try {
    const baseUrl = 'https://ibade.org.br';
    const urls = [
      `${baseUrl}/`,
      `${baseUrl}/concursos/`,
      `${baseUrl}/concursos/inscricoes-abertas`,
      `${baseUrl}/concursos/em-andamento`
    ];

    for (const url of urls) {
      try {
        console.log(`[IBADE] Buscando ${url}...`);
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
                  content: `Concurso: ${title}\nBanca: IBADE`,
                  meta: {
                    banca: 'IBADE',
                    tipo: 'concurso',
                    fonte: url
                  }
                });
              }
            }
          } catch (err) {
            console.error('[IBADE] Erro ao processar card:', err);
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
                    banca: 'IBADE',
                    tipo: 'concurso',
                    fonte: url
                  }
                });
              }
            }
          } catch (err) {
            console.error('[IBADE] Erro ao processar link:', err);
          }
        });

        // Buscar PDFs de editais
        $('a[href$=".pdf"]').each((_, element) => {
          try {
            const $link = $(element);
            const href = $link.attr('href');
            const text = $link.text().trim();

            if (href && text && (
              text.toLowerCase().includes('edital') ||
              text.toLowerCase().includes('retificação') ||
              text.toLowerCase().includes('concurso')
            )) {
              const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
              
              if (!items.find(item => item.url === fullUrl)) {
                items.push({
                  url: fullUrl,
                  title: text,
                  content: `PDF: ${text}`,
                  meta: {
                    banca: 'IBADE',
                    tipo: 'pdf',
                    fonte: url
                  }
                });
              }
            }
          } catch (err) {
            console.error('[IBADE] Erro ao processar PDF:', err);
          }
        });

      } catch (err: any) {
        console.error(`[IBADE] Erro ao processar ${url}:`, err.message);
      }
    }

    console.log(`[IBADE] Coletados ${items.length} itens`);
    return items;

  } catch (error: any) {
    console.error('[IBADE] Erro geral:', error.message);
    return items;
  }
}
