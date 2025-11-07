import { Pool } from 'pg';
import OpenAI from 'openai';
import { QAReviewRepository } from '../services/qaReviewRepository.js';
import { DropMetricsRepository } from '../services/dropMetricsRepository.js';
import { DropRepository } from '../services/dropRepository.js';

/**
 * Sistema de QA Automático
 * 
 * Avalia a qualidade dos drops usando LLM e métricas de desempenho.
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface QAResult {
  dropId: number;
  qualityScore: number; // 0-1
  status: 'approved' | 'rejected' | 'needs_revision';
  feedback: {
    clarity?: string;
    accuracy?: string;
    relevance?: string;
    difficulty?: string;
    suggestions?: string[];
  };
  reasoning: string;
}

export class AutomatedQA {
  private qaReviewRepo: QAReviewRepository;
  private dropMetricsRepo: DropMetricsRepository;
  private dropRepo: DropRepository;

  constructor(private pool: Pool) {
    this.qaReviewRepo = new QAReviewRepository(pool);
    this.dropMetricsRepo = new DropMetricsRepository(pool);
    this.dropRepo = new DropRepository(pool);
  }

  /**
   * Avalia a qualidade de um drop usando LLM
   */
  async evaluateDrop(dropId: number): Promise<QAResult> {
    console.log(`[Automated QA] Avaliando drop ${dropId}...`);

    // Buscar o drop
    const drop = await this.dropRepo.findById(dropId);
    if (!drop) {
      throw new Error(`Drop ${dropId} não encontrado`);
    }

    // Buscar métricas (se existirem)
    const metrics = await this.dropMetricsRepo.findByDrop(dropId);

    // Montar o prompt para o LLM
    const prompt = this.buildEvaluationPrompt(drop, metrics);

    // Chamar o LLM
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em avaliação de qualidade de conteúdo educacional.
Sua tarefa é avaliar a qualidade de um "drop" (unidade de estudo) e fornecer feedback estruturado.

Critérios de avaliação:
1. **Clareza**: O conteúdo é claro e fácil de entender?
2. **Precisão**: O conteúdo está correto e preciso?
3. **Relevância**: O conteúdo é relevante para o tópico?
4. **Dificuldade**: A dificuldade está adequada?
5. **Estrutura**: O conteúdo está bem estruturado?

Retorne um JSON com o seguinte formato:
{
  "qualityScore": 0.85,
  "status": "approved",
  "feedback": {
    "clarity": "O conteúdo está claro e bem explicado.",
    "accuracy": "Informações corretas e precisas.",
    "relevance": "Altamente relevante para o tópico.",
    "difficulty": "Dificuldade adequada para o nível.",
    "suggestions": ["Adicionar exemplo prático", "Melhorar formatação"]
  },
  "reasoning": "O drop tem alta qualidade, com conteúdo claro e preciso."
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error('LLM não retornou resposta');
    }

    const evaluation = JSON.parse(response);

    // Criar o resultado
    const result: QAResult = {
      dropId,
      qualityScore: evaluation.qualityScore || 0.5,
      status: evaluation.status || 'needs_revision',
      feedback: evaluation.feedback || {},
      reasoning: evaluation.reasoning || 'Sem justificativa'
    };

    // Salvar a revisão no banco
    await this.qaReviewRepo.create({
      dropId,
      reviewerType: 'automated',
      status: result.status,
      qualityScore: result.qualityScore,
      feedback: result.feedback,
      notes: result.reasoning
    });

    // Atualizar o quality score nas métricas
    await this.dropMetricsRepo.updateQualityScore(dropId, result.qualityScore);

    console.log(`[Automated QA] ✅ Drop ${dropId} avaliado: ${result.status} (score: ${result.qualityScore})`);

    return result;
  }

  /**
   * Monta o prompt para avaliação do LLM
   */
  private buildEvaluationPrompt(drop: any, metrics: any | null): string {
    let prompt = `Avalie a qualidade do seguinte drop de estudo:\n\n`;
    prompt += `**Conteúdo do Drop:**\n${drop.drop_text}\n\n`;
    prompt += `**Tipo:** ${drop.drop_type}\n`;
    prompt += `**Matéria ID:** ${drop.subject_id}\n`;

    if (metrics) {
      prompt += `\n**Métricas de Desempenho:**\n`;
      prompt += `- Total de tentativas: ${metrics.total_attempts}\n`;
      prompt += `- Taxa de acerto: ${metrics.accuracy_rate.toFixed(2)}%\n`;
      prompt += `- Confiança média: ${metrics.avg_confidence.toFixed(2)}/5\n`;
      prompt += `- Tempo médio: ${metrics.avg_time_seconds}s\n`;
      prompt += `- Dificuldade calculada: ${metrics.difficulty_score.toFixed(2)}\n`;
    }

    prompt += `\nAvalie a qualidade e retorne um JSON com o formato especificado.`;

    return prompt;
  }

  /**
   * Avalia múltiplos drops em lote
   */
  async evaluateDrops(dropIds: number[]): Promise<QAResult[]> {
    const results: QAResult[] = [];

    for (const dropId of dropIds) {
      try {
        const result = await this.evaluateDrop(dropId);
        results.push(result);
      } catch (error: any) {
        console.error(`[Automated QA] Erro ao avaliar drop ${dropId}:`, error.message);
        results.push({
          dropId,
          qualityScore: 0,
          status: 'needs_revision',
          feedback: {},
          reasoning: `Erro na avaliação: ${error.message}`
        });
      }
    }

    return results;
  }

  /**
   * Identifica drops que precisam de revisão
   */
  async identifyDropsNeedingReview(): Promise<number[]> {
    // Buscar drops sem revisão ou com métricas ruins
    const query = `
      SELECT d.id
      FROM drops d
      LEFT JOIN qa_reviews qr ON d.id = qr.drop_id
      LEFT JOIN drop_metrics dm ON d.id = dm.drop_id
      WHERE
        qr.id IS NULL
        OR (dm.accuracy_rate < 50 AND dm.total_attempts >= 5)
        OR (dm.quality_score < 0.5 AND dm.quality_score > 0)
      ORDER BY d.created_at DESC
      LIMIT 100
    `;

    const result = await this.pool.query(query);
    return result.rows.map(row => row.id);
  }

  /**
   * Calcula o quality score com base em métricas e feedback
   */
  calculateQualityScore(metrics: any, llmScore: number): number {
    if (!metrics || metrics.total_attempts < 5) {
      // Poucos dados, confiar no LLM
      return llmScore;
    }

    // Combinar score do LLM com métricas reais
    const accuracyScore = metrics.accuracy_rate / 100; // 0-1
    const confidenceScore = metrics.avg_confidence / 5; // 0-1
    const difficultyPenalty = Math.abs(metrics.difficulty_score - 0.5); // Penaliza extremos

    // Pesos: LLM 40%, Accuracy 30%, Confidence 20%, Difficulty 10%
    const finalScore =
      llmScore * 0.4 +
      accuracyScore * 0.3 +
      confidenceScore * 0.2 +
      (1 - difficultyPenalty) * 0.1;

    return Math.max(0, Math.min(1, finalScore));
  }
}
