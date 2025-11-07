// src/adapters/camara.ts
import { request } from 'undici';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Coleta proposições da API de Dados Abertos da Câmara dos Deputados
 * Docs: https://dadosabertos.camara.leg.br/swagger/api.html
 */
export async function harvestCamara(): Promise<HarvestItem[]> {
  console.log('[Câmara] Iniciando coleta...');
  const items: HarvestItem[] = [];
  
  try {
    // Buscar proposições recentes (últimos 30 dias)
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);
    const dataInicioStr = dataInicio.toISOString().split('T')[0];
    
    const urls = [
      `https://dadosabertos.camara.leg.br/api/v2/proposicoes?dataInicio=${dataInicioStr}&ordem=DESC&ordenarPor=id`,
      'https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=PL&ordem=DESC&ordenarPor=id&itens=100',
      'https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=PEC&ordem=DESC&ordenarPor=id&itens=50',
    ];
    
    for (const url of urls) {
      try {
        console.log(`[Câmara] Buscando ${url}...`);
        
        const res = await request(url, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'user-agent': 'MemoDropsHarvester/1.0',
          },
        });
        
        if (res.statusCode !== 200) {
          console.error(`[Câmara] HTTP ${res.statusCode} para ${url}`);
          continue;
        }
        
        const body = await res.body.json() as any;
        const dados = body.dados || [];
        
        console.log(`[Câmara] ${dados.length} proposições encontradas em ${url}`);
        
        for (const prop of dados) {
          const { id, siglaTipo, numero, ano, ementa, uri } = prop;
          
          items.push({
            url: uri,
            title: `${siglaTipo} ${numero}/${ano}`,
            content: ementa,
            meta: {
              source: 'camara',
              tipo: siglaTipo,
              numero,
              ano,
              id,
            },
          });
        }
      } catch (error) {
        console.error(`[Câmara] Erro ao buscar ${url}:`, error);
      }
    }
    
    console.log(`[Câmara] Coleta concluída: ${items.length} itens`);
    return items;
  } catch (error) {
    console.error('[Câmara] Erro na coleta:', error);
    return [];
  }
}
