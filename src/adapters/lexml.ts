// src/adapters/lexml.ts
import * as cheerio from 'cheerio';
import { request } from 'undici';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Coleta documentos do LexML via protocolo SRU (Search/Retrieve via URL)
 * Docs: https://www.lexml.gov.br/busca/SRU
 */
export async function harvestLexML(): Promise<HarvestItem[]> {
  console.log('[LexML] Iniciando coleta...');
  const items: HarvestItem[] = [];
  
  try {
    // Queries SRU para diferentes tipos de documentos
    const queries = [
      'urn.lex=br:federal:lei',  // Leis federais
      'urn.lex=br:federal:decreto',  // Decretos federais
      'urn.lex=br:federal:medida.provisoria',  // MPs
    ];
    
    for (const query of queries) {
      try {
        const url = `https://www.lexml.gov.br/busca/SRU?operation=searchRetrieve&query=${encodeURIComponent(query)}&maximumRecords=50&sortKeys=data.publicacao,,0`;
        
        console.log(`[LexML] Buscando ${query}...`);
        
        const res = await request(url, {
          method: 'GET',
          headers: {
            'accept': 'application/xml',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (res.statusCode !== 200) {
          console.error(`[LexML] HTTP ${res.statusCode} para ${url}`);
          continue;
        }
        
        const xml = await res.body.text();
        const $ = cheerio.load(xml, { xmlMode: true });
        
        // Extrair registros do XML SRU
        $('record').each((_, record) => {
          const $record = $(record);
          
          // Buscar identifier ou link
          const identifier = $record.find('identifier').first().text().trim();
          const link = $record.find('link').first().text().trim();
          const title = $record.find('title').first().text().trim();
          const description = $record.find('description').first().text().trim();
          
          const itemUrl = link || identifier;
          
          if (itemUrl && itemUrl.startsWith('http')) {
            if (!items.find(item => item.url === itemUrl)) {
              items.push({
                url: itemUrl,
                title: title || identifier || 'Documento LexML',
                content: description || title || '',
                meta: {
                  fonte: 'LexML',
                  tipo: 'legislacao',
                  query,
                },
              });
            }
          }
        });
      } catch (err) {
        console.error(`[LexML] Erro ao processar ${query}:`, err);
      }
    }
    
    console.log(`[LexML] Coletados ${items.length} itens`);
    return items;
  } catch (error) {
    console.error('[LexML] Erro geral:', error);
    return items;
  }
}
