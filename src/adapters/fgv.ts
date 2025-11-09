/**
 * Adaptador FGV
 * 
 * Coleta editais de concursos públicos do site oficial da FGV
 * Site: https://conhecimento.fgv.br/concursos
 * 
 * Banca: Fundação Getúlio Vargas
 * Cobertura: Nacional
 * Tipo: Banca organizadora
 */

import * as cheerio from 'cheerio';
import { fetchHTML } from './fetch.js';
import { withErrorHandling, fetchWithRetry } from '../utils/errorHandler.js';
import { logger } from '../utils/logger.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Coleta concursos da FGV
 */
export async function harvestFGV(): Promise<HarvestItem[]> {
  return withErrorHandling(async () => {
    logger.info('[FGV] Iniciando coleta...');
    const items: HarvestItem[] = [];
  
  try {
    const listingUrls = [
      'https://conhecimento.fgv.br/concursos',
      'https://conhecimento.fgv.br/concursos/andamento',
      'https://conhecimento.fgv.br/concursos/encerrados'
    ];
    
    for (const listingUrl of listingUrls) {
      try {
        console.log(`[FGV] Buscando ${listingUrl}...`);
        const html = await fetchHTML(listingUrl);
        const $ = cheerio.load(html);
        
        // Buscar cards de concursos
        $('.concurso, .item-concurso, [class*="concurso-card"]').each((_, el) => {
          try {
            const $card = $(el);
            const title = $card.find('h2, h3, h4, .titulo').text().trim();
            const instituicao = $card.find('.instituicao, .orgao').text().trim();
            const link = $card.find('a').attr('href');
            
            if (title && link) {
              const fullUrl = link.startsWith('http') ? link : `https://conhecimento.fgv.br${link}`;
              items.push({
                url: fullUrl,
                title,
                content: `Concurso: ${title}\nInstituição: ${instituicao || 'Não informado'}\nBanca: FGV`,
                meta: { banca: 'FGV', tipo: 'concurso', instituicao, fonte: listingUrl },
              });
            }
          } catch (err) {
            console.error('[FGV] Erro ao processar card:', err);
          }
        });
        
        // Buscar links gerais de concursos
        $('a[href*="concurso"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim();
          
          if (href && title && title.length > 10 && !title.toLowerCase().includes('cookie')) {
            const fullUrl = href.startsWith('http') ? href : `https://conhecimento.fgv.br${href}`;
            
            // Evitar duplicatas
            if (!items.find(item => item.url === fullUrl)) {
              items.push({
                url: fullUrl,
                title,
                content: title,
                meta: { banca: 'FGV', tipo: 'concurso', fonte: listingUrl },
              });
            }
          }
        });
        
        // Buscar PDFs de editais
        $('a[href$=".pdf"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim() || $(el).attr('title') || 'Edital FGV';
          
          // Filtrar apenas PDFs relevantes (editais, retificações, etc)
          if (href && (
            title.toLowerCase().includes('edital') ||
            title.toLowerCase().includes('retificação') ||
            title.toLowerCase().includes('concurso')
          )) {
            const fullUrl = href.startsWith('http') ? href : `https://conhecimento.fgv.br${href}`;
            
            // Evitar duplicatas
            if (!items.find(item => item.url === fullUrl)) {
              items.push({
                url: fullUrl,
                title,
                content: `PDF: ${title}`,
                meta: { banca: 'FGV', tipo: 'pdf', fonte: listingUrl },
              });
            }
          }
        });
      } catch (err: any) {
        console.error(`[FGV] Erro ao processar ${listingUrl}:`, err.message);
      }
    }
    
    logger.info(`[FGV] Coletados ${items.length} itens`);
    return items;
  } catch (error: any) {
    logger.error('[FGV] Erro geral na coleta:', error);
    return items;
  }
  }, { adapter: 'FGV', operation: 'harvest' });
}
