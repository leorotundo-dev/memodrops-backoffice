import { Pool } from 'pg';
import { UserStatsRepository } from '../services/userStatsRepository.js';
import { DropRepository } from '../services/dropRepository.js';

/**
 * Personalization Engine
 * 
 * Responsável por ajustar as prioridades dos drops com base no desempenho do usuário.
 * Implementa algoritmos de espaçamento repetido e análise de dificuldade.
 */

export interface DropPriority {
  dropId: number;
  priority: number; // 0-1, onde 1 é máxima prioridade
  reason: string;
  metadata?: any;
}

export interface PersonalizationParams {
  userId: number;
  subjectId?: number;
  targetDropsCount?: number;
  includeWeakTopics?: boolean;
  includeReview?: boolean;
}

export class PersonalizationEngine {
  private userStatsRepo: UserStatsRepository;
  private dropRepo: DropRepository;

  constructor(private pool: Pool) {
    this.userStatsRepo = new UserStatsRepository(pool);
    this.dropRepo = new DropRepository(pool);
  }

  /**
   * Calcula a prioridade personalizada de drops para um usuário
   */
  async calculateDropPriorities(params: PersonalizationParams): Promise<DropPriority[]> {
    const {
      userId,
      subjectId,
      targetDropsCount = 10,
      includeWeakTopics = true,
      includeReview = true
    } = params;

    const priorities: DropPriority[] = [];

    // 1. IDENTIFICAR DROPS COM DIFICULDADE (prioridade alta)
    if (includeWeakTopics) {
      const weakDrops = await this.userStatsRepo.getWeakDrops(userId, Math.ceil(targetDropsCount * 0.4));
      
      for (const dropId of weakDrops) {
        priorities.push({
          dropId,
          priority: 0.9,
          reason: 'weak_topic',
          metadata: { source: 'user_performance_analysis' }
        });
      }
    }

    // 2. DROPS NUNCA VISTOS (prioridade média-alta)
    const unseenDrops = await this.getUnseenDrops(userId, subjectId, Math.ceil(targetDropsCount * 0.4));
    
    for (const dropId of unseenDrops) {
      priorities.push({
        dropId,
        priority: 0.7,
        reason: 'new_content',
        metadata: { source: 'unseen_drops' }
      });
    }

    // 3. REVISÃO DE DROPS ANTIGOS (espaçamento repetido)
    if (includeReview) {
      const reviewDrops = await this.getDropsForReview(userId, subjectId, Math.ceil(targetDropsCount * 0.2));
      
      for (const drop of reviewDrops) {
        priorities.push({
          dropId: drop.dropId,
          priority: drop.priority,
          reason: 'spaced_repetition',
          metadata: { daysSinceLastReview: drop.daysSinceLastReview }
        });
      }
    }

    // 4. ORDENAR POR PRIORIDADE E LIMITAR
    priorities.sort((a, b) => b.priority - a.priority);
    
    return priorities.slice(0, targetDropsCount);
  }

  /**
   * Busca drops que o usuário nunca viu
   */
  private async getUnseenDrops(
    userId: number,
    subjectId: number | undefined,
    limit: number
  ): Promise<number[]> {
    const subjectFilter = subjectId ? `AND d.subject_id = ${subjectId}` : '';

    const query = `
      SELECT d.id
      FROM drops d
      WHERE d.id NOT IN (
        SELECT DISTINCT drop_id
        FROM user_stats
        WHERE user_id = $1
      )
      ${subjectFilter}
      ORDER BY RANDOM()
      LIMIT $2
    `;

    const result = await this.pool.query(query, [userId, limit]);
    return result.rows.map(row => row.id);
  }

  /**
   * Busca drops para revisão baseado em espaçamento repetido
   * 
   * Algoritmo simplificado:
   * - Drops respondidos corretamente há 1-3 dias: prioridade 0.6
   * - Drops respondidos corretamente há 4-7 dias: prioridade 0.7
   * - Drops respondidos corretamente há 8-14 dias: prioridade 0.8
   * - Drops respondidos corretamente há 15+ dias: prioridade 0.9
   */
  private async getDropsForReview(
    userId: number,
    subjectId: number | undefined,
    limit: number
  ): Promise<Array<{ dropId: number; priority: number; daysSinceLastReview: number }>> {
    const subjectFilter = subjectId ? `AND d.subject_id = ${subjectId}` : '';

    const query = `
      SELECT
        us.drop_id,
        EXTRACT(DAY FROM NOW() - MAX(us.answered_at)) as days_since_last_review,
        AVG(CASE WHEN us.is_correct THEN 1.0 ELSE 0.0 END) as accuracy
      FROM user_stats us
      INNER JOIN drops d ON us.drop_id = d.id
      WHERE us.user_id = $1
      ${subjectFilter}
      GROUP BY us.drop_id
      HAVING AVG(CASE WHEN us.is_correct THEN 1.0 ELSE 0.0 END) >= 0.5
      ORDER BY MAX(us.answered_at) ASC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [userId, limit]);

    return result.rows.map(row => {
      const days = parseInt(row.days_since_last_review, 10);
      let priority = 0.5;

      if (days >= 15) {
        priority = 0.9;
      } else if (days >= 8) {
        priority = 0.8;
      } else if (days >= 4) {
        priority = 0.7;
      } else if (days >= 1) {
        priority = 0.6;
      }

      return {
        dropId: row.drop_id,
        priority,
        daysSinceLastReview: days
      };
    });
  }

  /**
   * Calcula a dificuldade ajustada de um drop para um usuário específico
   * 
   * Combina:
   * - Dificuldade base do drop
   * - Performance histórica do usuário nesse drop
   * - Performance geral do usuário na matéria
   */
  async calculateAdjustedDifficulty(userId: number, dropId: number): Promise<number> {
    const query = `
      SELECT
        AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) as user_accuracy,
        AVG(confidence_level) as avg_confidence
      FROM user_stats
      WHERE user_id = $1 AND drop_id = $2
    `;

    const result = await this.pool.query(query, [userId, dropId]);

    if (result.rows.length === 0 || result.rows[0].user_accuracy === null) {
      // Usuário nunca viu este drop, retorna dificuldade base
      return 0.5; // dificuldade média
    }

    const userAccuracy = parseFloat(result.rows[0].user_accuracy);
    const avgConfidence = parseFloat(result.rows[0].avg_confidence) || 3;

    // Quanto menor a acurácia e confiança, maior a dificuldade ajustada
    const adjustedDifficulty = 1 - (userAccuracy * 0.7 + (avgConfidence / 5) * 0.3);

    return Math.max(0, Math.min(1, adjustedDifficulty));
  }

  /**
   * Recomenda o tempo de estudo ideal para um usuário baseado em seu histórico
   */
  async recommendStudyTime(userId: number): Promise<number> {
    const performance = await this.userStatsRepo.getUserPerformance(userId);

    if (performance.totalAnswers === 0) {
      // Usuário novo: 15 minutos por dia
      return 15;
    }

    // Baseado na performance:
    // - Alta acurácia (>80%): 10-15 minutos
    // - Média acurácia (50-80%): 15-20 minutos
    // - Baixa acurácia (<50%): 20-30 minutos

    if (performance.accuracy >= 80) {
      return 15;
    } else if (performance.accuracy >= 50) {
      return 20;
    } else {
      return 25;
    }
  }

  /**
   * Identifica gaps de conhecimento do usuário
   */
  async identifyKnowledgeGaps(userId: number): Promise<Array<{
    subjectId: number;
    subjectName: string;
    accuracy: number;
    totalAttempts: number;
  }>> {
    const query = `
      SELECT
        d.subject_id,
        s.name as subject_name,
        COUNT(*) as total_attempts,
        ROUND(AVG(CASE WHEN us.is_correct THEN 1.0 ELSE 0.0 END) * 100, 2) as accuracy
      FROM user_stats us
      INNER JOIN drops d ON us.drop_id = d.id
      INNER JOIN subjects s ON d.subject_id = s.id
      WHERE us.user_id = $1
      GROUP BY d.subject_id, s.name
      HAVING AVG(CASE WHEN us.is_correct THEN 1.0 ELSE 0.0 END) < 0.7
      ORDER BY accuracy ASC, total_attempts DESC
    `;

    const result = await this.pool.query(query, [userId]);

    return result.rows.map(row => ({
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      accuracy: parseFloat(row.accuracy),
      totalAttempts: parseInt(row.total_attempts, 10)
    }));
  }
}
