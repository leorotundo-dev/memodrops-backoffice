/**
 * Adaptador FCC
 * 
 * Coleta editais de concursos públicos do site oficial da FCC
 * Site: https://www.concursosfcc.com.br/concursos
 * 
 * Banca: Fundação Carlos Chagas
 * Cobertura: Nacional (forte presença em SP)
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
 * Coleta concursos da FCC
 */
export async function harvestFCC(): Promise<HarvestItem[]> {
  console.log('[FCC] Iniciando coleta...');
  const items: HarvestItem[] = [];
  
  try {
    const baseUrl = 'https://www.concursosfcc.com.br';
    const urls = [
      `${baseUrl}/concursos`,
      `${baseUrl}/concursos/inscricoes-abertas`,
      `${baseUrl}/concursos/em-andamento`,
      `${baseUrl}/concursos/encerrados`,
    ];
    
    for (const url of urls) {
      try {
        console.log(`[FCC] Buscando ${url}...`);
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        
        // Buscar cards de concursos
        $('.concurso, .item-concurso, [class*="concurso"]').each((_, el) => {
          try {
            const $card = $(el);
            const title = $card.find('h2, h3, h4, .titulo, .nome').text().trim();
            const instituicao = $card.find('.instituicao, .orgao').text().trim();
            const vagas = $card.find('.vagas, [class*="vaga"]').text().trim();
            const link = $card.find('a').attr('href');

            if (title && link) {
              const fullUrl = link.startsWith('http') ? link : `${baseUrl}${link}`;
              
              if (!items.find(item => item.url === fullUrl)) {
                items.push({
                  url: fullUrl,
                  title,
                  content: `Concurso: ${title}\nInstituição: ${instituicao || 'Não informado'}\nVagas: ${vagas || 'Não informado'}\nBanca: FCC`,
                  meta: {
                    banca: 'FCC',
                    instituicao: instituicao || undefined,
                    vagas: vagas || undefined,
                    fonte: url
                  }
                });
              }
            }
          } catch (err) {
            console.error('[FCC] Erro ao processar card:', err);
          }
        });
        
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
        
        // Buscar PDFs de editais e provas
        $('a[href$=".pdf"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim() || $(el).attr('title') || 'Edital FCC';
          
          if (href && (
            title.toLowerCase().includes('edital') ||
            title.toLowerCase().includes('retificação') ||
            title.toLowerCase().includes('concurso')
          )) {
            const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
            
            if (!items.find(item => item.url === fullUrl)) {
              items.push({
                url: fullUrl,
                title,
                content: `PDF: ${title}`,
                meta: {
                  fonte: 'FCC',
                  tipo: 'pdf',
                  banca: 'FCC',
                },
              });
            }
          }
        });
      } catch (err: any) {
        console.error(`[FCC] Erro ao processar ${url}:`, err.message);
      }
    }
    
    console.log(`[FCC] Coletados ${items.length} itens`);
    return items;
  } catch (error: any) {
    console.error('[FCC] Erro geral:', error.message);
    return items;
  }
}
