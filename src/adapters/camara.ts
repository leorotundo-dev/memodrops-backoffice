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
        
        for (const prop of dados) {
          const uri = prop.uri || '';
          const ementa = prop.ementa || prop.ementaDetalhada || '';
          const siglaTipo = prop.siglaTipo || '';
          const numero = prop.numero || '';
          const ano = prop.ano || '';
          
          if (uri && ementa) {
            const title = `${siglaTipo} ${numero}/${ano} - ${ementa.substring(0, 200)}`;
            
            if (!items.find(item => item.url === uri)) {
              items.push({
                url: uri,
                title,
                content: ementa,
                meta: {
                  fonte: 'Câmara',
                  tipo: 'proposicao',
                  siglaTipo,
                  numero,
                  ano,
                },
              });
            }
          }
        }
      } catch (err) {
        console.error(`[Câmara] Erro ao processar ${url}:`, err);
      }
    }
    
    console.log(`[Câmara] Coletados ${items.length} itens`);
    return items;
  } catch (error) {
    console.error('[Câmara] Erro geral:', error);
    return items;
  }
}
