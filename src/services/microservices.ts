// src/services/microservices.ts
/**
 * Serviço de integração com os microserviços MemoDrops
 * - memodrops-extractor: Extração de estrutura de editais
 * - memodrops-learning-engine: Geração e priorização de drops
 */

const EXTRACTOR_URL = process.env.EXTRACTOR_URL || 'https://memodrops-extractor-production.up.railway.app';
const LEARNING_ENGINE_URL = process.env.LEARNING_ENGINE_URL || 'https://memodrops-learning-engine-production.up.railway.app';

interface ExtractorResponse {
  success: boolean;
  structure: {
    contest: {
      title: string;
      institution: string;
      year: number;
      vacancies: number;
      salary: number;
    };
    edital: {
      title: string;
      url: string;
      publication_date: string;
    };
    subjects: Array<{
      name: string;
      topics: string[];
    }>;
  };
  harvestItemId: string;
  error?: string;
}

interface GenerateDropsResponse {
  success: boolean;
  subjectId: string;
  dropsCount: number;
  drops: Array<{
    id: string;
    subjectId: string;
    topicName: string;
    title: string;
    content: string;
    memorizationTip: string;
    difficulty: 'easy' | 'medium' | 'hard';
    estimatedMinutes: number;
  }>;
  error?: string;
}

interface PrioritizeDropsResponse {
  success: boolean;
  dropsCount: number;
  drops: Array<any>;
  error?: string;
}

/**
 * Chama o microserviço extractor para extrair a estrutura de um edital
 */
export async function extractEditalStructure(
  html: string,
  harvestItemId: string | number
): Promise<ExtractorResponse> {
  try {
    console.log(`[Microservices] Chamando extractor para item ${harvestItemId}...`);
    
    const response = await fetch(`${EXTRACTOR_URL}/api/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        harvestItemId: String(harvestItemId)
      })
    });

    if (!response.ok) {
      throw new Error(`Extractor retornou status ${response.status}`);
    }

    const data: ExtractorResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Erro desconhecido no extractor');
    }

    console.log(`[Microservices] ✅ Estrutura extraída: ${data.structure.subjects.length} matérias`);
    
    return data;
  } catch (error: any) {
    console.error('[Microservices] ❌ Erro ao chamar extractor:', error.message);
    throw error;
  }
}

/**
 * Chama o microserviço learning-engine para gerar drops de uma matéria
 */
export async function generateDrops(
  subjectId: string,
  subjectName: string,
  topics: string[],
  targetDropCount?: number
): Promise<GenerateDropsResponse> {
  try {
    console.log(`[Microservices] Gerando drops para matéria: ${subjectName} (${topics.length} tópicos)...`);
    
    const response = await fetch(`${LEARNING_ENGINE_URL}/api/generate-drops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subjectId,
        subjectName,
        topics,
        targetDropCount: targetDropCount || topics.length * 3 // 3 drops por tópico por padrão
      })
    });

    if (!response.ok) {
      throw new Error(`Learning Engine retornou status ${response.status}`);
    }

    const data: GenerateDropsResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Erro desconhecido no learning engine');
    }

    console.log(`[Microservices] ✅ ${data.dropsCount} drops gerados`);
    
    return data;
  } catch (error: any) {
    console.error('[Microservices] ❌ Erro ao gerar drops:', error.message);
    throw error;
  }
}

/**
 * Chama o microserviço learning-engine para priorizar drops
 */
export async function prioritizeDrops(
  drops: Array<any>,
  userDeadline?: string,
  userLevel?: 'beginner' | 'intermediate' | 'advanced'
): Promise<PrioritizeDropsResponse> {
  try {
    console.log(`[Microservices] Priorizando ${drops.length} drops...`);
    
    const response = await fetch(`${LEARNING_ENGINE_URL}/api/prioritize-drops`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        drops,
        userDeadline,
        userLevel: userLevel || 'intermediate'
      })
    });

    if (!response.ok) {
      throw new Error(`Learning Engine retornou status ${response.status}`);
    }

    const data: PrioritizeDropsResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Erro desconhecido no learning engine');
    }

    console.log(`[Microservices] ✅ Drops priorizados`);
    
    return data;
  } catch (error: any) {
    console.error('[Microservices] ❌ Erro ao priorizar drops:', error.message);
    throw error;
  }
}

/**
 * Verifica a saúde dos microserviços
 */
export async function checkMicroservicesHealth(): Promise<{
  extractor: boolean;
  learningEngine: boolean;
}> {
  const health = {
    extractor: false,
    learningEngine: false
  };

  try {
    const extractorResponse = await fetch(`${EXTRACTOR_URL}/health`, { method: 'GET' });
    health.extractor = extractorResponse.ok;
  } catch (error) {
    console.error('[Microservices] Extractor health check failed');
  }

  try {
    const learningEngineResponse = await fetch(`${LEARNING_ENGINE_URL}/health`, { method: 'GET' });
    health.learningEngine = learningEngineResponse.ok;
  } catch (error) {
    console.error('[Microservices] Learning Engine health check failed');
  }

  return health;
}
