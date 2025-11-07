import { Pool } from 'pg';

export interface DropMetrics {
  id: number;
  drop_id: number;
  total_views: number;
  total_attempts: number;
  correct_attempts: number;
  accuracy_rate: number;
  avg_confidence: number;
  avg_time_seconds: number;
  difficulty_score: number;
  quality_score: number;
  last_updated: Date;
  created_at: Date;
}

export interface CreateDropMetricsParams {
  dropId: number;
  totalViews?: number;
  totalAttempts?: number;
  correctAttempts?: number;
  accuracyRate?: number;
  avgConfidence?: number;
  avgTimeSeconds?: number;
  difficultyScore?: number;
  qualityScore?: number;
}

export interface UpdateDropMetricsParams {
  totalViews?: number;
  totalAttempts?: number;
  correctAttempts?: number;
  accuracyRate?: number;
  avgConfidence?: number;
  avgTimeSeconds?: number;
  difficultyScore?: number;
  qualityScore?: number;
}

export class DropMetricsRepository {
  constructor(private pool: Pool) {}

  /**
   * Cria ou atualiza métricas de um drop
   */
  async upsert(params: CreateDropMetricsParams): Promise<DropMetrics> {
    const {
      dropId,
      totalViews = 0,
      totalAttempts = 0,
      correctAttempts = 0,
      accuracyRate = 0,
      avgConfidence = 0,
      avgTimeSeconds = 0,
      difficultyScore = 0.5,
      qualityScore = 0
    } = params;

    const query = `
      INSERT INTO drop_metrics (
        drop_id,
        total_views,
        total_attempts,
        correct_attempts,
        accuracy_rate,
        avg_confidence,
        avg_time_seconds,
        difficulty_score,
        quality_score
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (drop_id) DO UPDATE SET
        total_views = EXCLUDED.total_views,
        total_attempts = EXCLUDED.total_attempts,
        correct_attempts = EXCLUDED.correct_attempts,
        accuracy_rate = EXCLUDED.accuracy_rate,
        avg_confidence = EXCLUDED.avg_confidence,
        avg_time_seconds = EXCLUDED.avg_time_seconds,
        difficulty_score = EXCLUDED.difficulty_score,
        quality_score = EXCLUDED.quality_score,
        last_updated = NOW()
      RETURNING *
    `;

    const values = [
      dropId,
      totalViews,
      totalAttempts,
      correctAttempts,
      accuracyRate,
      avgConfidence,
      avgTimeSeconds,
      difficultyScore,
      qualityScore
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Busca métricas de um drop
   */
  async findByDrop(dropId: number): Promise<DropMetrics | null> {
    const query = `SELECT * FROM drop_metrics WHERE drop_id = $1`;
    const result = await this.pool.query(query, [dropId]);
    return result.rows[0] || null;
  }

  /**
   * Incrementa visualizações de um drop
   */
  async incrementViews(dropId: number): Promise<DropMetrics> {
    const query = `
      INSERT INTO drop_metrics (drop_id, total_views)
      VALUES ($1, 1)
      ON CONFLICT (drop_id) DO UPDATE SET
        total_views = drop_metrics.total_views + 1,
        last_updated = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [dropId]);
    return result.rows[0];
  }

  /**
   * Atualiza métricas após uma tentativa de resposta
   */
  async recordAttempt(
    dropId: number,
    isCorrect: boolean,
    confidenceLevel: number | null,
    timeSpentSeconds: number | null
  ): Promise<DropMetrics> {
    // Buscar métricas atuais
    const current = await this.findByDrop(dropId);

    if (!current) {
      // Criar novas métricas
      return this.upsert({
        dropId,
        totalAttempts: 1,
        correctAttempts: isCorrect ? 1 : 0,
        accuracyRate: isCorrect ? 100 : 0,
        avgConfidence: confidenceLevel || 0,
        avgTimeSeconds: timeSpentSeconds || 0,
        difficultyScore: isCorrect ? 0.3 : 0.7
      });
    }

    // Calcular novas médias
    const newTotalAttempts = current.total_attempts + 1;
    const newCorrectAttempts = current.correct_attempts + (isCorrect ? 1 : 0);
    const newAccuracyRate = (newCorrectAttempts / newTotalAttempts) * 100;

    const newAvgConfidence = confidenceLevel
      ? (current.avg_confidence * current.total_attempts + confidenceLevel) / newTotalAttempts
      : current.avg_confidence;

    const newAvgTimeSeconds = timeSpentSeconds
      ? (current.avg_time_seconds * current.total_attempts + timeSpentSeconds) / newTotalAttempts
      : current.avg_time_seconds;

    // Dificuldade: quanto menor a taxa de acerto, maior a dificuldade
    const newDifficultyScore = 1 - (newAccuracyRate / 100);

    return this.upsert({
      dropId,
      totalViews: current.total_views,
      totalAttempts: newTotalAttempts,
      correctAttempts: newCorrectAttempts,
      accuracyRate: newAccuracyRate,
      avgConfidence: newAvgConfidence,
      avgTimeSeconds: Math.round(newAvgTimeSeconds),
      difficultyScore: newDifficultyScore
    });
  }

  /**
   * Atualiza o quality score de um drop
   */
  async updateQualityScore(dropId: number, qualityScore: number): Promise<DropMetrics | null> {
    const query = `
      UPDATE drop_metrics
      SET quality_score = $2, last_updated = NOW()
      WHERE drop_id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [dropId, qualityScore]);
    return result.rows[0] || null;
  }

  /**
   * Busca drops com baixa qualidade
   */
  async findLowQualityDrops(threshold: number = 0.5, limit: number = 50): Promise<DropMetrics[]> {
    const query = `
      SELECT * FROM drop_metrics
      WHERE quality_score < $1 AND total_attempts >= 5
      ORDER BY quality_score ASC, total_attempts DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [threshold, limit]);
    return result.rows;
  }

  /**
   * Busca drops com alta dificuldade
   */
  async findHighDifficultyDrops(threshold: number = 0.7, limit: number = 50): Promise<DropMetrics[]> {
    const query = `
      SELECT * FROM drop_metrics
      WHERE difficulty_score > $1 AND total_attempts >= 5
      ORDER BY difficulty_score DESC, total_attempts DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [threshold, limit]);
    return result.rows;
  }

  /**
   * Calcula estatísticas gerais de métricas
   */
  async getOverallStats(): Promise<{
    totalDrops: number;
    totalViews: number;
    totalAttempts: number;
    averageAccuracy: number;
    averageQuality: number;
    averageDifficulty: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_drops,
        SUM(total_views) as total_views,
        SUM(total_attempts) as total_attempts,
        ROUND(AVG(accuracy_rate), 2) as avg_accuracy,
        ROUND(AVG(quality_score), 2) as avg_quality,
        ROUND(AVG(difficulty_score), 2) as avg_difficulty
      FROM drop_metrics
    `;

    const result = await this.pool.query(query);
    const row = result.rows[0];

    return {
      totalDrops: parseInt(row.total_drops, 10),
      totalViews: parseInt(row.total_views, 10) || 0,
      totalAttempts: parseInt(row.total_attempts, 10) || 0,
      averageAccuracy: parseFloat(row.avg_accuracy) || 0,
      averageQuality: parseFloat(row.avg_quality) || 0,
      averageDifficulty: parseFloat(row.avg_difficulty) || 0.5
    };
  }

  /**
   * Lista drops com métricas (paginado)
   */
  async list(limit: number = 50, offset: number = 0): Promise<DropMetrics[]> {
    const query = `
      SELECT * FROM drop_metrics
      ORDER BY last_updated DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Deleta métricas de um drop
   */
  async delete(dropId: number): Promise<boolean> {
    const query = `DELETE FROM drop_metrics WHERE drop_id = $1`;
    const result = await this.pool.query(query, [dropId]);
    return result.rowCount > 0;
  }
}
