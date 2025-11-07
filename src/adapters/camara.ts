// src/adapters/camara.ts
import { request } from 'undici';
import { processPdf, isPdfUrl } from '../pipeline/pdfProcessor';

export interface HarvestItem {
  url: string;
  title: string;
  content: string;
  meta: Record<string, any>;
}

/**
 * Busca detalhes de uma proposição específica
 * Retorna o texto completo se disponível
 */
async function fetchProposicaoDetalhes(uri: string): Promise<{ textoCompleto: string | null; urlInteiroTeor: string | null }> {
  try {
    const res = await request(uri, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'user-agent': 'MemoDropsHarvester/1.0',
      },
    });

    if (res.statusCode !== 200) {
      console.error(`[Câmara] HTTP ${res.statusCode} para detalhes de ${uri}`);
      return { textoCompleto: null, urlInteiroTeor: null };
    }

    const body = await res.body.json() as any;
    const dados = body.dados || {};
    
    const urlInteiroTeor = dados.urlInteiroTeor || null;
    
    // Se houver URL do inteiro teor, tentar baixar
    if (urlInteiroTeor) {
      console.log(`[Câmara] Encontrado inteiro teor: ${urlInteiroTeor}`);
      
      // Se for PDF, processar
      if (isPdfUrl(urlInteiroTeor)) {
        const textoCompleto = await processPdf(urlInteiroTeor);
        if (textoCompleto && textoCompleto.length > 100) {
          console.log(`[Câmara] Texto extraído do PDF: ${textoCompleto.length} caracteres`);
          return { textoCompleto, urlInteiroTeor };
        }
      } else {
        // Se for HTML, tentar buscar como texto
        try {
          const htmlRes = await request(urlInteiroTeor, {
            method: 'GET',
            headers: {
              'accept': 'text/html',
              'user-agent': 'MemoDropsHarvester/1.0',
            },
          });
          
          if (htmlRes.statusCode === 200) {
            const htmlText = await htmlRes.body.text();
            // Remover tags HTML básicas
            const textoCompleto = htmlText
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            if (textoCompleto.length > 100) {
              console.log(`[Câmara] Texto extraído do HTML: ${textoCompleto.length} caracteres`);
              return { textoCompleto, urlInteiroTeor };
            }
          }
        } catch (err) {
          console.error(`[Câmara] Erro ao buscar HTML de ${urlInteiroTeor}:`, err);
        }
      }
    }
    
    return { textoCompleto: null, urlInteiroTeor };
  } catch (error) {
    console.error(`[Câmara] Erro ao buscar detalhes de ${uri}:`, error);
    return { textoCompleto: null, urlInteiroTeor: null };
  }
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
      `https://dadosabertos.camara.leg.br/api/v2/proposicoes?dataInicio=${dataInicioStr}&ordem=DESC&ordenarPor=id&itens=20`,
      'https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=PL&ordem=DESC&ordenarPor=id&itens=20',
      'https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=PEC&ordem=DESC&ordenarPor=id&itens=10',
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
        
        // Limitar a 10 itens por URL para não sobrecarregar
        const limitedDados = dados.slice(0, 10);
        
        for (const prop of limitedDados) {
          const uri = prop.uri || '';
          const ementa = prop.ementa || prop.ementaDetalhada || '';
          const siglaTipo = prop.siglaTipo || '';
          const numero = prop.numero || '';
          const ano = prop.ano || '';
          
          if (uri && ementa) {
            // Verificar se já foi coletado
            if (items.find(item => item.url === uri)) {
              continue;
            }
            
            const title = `${siglaTipo} ${numero}/${ano} - ${ementa.substring(0, 200)}`;
            
            // Buscar texto completo
            console.log(`[Câmara] Buscando detalhes de ${siglaTipo} ${numero}/${ano}...`);
            const { textoCompleto, urlInteiroTeor } = await fetchProposicaoDetalhes(uri);
            
            // Usar texto completo se disponível, senão usar ementa
            const content = textoCompleto || ementa;
            
            items.push({
              url: uri,
              title,
              content,
              meta: {
                fonte: 'Câmara',
                tipo: 'proposicao',
                siglaTipo,
                numero,
                ano,
                urlInteiroTeor: urlInteiroTeor || undefined,
                temTextoCompleto: !!textoCompleto,
              },
            });
            
            console.log(`[Câmara] ✓ ${siglaTipo} ${numero}/${ano} - ${content.length} caracteres`);
          }
        }
      } catch (err) {
        console.error(`[Câmara] Erro ao processar ${url}:`, err);
      }
    }
    
    console.log(`[Câmara] Coletados ${items.length} itens (${items.filter(i => i.meta.temTextoCompleto).length} com texto completo)`);
    return items;
  } catch (error) {
    console.error('[Câmara] Erro geral:', error);
    return items;
  }
}
