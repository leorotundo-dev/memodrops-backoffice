import { Pool } from 'pg';
import { DropType } from '../config/goldRule.js';

export interface Drop {
  id: number;
  blueprint_id: number;
  subject_id: number | null;
  drop_text: string;
  drop_type: string;
  model: string;
  prompt_version: string;
  metadata: any;
  created_at: Date;
}

export interface CreateDropParams {
  blueprintId: number;
  subjectId?: number;
  dropText: string;
  dropType: DropType;
  model: string;
  promptVersion: string;
  metadata?: any;
}

export class DropRepository {
  constructor(private pool: Pool) {}

  /**
   * Cria um novo drop no banco de dados
   */
  async create(params: CreateDropParams): Promise<Drop> {
    const {
      blueprintId,
      subjectId,
      dropText,
      dropType,
      model,
      promptVersion,
      metadata
    } = params;

    const query = `
      INSERT INTO drops (
        blueprint_id,
        subject_id,
        drop_text,
        drop_type,
        model,
        prompt_version,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      blueprintId,
      subjectId || null,
      dropText,
      dropType,
      model,
      promptVersion,
      metadata ? JSON.stringify(metadata) : null
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Cria múltiplos drops de uma vez (batch insert)
   */
  async createBatch(drops: CreateDropParams[]): Promise<Drop[]> {
    if (drops.length === 0) return [];

    const values: any[] = [];
    const placeholders: string[] = [];

    drops.forEach((drop, index) => {
      const offset = index * 7;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
      );
      values.push(
        drop.blueprintId,
        drop.subjectId || null,
        drop.dropText,
        drop.dropType,
        drop.model,
        drop.promptVersion,
        drop.metadata ? JSON.stringify(drop.metadata) : null
      );
    });

    const query = `
      INSERT INTO drops (
        blueprint_id,
        subject_id,
        drop_text,
        drop_type,
        model,
        prompt_version,
        metadata
      )
      VALUES ${placeholders.join(', ')}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Busca drops por blueprint_id
   */
  async findByBlueprintId(blueprintId: number): Promise<Drop[]> {
    const query = `
      SELECT * FROM drops
      WHERE blueprint_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [blueprintId]);
    return result.rows;
  }

  /**
   * Busca drops por subject_id
   */
  async findBySubjectId(subjectId: number): Promise<Drop[]> {
    const query = `
      SELECT * FROM drops
      WHERE subject_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [subjectId]);
    return result.rows;
  }

  /**
   * Busca um drop por ID
   */
  async findById(id: number): Promise<Drop | null> {
    const query = `SELECT * FROM drops WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Lista drops com filtros e paginação
   */
  async list(options: {
    blueprintId?: number;
    subjectId?: number;
    dropType?: string;
    limit?: number;
    offset?: number;
  }): Promise<Drop[]> {
    const { blueprintId, subjectId, dropType, limit = 50, offset = 0 } = options;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (blueprintId) {
      conditions.push(`blueprint_id = $${paramIndex++}`);
      values.push(blueprintId);
    }

    if (subjectId) {
      conditions.push(`subject_id = $${paramIndex++}`);
      values.push(subjectId);
    }

    if (dropType) {
      conditions.push(`drop_type = $${paramIndex++}`);
      values.push(dropType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM drops
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Conta o total de drops com filtros
   */
  async count(options: {
    blueprintId?: number;
    subjectId?: number;
    dropType?: string;
  } = {}): Promise<number> {
    const { blueprintId, subjectId, dropType } = options;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (blueprintId) {
      conditions.push(`blueprint_id = $${paramIndex++}`);
      values.push(blueprintId);
    }

    if (subjectId) {
      conditions.push(`subject_id = $${paramIndex++}`);
      values.push(subjectId);
    }

    if (dropType) {
      conditions.push(`drop_type = $${paramIndex++}`);
      values.push(dropType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `SELECT COUNT(*) as total FROM drops ${whereClause}`;
    const result = await this.pool.query(query, values);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Deleta um drop por ID
   */
  async delete(id: number): Promise<boolean> {
    const query = `DELETE FROM drops WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }
}
