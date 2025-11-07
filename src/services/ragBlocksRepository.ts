import { Pool } from 'pg';

export interface RAGBlock {
  id: number;
  source: string;
  source_type: 'pdf' | 'video' | 'article' | 'book' | 'manual';
  topic_id: number | null;
  title: string | null;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, any>;
  chunk_index: number;
  total_chunks: number;
  quality_score: number;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRAGBlockParams {
  source: string;
  sourceType: 'pdf' | 'video' | 'article' | 'book' | 'manual';
  topicId?: number;
  title?: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  chunkIndex?: number;
  totalChunks?: number;
  qualityScore?: number;
}

export interface SearchRAGBlocksParams {
  embedding: number[];
  limit?: number;
  topicId?: number;
  sourceType?: string;
  minQualityScore?: number;
  onlyVerified?: boolean;
}

export class RAGBlocksRepository {
  constructor(private pool: Pool) {}

  /**
   * Cria um novo bloco RAG
   */
  async create(params: CreateRAGBlockParams): Promise<RAGBlock> {
    const {
      source,
      sourceType,
      topicId,
      title,
      content,
      embedding,
      metadata = {},
      chunkIndex = 0,
      totalChunks = 1,
      qualityScore = 0.5
    } = params;

    const query = `
      INSERT INTO rag_blocks (
        source,
        source_type,
        topic_id,
        title,
        content,
        embedding,
        metadata,
        chunk_index,
        total_chunks,
        quality_score
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      source,
      sourceType,
      topicId || null,
      title || null,
      content,
      embedding ? `[${embedding.join(',')}]` : null,
      JSON.stringify(metadata),
      chunkIndex,
      totalChunks,
      qualityScore
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Busca um bloco por ID
   */
  async findById(id: number): Promise<RAGBlock | null> {
    const query = `SELECT * FROM rag_blocks WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Busca blocos por fonte
   */
  async findBySource(source: string): Promise<RAGBlock[]> {
    const query = `
      SELECT * FROM rag_blocks
      WHERE source = $1
      ORDER BY chunk_index ASC
    `;

    const result = await this.pool.query(query, [source]);
    return result.rows;
  }

  /**
   * Busca blocos por tópico
   */
  async findByTopic(topicId: number, limit: number = 50): Promise<RAGBlock[]> {
    const query = `
      SELECT * FROM rag_blocks
      WHERE topic_id = $1
      ORDER BY quality_score DESC, created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [topicId, limit]);
    return result.rows;
  }

  /**
   * Busca blocos por tipo de fonte
   */
  async findBySourceType(
    sourceType: 'pdf' | 'video' | 'article' | 'book' | 'manual',
    limit: number = 50
  ): Promise<RAGBlock[]> {
    const query = `
      SELECT * FROM rag_blocks
      WHERE source_type = $1
      ORDER BY quality_score DESC, created_at DESC
      LIMIT $2
    `;

    const result = await this.pool.query(query, [sourceType, limit]);
    return result.rows;
  }

  /**
   * Busca blocos por similaridade de embedding (busca semântica)
   */
  async searchBySimilarity(params: SearchRAGBlocksParams): Promise<RAGBlock[]> {
    const {
      embedding,
      limit = 10,
      topicId,
      sourceType,
      minQualityScore = 0,
      onlyVerified = false
    } = params;

    let query = `
      SELECT *,
        1 - (embedding <=> $1::vector) as similarity
      FROM rag_blocks
      WHERE embedding IS NOT NULL
    `;

    const values: any[] = [`[${embedding.join(',')}]`];
    let paramIndex = 2;

    if (topicId) {
      query += ` AND topic_id = $${paramIndex}`;
      values.push(topicId);
      paramIndex++;
    }

    if (sourceType) {
      query += ` AND source_type = $${paramIndex}`;
      values.push(sourceType);
      paramIndex++;
    }

    if (minQualityScore > 0) {
      query += ` AND quality_score >= $${paramIndex}`;
      values.push(minQualityScore);
      paramIndex++;
    }

    if (onlyVerified) {
      query += ` AND is_verified = true`;
    }

    query += `
      ORDER BY similarity DESC
      LIMIT $${paramIndex}
    `;
    values.push(limit);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  /**
   * Atualiza o embedding de um bloco
   */
  async updateEmbedding(id: number, embedding: number[]): Promise<RAGBlock> {
    const query = `
      UPDATE rag_blocks
      SET embedding = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.pool.query(query, [`[${embedding.join(',')}]`, id]);
    return result.rows[0];
  }

  /**
   * Atualiza o quality score de um bloco
   */
  async updateQualityScore(id: number, qualityScore: number): Promise<RAGBlock> {
    const query = `
      UPDATE rag_blocks
      SET quality_score = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.pool.query(query, [qualityScore, id]);
    return result.rows[0];
  }

  /**
   * Marca um bloco como verificado
   */
  async markAsVerified(id: number): Promise<RAGBlock> {
    const query = `
      UPDATE rag_blocks
      SET is_verified = true, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Deleta um bloco
   */
  async delete(id: number): Promise<boolean> {
    const query = `DELETE FROM rag_blocks WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Deleta todos os blocos de uma fonte
   */
  async deleteBySource(source: string): Promise<number> {
    const query = `DELETE FROM rag_blocks WHERE source = $1`;
    const result = await this.pool.query(query, [source]);
    return result.rowCount;
  }

  /**
   * Lista blocos não verificados
   */
  async findUnverified(limit: number = 50): Promise<RAGBlock[]> {
    const query = `
      SELECT * FROM rag_blocks
      WHERE is_verified = false
      ORDER BY quality_score DESC, created_at DESC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  /**
   * Conta blocos por tipo de fonte
   */
  async countBySourceType(): Promise<{ sourceType: string; count: number }[]> {
    const query = `
      SELECT source_type as "sourceType", COUNT(*) as count
      FROM rag_blocks
      GROUP BY source_type
      ORDER BY count DESC
    `;

    const result = await this.pool.query(query);
    return result.rows.map(row => ({
      sourceType: row.sourceType,
      count: parseInt(row.count, 10)
    }));
  }
}
