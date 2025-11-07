import { Pool } from 'pg';

export interface DailyPlan {
  id: number;
  user_id: number;
  date: Date;
  drops_ids: number[];
  target_drops_count: number;
  completed_drops_count: number;
  total_time_minutes: number;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: Date;
  updated_at: Date;
}

export interface CreateDailyPlanParams {
  userId: number;
  date: Date;
  dropsIds: number[];
  targetDropsCount?: number;
}

export interface UpdateDailyPlanParams {
  completedDropsCount?: number;
  totalTimeMinutes?: number;
  status?: 'pending' | 'in_progress' | 'completed';
}

export class DailyPlanRepository {
  constructor(private pool: Pool) {}

  /**
   * Cria um novo plano diário
   */
  async create(params: CreateDailyPlanParams): Promise<DailyPlan> {
    const { userId, date, dropsIds, targetDropsCount } = params;

    const query = `
      INSERT INTO daily_plans (
        user_id,
        date,
        drops_ids,
        target_drops_count
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, date) DO UPDATE SET
        drops_ids = EXCLUDED.drops_ids,
        target_drops_count = EXCLUDED.target_drops_count,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      userId,
      date,
      dropsIds,
      targetDropsCount || dropsIds.length
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Busca o plano diário de um usuário para uma data específica
   */
  async findByUserAndDate(userId: number, date: Date): Promise<DailyPlan | null> {
    const query = `
      SELECT * FROM daily_plans
      WHERE user_id = $1 AND date = $2
    `;

    const result = await this.pool.query(query, [userId, date]);
    return result.rows[0] || null;
  }

  /**
   * Busca o plano diário de hoje de um usuário
   */
  async findTodayPlan(userId: number): Promise<DailyPlan | null> {
    const query = `
      SELECT * FROM daily_plans
      WHERE user_id = $1 AND date = CURRENT_DATE
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Busca os planos diários de um usuário (últimos N dias)
   */
  async findByUser(userId: number, limit: number = 30): Promise<DailyPlan[]> {
    const query = `
      SELECT * FROM daily_plans
      WHERE user_id = $1
      ORDER BY date DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Atualiza um plano diário
   */
  async update(id: number, params: UpdateDailyPlanParams): Promise<DailyPlan | null> {
    const { completedDropsCount, totalTimeMinutes, status } = params;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (completedDropsCount !== undefined) {
      updates.push(`completed_drops_count = $${paramIndex++}`);
      values.push(completedDropsCount);
    }

    if (totalTimeMinutes !== undefined) {
      updates.push(`total_time_minutes = $${paramIndex++}`);
      values.push(totalTimeMinutes);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      const query = `SELECT * FROM daily_plans WHERE id = $1`;
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE daily_plans
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Marca um drop como completado no plano
   */
  async markDropCompleted(planId: number, timeSpentMinutes: number): Promise<DailyPlan | null> {
    const query = `
      UPDATE daily_plans
      SET
        completed_drops_count = completed_drops_count + 1,
        total_time_minutes = total_time_minutes + $2,
        status = CASE
          WHEN completed_drops_count + 1 >= target_drops_count THEN 'completed'::text
          ELSE 'in_progress'::text
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, [planId, timeSpentMinutes]);
    return result.rows[0] || null;
  }

  /**
   * Calcula estatísticas de conclusão de planos de um usuário
   */
  async getUserPlanStats(userId: number, days: number = 30): Promise<{
    totalPlans: number;
    completedPlans: number;
    completionRate: number;
    averageCompletionPercentage: number;
    totalTimeMinutes: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_plans,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_plans,
        ROUND(AVG(completed_drops_count::float / NULLIF(target_drops_count, 0) * 100), 2) as avg_completion_percentage,
        SUM(total_time_minutes) as total_time_minutes
      FROM daily_plans
      WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days'
    `;

    const result = await this.pool.query(query, [userId]);
    const row = result.rows[0];

    const totalPlans = parseInt(row.total_plans, 10);
    const completedPlans = parseInt(row.completed_plans, 10);

    return {
      totalPlans,
      completedPlans,
      completionRate: totalPlans > 0 ? (completedPlans / totalPlans) * 100 : 0,
      averageCompletionPercentage: parseFloat(row.avg_completion_percentage) || 0,
      totalTimeMinutes: parseInt(row.total_time_minutes, 10) || 0
    };
  }

  /**
   * Deleta um plano diário
   */
  async delete(id: number): Promise<boolean> {
    const query = `DELETE FROM daily_plans WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }
}
