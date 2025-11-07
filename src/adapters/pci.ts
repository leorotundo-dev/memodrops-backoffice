import * as cheerio from 'cheerio';
import { fetchHTML } from '../fetch.js';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Adaptador PCI Concursos
 * Site: https://www.pciconcursos.com.br/concursos/
 * Tipo: agregador
 */
export async function harvestPCI(): Promise<HarvestItem[]> {
  console.log('[PCI] Iniciando coleta...');
  const items: HarvestItem[] = [];
  const url = 'https://www.pciconcursos.com.br/concursos/';

  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    // A estrutura da página de listagem é uma tabela ou lista de divs
    // Vou procurar por elementos que contenham o link para o concurso e o título
    // No HTML da página, os concursos estão dentro de divs com a classe 'caixa-concurso'
    // ou similar. Vou usar um seletor mais genérico que encontrei na análise:
    // a[href*="/concursos/"] dentro de um contexto de lista de concursos.
    
    // Tentativa de seletor baseado na estrutura da página de listagem:
    // Cada item de concurso parece estar dentro de um elemento que contém um link
    // para a página de detalhes.
    // Vou usar o seletor que encontrei na análise visual:
    // .caixa-concurso ou .caixa-concurso-item
    
    // Como não tenho o HTML completo, vou tentar um seletor mais robusto:
    // Todos os links de concursos parecem ter a URL no formato /concursos/alguma-coisa
    // e estão dentro de um elemento que contém as informações.
    
    // Vou usar o seletor mais genérico que encontrei na análise visual:
    // links que apontam para a página de detalhes do concurso.
    $('a[href*="/concursos/"]').each((_, el) => {
      const link = $(el).attr('href');
      const title = $(el).text().trim();
      
      // Filtra links que são apenas para estados ou categorias
      if (link && link.length > 10 && !link.endsWith('/')) {
        const fullUrl = link.startsWith('http') ? link : `https://www.pciconcursos.com.br${link}`;
        
        // A informação do concurso está geralmente no elemento pai do link
        const parentText = $(el).closest('div, li, article').text().replace(/\s+/g, ' ').trim();
        
        // Extrair informações adicionais (vagas, salário) do texto do elemento pai
        const vagasMatch = parentText.match(/(\d+)\s*vaga/i);
        const vagas = vagasMatch ? vagasMatch[1] : undefined;
        
        const salarioMatch = parentText.match(/R\$\s*[\d.,]+/i);
        const salario = salarioMatch ? salarioMatch[0] : undefined;
        
        if (!items.find(i => i.url === fullUrl)) {
          items.push({ 
            url: fullUrl, 
            title, 
            content: parentText.slice(0, 500), 
            meta: { 
              fonte: 'PCI Concursos', 
              vagas, 
              salario 
            } 
          });
        }
      }
    });
    
  } catch (e: any) {
    console.error('[PCI] Erro:', e.message);
  }
  console.log(`[PCI] Coletados ${items.length} itens`);
  return items;
}
