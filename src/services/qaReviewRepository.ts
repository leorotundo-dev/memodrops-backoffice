import { Pool } from 'pg';

export interface QAReview {
  id: number;
  drop_id: number;
  reviewer_type: 'human' | 'automated';
  reviewer_id: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  quality_score: number | null;
  feedback: any;
  notes: string | null;
  reviewed_at: Date;
  created_at: Date;
}

export interface CreateQAReviewParams {
  dropId: number;
  reviewerType: 'human' | 'automated';
  reviewerId?: number;
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  qualityScore?: number;
  feedback?: any;
  notes?: string;
}

export interface UpdateQAReviewParams {
  status?: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  qualityScore?: number;
  feedback?: any;
  notes?: string;
}

export class QAReviewRepository {
  constructor(private pool: Pool) {}

  /**
   * Cria uma nova revisão de QA
   */
  async create(params: CreateQAReviewParams): Promise<QAReview> {
    const {
      dropId,
      reviewerType,
      reviewerId,
      status,
      qualityScore,
      feedback,
      notes
    } = params;

    const query = `
      INSERT INTO qa_reviews (
        drop_id,
        reviewer_type,
        reviewer_id,
        status,
        quality_score,
        feedback,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      dropId,
      reviewerType,
      reviewerId || null,
      status,
      qualityScore || null,
      feedback ? JSON.stringify(feedback) : '{}',
      notes || null
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Busca uma revisão por ID
   */
  async findById(id: number): Promise<QAReview | null> {
    const query = `SELECT * FROM qa_reviews WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Busca todas as revisões de um drop
   */
  async findByDrop(dropId: number): Promise<QAReview[]> {
    const query = `
      SELECT * FROM qa_reviews
      WHERE drop_id = $1
      ORDER BY reviewed_at DESC
    `;
    const result = await this.pool.query(query, [dropId]);
    return result.rows;
  }

  /**
   * Busca a última revisão de um drop
   */
  async findLatestByDrop(dropId: number): Promise<QAReview | null> {
    const query = `
      SELECT * FROM qa_reviews
      WHERE drop_id = $1
      ORDER BY reviewed_at DESC
      LIMIT 1
    `;
    const result = await this.pool.query(query, [dropId]);
    return result.rows[0] || null;
  }

  /**
   * Busca revisões por status
   */
  async findByStatus(
    status: 'pending' | 'approved' | 'rejected' | 'needs_revision',
    limit: number = 50
  ): Promise<QAReview[]> {
    const query = `
      SELECT * FROM qa_reviews
      WHERE status = $1
      ORDER BY reviewed_at DESC
      LIMIT $2
    `;
    const result = await this.pool.query(query, [status, limit]);
    return result.rows;
  }

  /**
   * Atualiza uma revisão
   */
  async update(id: number, params: UpdateQAReviewParams): Promise<QAReview | null> {
    const { status, qualityScore, feedback, notes } = params;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (qualityScore !== undefined) {
      updates.push(`quality_score = $${paramIndex++}`);
      values.push(qualityScore);
    }

    if (feedback !== undefined) {
      updates.push(`feedback = $${paramIndex++}`);
      values.push(JSON.stringify(feedback));
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`reviewed_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE qa_reviews
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Conta revisões por status
   */
  async countByStatus(status: 'pending' | 'approved' | 'rejected' | 'needs_revision'): Promise<number> {
    const query = `SELECT COUNT(*) as total FROM qa_reviews WHERE status = $1`;
    const result = await this.pool.query(query, [status]);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Calcula estatísticas de QA
   */
  async getQAStats(): Promise<{
    totalReviews: number;
    pending: number;
    approved: number;
    rejected: number;
    needsRevision: number;
    averageQualityScore: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total_reviews,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'needs_revision' THEN 1 ELSE 0 END) as needs_revision,
        ROUND(AVG(quality_score), 2) as avg_quality_score
      FROM qa_reviews
    `;

    const result = await this.pool.query(query);
    const row = result.rows[0];

    return {
      totalReviews: parseInt(row.total_reviews, 10),
      pending: parseInt(row.pending, 10),
      approved: parseInt(row.approved, 10),
      rejected: parseInt(row.rejected, 10),
      needsRevision: parseInt(row.needs_revision, 10),
      averageQualityScore: parseFloat(row.avg_quality_score) || 0
    };
  }

  /**
   * Deleta uma revisão
   */
  async delete(id: number): Promise<boolean> {
    const query = `DELETE FROM qa_reviews WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }
}
