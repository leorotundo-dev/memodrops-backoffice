// src/jobs/process-content.ts
/**
 * Job que processa harvest_items e envia para MemoDrops
 * Pipeline: harvest_items → LLM extrai estrutura → Gera Drops/Subjects/Cards
 */

import { query } from '../db/index.js';

interface HarvestItem {
  id: number;
  source: string;
  url: string;
  title: string;
  content_text: string;
  license: string;
  fetched_at: string;
}

interface StructuredContent {
  contestName: string;
  category: string;
  subjects: Array<{
    name: string;
    topics: string[];
  }>;
  examDate?: string;
  institution?: string;
  positions?: number;
  salary?: string;
}

/**
 * Extrai estrutura de concurso usando LLM
 */
async function extractStructure(item: HarvestItem): Promise<StructuredContent | null> {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.warn('[Process] OPENAI_API_KEY não configurada');
      return null;
    }

    // Otimização: reduzir tamanho do conteúdo baseado no tamanho real
    const maxContentLength = item.content_text.length < 500 ? item.content_text.length : 3000;
    const content = item.content_text.substring(0, maxContentLength);

    // Prompt compacto para economizar tokens
    const prompt = `Extraia estrutura JSON do concurso:
Título: ${item.title}
Fonte: ${item.source}
Conteúdo: ${content}

Retorne: {contestName, category(legislativo|judiciario|executivo|seguranca|fiscal|educacao|saude|outro), subjects[{name, topics[]}], examDate?, institution?, positions?, salary?}
Se não for concurso: null`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano', // Otimização: modelo mais barato (~80% economia)
        messages: [
          { role: 'system', content: 'Você é um especialista em análise de editais de concursos públicos brasileiros.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('[Process] Erro na API OpenAI:', response.statusText);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) return null;
    
    const parsed = JSON.parse(content);
    return parsed.contestName ? parsed : null;
  } catch (error) {
    console.error('[Process] Erro ao extrair estrutura:', error);
    return null;
  }
}

/**
 * Envia conteúdo estruturado para MemoDrops
 */
async function sendToMemoDrops(item: HarvestItem, structure: StructuredContent): Promise<boolean> {
  try {
    const BACKOFFICE_URL = process.env.BACKOFFICE_URL || 'http://localhost:8080';

    const response = await fetch(`${BACKOFFICE_URL}/api/harvester/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceItem: {
          id: item.id,
          source: item.source,
          url: item.url,
          title: item.title,
          license: item.license,
        },
        structure,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[Process] Erro ao enviar para MemoDrops:', error);
    return false;
  }
}

/**
 * Processa itens pendentes
 */
export async function processHarvestItems() {
  console.log('[Process] Iniciando processamento de itens...');

  try {
    // Buscar itens que ainda não foram processados
    const result = await query(`
      SELECT * FROM harvest_items
      WHERE status = 'fetched'
      AND content_text IS NOT NULL
      AND LENGTH(content_text) > 30
      AND processed_at IS NULL
      ORDER BY fetched_at DESC
      LIMIT 10
    `);

    const items: HarvestItem[] = result.rows as any[];
    console.log(`[Process] ${items.length} itens para processar`);

    let processed = 0;
    let sent = 0;

    for (const item of items) {
      console.log(`[Process] Processando: ${item.title}`);

      // Extrair estrutura com LLM
      const structure = await extractStructure(item);

      if (structure) {
        console.log(`[Process] Estrutura extraída: ${structure.contestName}`);

        // Enviar para MemoDrops
        const success = await sendToMemoDrops(item, structure);

        if (success) {
          sent++;
          // Marcar como processado
          await query(
            'UPDATE harvest_items SET processed_at = NOW() WHERE id = $1',
            [item.id]
          );
        }
      }

      processed++;
    }

    console.log(`[Process] Concluído: ${processed} processados, ${sent} enviados`);

    return { processed, sent };
  } catch (error) {
    console.error('[Process] Erro no processamento:', error);
    throw error;
  }
}
