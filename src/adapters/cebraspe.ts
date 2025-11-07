/**
 * Adaptador Cebraspe (CESPE)
 * 
 * Coleta editais de concursos públicos do site oficial do Cebraspe
 * Site: https://www.cebraspe.org.br/concursos
 * 
 * Banca: Centro Brasileiro de Pesquisa em Avaliação e Seleção
 * Cobertura: Nacional
 * Tipo: Banca organizadora
 */

import { fetchHTML } from './fetch.js';
import * as cheerio from 'cheerio';

interface CebraspeItem {
  url: string;
  title: string;
  content: string;
  meta: {
    banca: string;
    vagas?: string;
    salario?: string;
    status: string;
  };
}

/**
 * Coleta concursos do Cebraspe
 */
export async function harvestCebraspe(): Promise<CebraspeItem[]> {
  console.log('[Cebraspe] Iniciando coleta...');
  const items: CebraspeItem[] = [];

  try {
    // Coletar de diferentes seções
    const sections = [
      { url: 'https://www.cebraspe.org.br/concursos/', status: 'novos' },
      { url: 'https://www.cebraspe.org.br/concursos/inscricoes-abertas', status: 'inscricoes_abertas' },
      { url: 'https://www.cebraspe.org.br/concursos/em-andamento', status: 'em_andamento' }
    ];

    for (const section of sections) {
      console.log(`[Cebraspe] Buscando ${section.url}...`);
      
      try {
        const html = await fetchHTML(section.url);
        const $ = cheerio.load(html);

        // Encontrar cards de concursos
        $('.card-concurso, .concurso-item, [class*="concurso"]').each((_, element) => {
          try {
            const $card = $(element);
            
            // Extrair informações
            const title = $card.find('h3, h4, .titulo, .nome').text().trim();
            const vagas = $card.find('.vagas, [class*="vaga"]').text().trim();
            const salario = $card.find('.salario, [class*="salario"], [class*="remuneracao"]').text().trim();
            const link = $card.find('a').attr('href');

            if (title && link) {
              const fullUrl = link.startsWith('http') ? link : `https://www.cebraspe.org.br${link}`;
              
              items.push({
                url: fullUrl,
                title: title,
                content: `Concurso: ${title}\nVagas: ${vagas || 'Não informado'}\nSalário: ${salario || 'Não informado'}\nBanca: Cebraspe`,
                meta: {
                  banca: 'Cebraspe',
                  vagas: vagas || undefined,
                  salario: salario || undefined,
                  status: section.status
                }
              });
            }
          } catch (err) {
            console.error('[Cebraspe] Erro ao processar card:', err);
          }
        });

      } catch (err: any) {
        console.error(`[Cebraspe] Erro ao processar ${section.url}:`, err.message);
      }
    }

    console.log(`[Cebraspe] Coletados ${items.length} itens`);
    return items;

  } catch (error: any) {
    console.error('[Cebraspe] Erro geral:', error.message);
    return items;
  }
}
