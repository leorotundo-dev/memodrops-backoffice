import { pool } from '../db/index.js';
import { AutomatedQA } from '../qa/automated-qa.js';

/**
 * Job: Avaliação Automática de Drops
 * 
 * Avalia automaticamente a qualidade dos drops usando LLM e métricas.
 */

export interface QAEvaluationResult {
  evaluated: number;
  approved: number;
  rejected: number;
  needsRevision: number;
  errors: number;
}

/**
 * Avalia todos os drops que precisam de revisão
 */
export async function evaluateDropsNeedingReview(): Promise<QAEvaluationResult> {
  console.log('[QA Evaluation] Iniciando avaliação automática de drops...');

  const result: QAEvaluationResult = {
    evaluated: 0,
    approved: 0,
    rejected: 0,
    needsRevision: 0,
    errors: 0
  };

  try {
    const automatedQA = new AutomatedQA(pool);

    // Identificar drops que precisam de revisão
    const dropIds = await automatedQA.identifyDropsNeedingReview();
    console.log(`[QA Evaluation] ${dropIds.length} drops precisam de revisão`);

    if (dropIds.length === 0) {
      console.log('[QA Evaluation] Nenhum drop para avaliar');
      return result;
    }

    // Avaliar drops em lote
    const evaluations = await automatedQA.evaluateDrops(dropIds);

    // Contar resultados
    for (const evaluation of evaluations) {
      result.evaluated++;

      if (evaluation.status === 'approved') {
        result.approved++;
      } else if (evaluation.status === 'rejected') {
        result.rejected++;
      } else if (evaluation.status === 'needs_revision') {
        result.needsRevision++;
      }

      if (evaluation.qualityScore === 0) {
        result.errors++;
      }
    }

    console.log('[QA Evaluation] ✅ Avaliação concluída:');
    console.log(`  - Avaliados: ${result.evaluated}`);
    console.log(`  - Aprovados: ${result.approved}`);
    console.log(`  - Rejeitados: ${result.rejected}`);
    console.log(`  - Precisam revisão: ${result.needsRevision}`);
    console.log(`  - Erros: ${result.errors}`);

    return result;

  } catch (error) {
    console.error('[QA Evaluation] Erro fatal:', error);
    throw error;
  }
}

/**
 * Avalia um lote específico de drops
 */
export async function evaluateDropsBatch(dropIds: number[]): Promise<QAEvaluationResult> {
  console.log(`[QA Evaluation] Avaliando lote de ${dropIds.length} drops...`);

  const result: QAEvaluationResult = {
    evaluated: 0,
    approved: 0,
    rejected: 0,
    needsRevision: 0,
    errors: 0
  };

  try {
    const automatedQA = new AutomatedQA(pool);
    const evaluations = await automatedQA.evaluateDrops(dropIds);

    for (const evaluation of evaluations) {
      result.evaluated++;

      if (evaluation.status === 'approved') {
        result.approved++;
      } else if (evaluation.status === 'rejected') {
        result.rejected++;
      } else if (evaluation.status === 'needs_revision') {
        result.needsRevision++;
      }

      if (evaluation.qualityScore === 0) {
        result.errors++;
      }
    }

    console.log('[QA Evaluation] ✅ Lote avaliado:');
    console.log(`  - Avaliados: ${result.evaluated}`);
    console.log(`  - Aprovados: ${result.approved}`);
    console.log(`  - Rejeitados: ${result.rejected}`);
    console.log(`  - Precisam revisão: ${result.needsRevision}`);

    return result;

  } catch (error) {
    console.error('[QA Evaluation] Erro ao avaliar lote:', error);
    throw error;
  }
}

/**
 * Reavalia drops com baixa qualidade
 */
export async function reevaluateLowQualityDrops(threshold: number = 0.5): Promise<QAEvaluationResult> {
  console.log(`[QA Evaluation] Reavaliando drops com qualidade < ${threshold}...`);

  const result: QAEvaluationResult = {
    evaluated: 0,
    approved: 0,
    rejected: 0,
    needsRevision: 0,
    errors: 0
  };

  try {
    // Buscar drops com baixa qualidade
    const query = `
      SELECT drop_id
      FROM drop_metrics
      WHERE quality_score < $1 AND quality_score > 0 AND total_attempts >= 5
      ORDER BY quality_score ASC
      LIMIT 50
    `;

    const queryResult = await pool.query(query, [threshold]);
    const dropIds = queryResult.rows.map(row => row.drop_id);

    console.log(`[QA Evaluation] ${dropIds.length} drops com baixa qualidade encontrados`);

    if (dropIds.length === 0) {
      return result;
    }

    return evaluateDropsBatch(dropIds);

  } catch (error) {
    console.error('[QA Evaluation] Erro ao reavaliar drops:', error);
    throw error;
  }
}
