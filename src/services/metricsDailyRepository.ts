import { Pool } from 'pg';

export interface MetricsDaily {
  id: number;
  date: string; // YYYY-MM-DD
  drops_generated: number;
  drops_approved: number;
  drops_rejected: number;
  qa_evaluations: number;
  cost_openai: number;
  cost_railway: number;
  total_cost: number;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateMetricsDailyParams {
  dropsGenerated?: number;
  dropsApproved?: number;
  dropsRejected?: number;
  qaEvaluations?: number;
  costOpenai?: number;
  costRailway?: number;
}

export class MetricsDailyRepository {
  constructor(private pool: Pool) {}

  /**
   * Busca ou cria métricas de um dia específico
   */
  async getOrCreate(date: string): Promise<MetricsDaily> {
    const query = `
      INSERT INTO metrics_daily (date)
      VALUES ($1)
      ON CONFLICT (date) DO UPDATE SET updated_at = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [date]);
    return result.rows[0];
  }

  /**
   * Busca métricas de um dia específico
   */
  async findByDate(date: string): Promise<MetricsDaily | null> {
    const query = `SELECT * FROM metrics_daily WHERE date = $1`;
    const result = await this.pool.query(query, [date]);
    return result.rows[0] || null;
  }

  /**
   * Incrementa drops gerados
   */
  async incrementDropsGenerated(date: string, count: number = 1): Promise<MetricsDaily> {
    const query = `
      INSERT INTO metrics_daily (date, drops_generated)
      VALUES ($1, $2)
      ON CONFLICT (date) DO UPDATE SET
        drops_generated = metrics_daily.drops_generated + $2,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [date, count]);
    return result.rows[0];
  }

  /**
   * Incrementa drops aprovados
   */
  async incrementDropsApproved(date: string, count: number = 1): Promise<MetricsDaily> {
    const query = `
      INSERT INTO metrics_daily (date, drops_approved)
      VALUES ($1, $2)
      ON CONFLICT (date) DO UPDATE SET
        drops_approved = metrics_daily.drops_approved + $2,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [date, count]);
    return result.rows[0];
  }

  /**
   * Incrementa drops rejeitados
   */
  async incrementDropsRejected(date: string, count: number = 1): Promise<MetricsDaily> {
    const query = `
      INSERT INTO metrics_daily (date, drops_rejected)
      VALUES ($1, $2)
      ON CONFLICT (date) DO UPDATE SET
        drops_rejected = metrics_daily.drops_rejected + $2,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [date, count]);
    return result.rows[0];
  }

  /**
   * Incrementa avaliações de QA
   */
  async incrementQAEvaluations(date: string, count: number = 1): Promise<MetricsDaily> {
    const query = `
      INSERT INTO metrics_daily (date, qa_evaluations)
      VALUES ($1, $2)
      ON CONFLICT (date) DO UPDATE SET
        qa_evaluations = metrics_daily.qa_evaluations + $2,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [date, count]);
    return result.rows[0];
  }

  /**
   * Adiciona custo da OpenAI
   */
  async addOpenAICost(date: string, cost: number): Promise<MetricsDaily> {
    const query = `
      INSERT INTO metrics_daily (date, cost_openai)
      VALUES ($1, $2)
      ON CONFLICT (date) DO UPDATE SET
        cost_openai = metrics_daily.cost_openai + $2,
        total_cost = metrics_daily.total_cost + $2,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [date, cost]);
    return result.rows[0];
  }

  /**
   * Adiciona custo do Railway
   */
  async addRailwayCost(date: string, cost: number): Promise<MetricsDaily> {
    const query = `
      INSERT INTO metrics_daily (date, cost_railway)
      VALUES ($1, $2)
      ON CONFLICT (date) DO UPDATE SET
        cost_railway = metrics_daily.cost_railway + $2,
        total_cost = metrics_daily.total_cost + $2,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.pool.query(query, [date, cost]);
    return result.rows[0];
  }

  /**
   * Busca métricas de um período
   */
  async findByPeriod(startDate: string, endDate: string): Promise<MetricsDaily[]> {
    const query = `
      SELECT * FROM metrics_daily
      WHERE date BETWEEN $1 AND $2
      ORDER BY date DESC
    `;

    const result = await this.pool.query(query, [startDate, endDate]);
    return result.rows;
  }

  /**
   * Busca métricas dos últimos N dias
   */
  async findLastNDays(days: number = 30): Promise<MetricsDaily[]> {
    const query = `
      SELECT * FROM metrics_daily
      ORDER BY date DESC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [days]);
    return result.rows;
  }

  /**
   * Calcula totais de um período
   */
  async getTotals(startDate: string, endDate: string): Promise<{
    totalDropsGenerated: number;
    totalDropsApproved: number;
    totalDropsRejected: number;
    totalQAEvaluations: number;
    totalCostOpenAI: number;
    totalCostRailway: number;
    totalCost: number;
  }> {
    const query = `
      SELECT
        SUM(drops_generated) as total_drops_generated,
        SUM(drops_approved) as total_drops_approved,
        SUM(drops_rejected) as total_drops_rejected,
        SUM(qa_evaluations) as total_qa_evaluations,
        SUM(cost_openai) as total_cost_openai,
        SUM(cost_railway) as total_cost_railway,
        SUM(total_cost) as total_cost
      FROM metrics_daily
      WHERE date BETWEEN $1 AND $2
    `;

    const result = await this.pool.query(query, [startDate, endDate]);
    const row = result.rows[0];

    return {
      totalDropsGenerated: parseInt(row.total_drops_generated, 10) || 0,
      totalDropsApproved: parseInt(row.total_drops_approved, 10) || 0,
      totalDropsRejected: parseInt(row.total_drops_rejected, 10) || 0,
      totalQAEvaluations: parseInt(row.total_qa_evaluations, 10) || 0,
      totalCostOpenAI: parseFloat(row.total_cost_openai) || 0,
      totalCostRailway: parseFloat(row.total_cost_railway) || 0,
      totalCost: parseFloat(row.total_cost) || 0
    };
  }

  /**
   * Busca métricas de hoje
   */
  async getToday(): Promise<MetricsDaily> {
    const today = new Date().toISOString().split('T')[0];
    return this.getOrCreate(today);
  }
}
