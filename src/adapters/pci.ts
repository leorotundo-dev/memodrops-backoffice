/**
 * Adaptador PCI Concursos
 * 
 * Coleta editais de concursos públicos do maior agregador do Brasil
 * Site: https://www.pciconcursos.com.br/
 * 
 * Agregador: PCI Concursos
 * Cobertura: Nacional (34.170+ vagas ativas)
 * Tipo: Portal agregador
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
 * Coleta concursos do PCI Concursos
 */
export async function harvestPCI(): Promise<HarvestItem[]> {
  console.log('[PCI] Iniciando coleta...');
  const items: HarvestItem[] = [];
  
  try {
    const baseUrl = 'https://www.pciconcursos.com.br';
    const urls = [
      `${baseUrl}/`,
      `${baseUrl}/concursos/`,
      `${baseUrl}/concursos/nacional`,
      `${baseUrl}/concursos/sudeste`,
      `${baseUrl}/concursos/sul`,
      `${baseUrl}/concursos/norte`,
      `${baseUrl}/concursos/nordeste`,
      `${baseUrl}/concursos/centro-oeste`,
      `${baseUrl}/provas/`,
      `${baseUrl}/provas/federais`,
      `${baseUrl}/provas/estaduais`,
    ];
    
    for (const url of urls) {
      try {
        console.log(`[PCI] Buscando ${url}...`);
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);
        
        // Buscar notícias de concursos (formato principal do PCI)
        $('article, .noticia, .concurso-item, [class*="concurso"]').each((_, el) => {
          try {
            const $article = $(el);
            
            // Extrair título
            let title = $article.find('h2, h3, h4, .titulo').text().trim();
            if (!title) {
              title = $article.find('a').first().text().trim();
            }

            // Extrair link
            const link = $article.find('a').first().attr('href');

            // Extrair informações do texto
            const fullText = $article.text();
            const vagasMatch = fullText.match(/(\d+)\s*vaga/i);
            const salarioMatch = fullText.match(/R\$\s*[\d.,]+/);
            
            if (title && link && title.length > 15 && !title.toLowerCase().includes('apostila')) {
              const fullUrl = link.startsWith('http') ? link : `${baseUrl}${link}`;
              
              // Evitar duplicatas
              if (!items.find(item => item.url === fullUrl)) {
                items.push({
                  url: fullUrl,
                  title: title,
                  content: `Concurso: ${title}\nVagas: ${vagasMatch ? vagasMatch[1] : 'Não informado'}\nSalário: ${salarioMatch ? salarioMatch[0] : 'Não informado'}\nFonte: PCI Concursos`,
                  meta: {
                    fonte: 'PCI Concursos',
                    tipo: 'concurso',
                    vagas: vagasMatch ? vagasMatch[1] : undefined,
                    salario: salarioMatch ? salarioMatch[0] : undefined,
                    regiao: url.includes('/nacional') ? 'Nacional' : 
                            url.includes('/sudeste') ? 'Sudeste' :
                            url.includes('/sul') ? 'Sul' :
                            url.includes('/norte') ? 'Norte' :
                            url.includes('/nordeste') ? 'Nordeste' :
                            url.includes('/centro-oeste') ? 'Centro-Oeste' : undefined
                  }
                });
              }
            }
          } catch (err) {
            console.error('[PCI] Erro ao processar artigo:', err);
          }
        });

        // Buscar links diretos de concursos
        $('a[href*="/concurso/"]').each((_, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().trim();

          if (href && text && text.length > 15 && !text.toLowerCase().includes('apostila')) {
            const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
            
            // Evitar duplicatas
            if (!items.find(item => item.url === fullUrl)) {
              items.push({
                url: fullUrl,
                title: text,
                content: text,
                meta: {
                  fonte: 'PCI Concursos',
                  tipo: 'concurso'
                }
              });
            }
          }
        });
        
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
        
        // Buscar PDFs de provas e editais
        $('a[href$=".pdf"]').each((_, el) => {
          const href = $(el).attr('href');
          const title = $(el).text().trim() || $(el).attr('title') || 'Documento PCI';
          
          if (href && (
            title.toLowerCase().includes('edital') ||
            title.toLowerCase().includes('prova') ||
            title.toLowerCase().includes('retificação')
          )) {
            const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
            
            if (!items.find(item => item.url === fullUrl)) {
              items.push({
                url: fullUrl,
                title,
                content: `PDF: ${title}`,
                meta: {
                  fonte: 'PCI Concursos',
                  tipo: 'pdf',
                },
              });
            }
          }
        });
      } catch (err: any) {
        console.error(`[PCI] Erro ao processar ${url}:`, err.message);
      }
    }
    
    console.log(`[PCI] Coletados ${items.length} itens`);
    return items;
  } catch (error: any) {
    console.error('[PCI] Erro geral:', error.message);
    return items;
  }
}
