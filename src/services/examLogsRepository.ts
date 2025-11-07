import { Pool } from 'pg';

export interface ExamLog {
  id: number;
  user_id: number;
  edital_id: number | null;
  exam_type: 'simulado' | 'prova_real' | 'revisao';
  score: number | null;
  total_questions: number;
  correct_answers: number;
  time_spent_minutes: number | null;
  topics_covered: number[];
  weak_topics: number[];
  completed_at: Date;
  created_at: Date;
}

export interface CreateExamLogParams {
  userId: number;
  editalId?: number;
  examType: 'simulado' | 'prova_real' | 'revisao';
  score?: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpentMinutes?: number;
  topicsCovered?: number[];
  weakTopics?: number[];
}

export class ExamLogsRepository {
  constructor(private pool: Pool) {}

  /**
   * Cria um novo log de exame
   */
  async create(params: CreateExamLogParams): Promise<ExamLog> {
    const {
      userId,
      editalId,
      examType,
      score,
      totalQuestions,
      correctAnswers,
      timeSpentMinutes,
      topicsCovered = [],
      weakTopics = []
    } = params;

    const query = `
      INSERT INTO exam_logs (
        user_id,
        edital_id,
        exam_type,
        score,
        total_questions,
        correct_answers,
        time_spent_minutes,
        topics_covered,
        weak_topics
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      userId,
      editalId || null,
      examType,
      score || null,
      totalQuestions,
      correctAnswers,
      timeSpentMinutes || null,
      topicsCovered,
      weakTopics
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Busca um log por ID
   */
  async findById(id: number): Promise<ExamLog | null> {
    const query = `SELECT * FROM exam_logs WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Busca todos os logs de um usuário
   */
  async findByUser(userId: number, limit: number = 50): Promise<ExamLog[]> {
    const query = `
      SELECT * FROM exam_logs
      WHERE user_id = $1
      ORDER BY completed_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Busca logs de um usuário por tipo de exame
   */
  async findByUserAndType(
    userId: number,
    examType: 'simulado' | 'prova_real' | 'revisao',
    limit: number = 50
  ): Promise<ExamLog[]> {
    const query = `
      SELECT * FROM exam_logs
      WHERE user_id = $1 AND exam_type = $2
      ORDER BY completed_at DESC
      LIMIT $3
    `;

    const result = await this.pool.query(query, [userId, examType, limit]);
    return result.rows;
  }

  /**
   * Busca logs de um edital específico
   */
  async findByEdital(editalId: number, limit: number = 100): Promise<ExamLog[]> {
    const query = `
      SELECT * FROM exam_logs
      WHERE edital_id = $1
      ORDER BY completed_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [editalId, limit]);
    return result.rows;
  }

  /**
   * Calcula estatísticas de um usuário
   */
  async getUserStats(userId: number): Promise<{
    totalExams: number;
    totalSimulados: number;
    totalProvasReais: number;
    averageScore: number;
    bestScore: number;
    worstScore: number;
    totalTimeMinutes: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_exams,
        SUM(CASE WHEN exam_type = 'simulado' THEN 1 ELSE 0 END) as total_simulados,
        SUM(CASE WHEN exam_type = 'prova_real' THEN 1 ELSE 0 END) as total_provas_reais,
        ROUND(AVG(score), 2) as average_score,
        MAX(score) as best_score,
        MIN(score) as worst_score,
        SUM(time_spent_minutes) as total_time_minutes
      FROM exam_logs
      WHERE user_id = $1 AND score IS NOT NULL
    `;

    const result = await this.pool.query(query, [userId]);
    const row = result.rows[0];

    return {
      totalExams: parseInt(row.total_exams, 10),
      totalSimulados: parseInt(row.total_simulados, 10),
      totalProvasReais: parseInt(row.total_provas_reais, 10),
      averageScore: parseFloat(row.average_score) || 0,
      bestScore: parseFloat(row.best_score) || 0,
      worstScore: parseFloat(row.worst_score) || 0,
      totalTimeMinutes: parseInt(row.total_time_minutes, 10) || 0
    };
  }

  /**
   * Identifica tópicos fracos de um usuário (mais frequentes em weak_topics)
   */
  async getWeakTopics(userId: number, limit: number = 10): Promise<{ topicId: number; count: number }[]> {
    const query = `
      SELECT
        unnest(weak_topics) as topic_id,
        COUNT(*) as count
      FROM exam_logs
      WHERE user_id = $1
      GROUP BY topic_id
      ORDER BY count DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [userId, limit]);
    return result.rows.map(row => ({
      topicId: row.topic_id,
      count: parseInt(row.count, 10)
    }));
  }

  /**
   * Busca o progresso de um usuário ao longo do tempo
   */
  async getProgressOverTime(userId: number): Promise<{ date: string; score: number }[]> {
    const query = `
      SELECT
        DATE(completed_at) as date,
        AVG(score) as score
      FROM exam_logs
      WHERE user_id = $1 AND score IS NOT NULL
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows.map(row => ({
      date: row.date,
      score: parseFloat(row.score)
    }));
  }

  /**
   * Deleta um log
   */
  async delete(id: number): Promise<boolean> {
    const query = `DELETE FROM exam_logs WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }
}
