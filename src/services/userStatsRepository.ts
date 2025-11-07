import { Pool } from 'pg';

export interface UserStat {
  id: number;
  user_id: number;
  drop_id: number;
  is_correct: boolean;
  confidence_level: number | null;
  time_spent_seconds: number | null;
  answered_at: Date;
}

export interface CreateUserStatParams {
  userId: number;
  dropId: number;
  isCorrect: boolean;
  confidenceLevel?: number;
  timeSpentSeconds?: number;
}

export interface UserPerformance {
  userId: number;
  totalAnswers: number;
  correctAnswers: number;
  accuracy: number;
  averageConfidence: number;
  averageTimeSeconds: number;
}

export class UserStatsRepository {
  constructor(private pool: Pool) {}

  /**
   * Registra uma resposta do usuário a um drop
   */
  async create(params: CreateUserStatParams): Promise<UserStat> {
    const { userId, dropId, isCorrect, confidenceLevel, timeSpentSeconds } = params;

    const query = `
      INSERT INTO user_stats (
        user_id,
        drop_id,
        is_correct,
        confidence_level,
        time_spent_seconds
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      userId,
      dropId,
      isCorrect,
      confidenceLevel || null,
      timeSpentSeconds || null
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Busca estatísticas de um usuário para um drop específico
   */
  async findByUserAndDrop(userId: number, dropId: number): Promise<UserStat[]> {
    const query = `
      SELECT * FROM user_stats
      WHERE user_id = $1 AND drop_id = $2
      ORDER BY answered_at DESC
    `;

    const result = await this.pool.query(query, [userId, dropId]);
    return result.rows;
  }

  /**
   * Busca todas as estatísticas de um usuário
   */
  async findByUser(userId: number, limit: number = 100): Promise<UserStat[]> {
    const query = `
      SELECT * FROM user_stats
      WHERE user_id = $1
      ORDER BY answered_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Calcula a performance geral de um usuário
   */
  async getUserPerformance(userId: number): Promise<UserPerformance> {
    const query = `
      SELECT
        user_id,
        COUNT(*) as total_answers,
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_answers,
        ROUND(AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100, 2) as accuracy,
        ROUND(AVG(confidence_level), 2) as average_confidence,
        ROUND(AVG(time_spent_seconds), 2) as average_time_seconds
      FROM user_stats
      WHERE user_id = $1
      GROUP BY user_id
    `;

    const result = await this.pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return {
        userId,
        totalAnswers: 0,
        correctAnswers: 0,
        accuracy: 0,
        averageConfidence: 0,
        averageTimeSeconds: 0
      };
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      totalAnswers: parseInt(row.total_answers, 10),
      correctAnswers: parseInt(row.correct_answers, 10),
      accuracy: parseFloat(row.accuracy),
      averageConfidence: parseFloat(row.average_confidence) || 0,
      averageTimeSeconds: parseFloat(row.average_time_seconds) || 0
    };
  }

  /**
   * Calcula a performance de um usuário em uma matéria específica
   */
  async getUserPerformanceBySubject(userId: number, subjectId: number): Promise<UserPerformance> {
    const query = `
      SELECT
        us.user_id,
        COUNT(*) as total_answers,
        SUM(CASE WHEN us.is_correct THEN 1 ELSE 0 END) as correct_answers,
        ROUND(AVG(CASE WHEN us.is_correct THEN 1.0 ELSE 0.0 END) * 100, 2) as accuracy,
        ROUND(AVG(us.confidence_level), 2) as average_confidence,
        ROUND(AVG(us.time_spent_seconds), 2) as average_time_seconds
      FROM user_stats us
      INNER JOIN drops d ON us.drop_id = d.id
      WHERE us.user_id = $1 AND d.subject_id = $2
      GROUP BY us.user_id
    `;

    const result = await this.pool.query(query, [userId, subjectId]);
    
    if (result.rows.length === 0) {
      return {
        userId,
        totalAnswers: 0,
        correctAnswers: 0,
        accuracy: 0,
        averageConfidence: 0,
        averageTimeSeconds: 0
      };
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      totalAnswers: parseInt(row.total_answers, 10),
      correctAnswers: parseInt(row.correct_answers, 10),
      accuracy: parseFloat(row.accuracy),
      averageConfidence: parseFloat(row.average_confidence) || 0,
      averageTimeSeconds: parseFloat(row.average_time_seconds) || 0
    };
  }

  /**
   * Identifica drops que o usuário tem mais dificuldade
   */
  async getWeakDrops(userId: number, limit: number = 10): Promise<number[]> {
    const query = `
      SELECT drop_id
      FROM user_stats
      WHERE user_id = $1
      GROUP BY drop_id
      HAVING AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) < 0.5
      ORDER BY AVG(confidence_level) ASC, COUNT(*) DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [userId, limit]);
    return result.rows.map(row => row.drop_id);
  }

  /**
   * Conta o total de respostas de um usuário
   */
  async count(userId: number): Promise<number> {
    const query = `SELECT COUNT(*) as total FROM user_stats WHERE user_id = $1`;
    const result = await this.pool.query(query, [userId]);
    return parseInt(result.rows[0].total, 10);
  }
}
