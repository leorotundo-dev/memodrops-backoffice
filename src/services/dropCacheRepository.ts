import { Pool } from 'pg';

export interface DropCache {
  id: number;
  blueprint_id: number;
  subject_id: number | null;
  content_hash: string;
  drop_id: number;
  created_at: Date;
}

export interface CreateDropCacheParams {
  blueprintId: number;
  subjectId?: number;
  contentHash: string;
  dropId: number;
}

export class DropCacheRepository {
  constructor(private pool: Pool) {}

  /**
   * Cria uma nova entrada no cache
   */
  async create(params: CreateDropCacheParams): Promise<DropCache> {
    const { blueprintId, subjectId, contentHash, dropId } = params;

    const query = `
      INSERT INTO drop_cache (
        blueprint_id,
        subject_id,
        content_hash,
        drop_id
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (content_hash) DO NOTHING
      RETURNING *
    `;

    const values = [blueprintId, subjectId || null, contentHash, dropId];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Verifica se um hash já existe no cache
   */
  async exists(contentHash: string): Promise<boolean> {
    const query = `SELECT EXISTS(SELECT 1 FROM drop_cache WHERE content_hash = $1) as exists`;
    const result = await this.pool.query(query, [contentHash]);
    return result.rows[0].exists;
  }

  /**
   * Busca uma entrada do cache por hash
   */
  async findByHash(contentHash: string): Promise<DropCache | null> {
    const query = `SELECT * FROM drop_cache WHERE content_hash = $1`;
    const result = await this.pool.query(query, [contentHash]);
    return result.rows[0] || null;
  }

  /**
   * Busca entradas do cache por blueprint_id
   */
  async findByBlueprintId(blueprintId: number): Promise<DropCache[]> {
    const query = `
      SELECT * FROM drop_cache
      WHERE blueprint_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [blueprintId]);
    return result.rows;
  }

  /**
   * Busca entradas do cache por blueprint_id e subject_id
   */
  async findByBlueprintAndSubject(
    blueprintId: number,
    subjectId: number
  ): Promise<DropCache[]> {
    const query = `
      SELECT * FROM drop_cache
      WHERE blueprint_id = $1 AND subject_id = $2
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [blueprintId, subjectId]);
    return result.rows;
  }

  /**
   * Deleta entradas do cache por blueprint_id
   */
  async deleteByBlueprintId(blueprintId: number): Promise<number> {
    const query = `DELETE FROM drop_cache WHERE blueprint_id = $1`;
    const result = await this.pool.query(query, [blueprintId]);
    return result.rowCount;
  }

  /**
   * Deleta entradas antigas do cache (limpeza)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const query = `
      DELETE FROM drop_cache
      WHERE created_at < NOW() - INTERVAL '${days} days'
    `;

    const result = await this.pool.query(query);
    return result.rowCount;
  }

  /**
   * Conta o total de entradas no cache
   */
  async count(): Promise<number> {
    const query = `SELECT COUNT(*) as total FROM drop_cache`;
    const result = await this.pool.query(query);
    return parseInt(result.rows[0].total, 10);
  }
}
