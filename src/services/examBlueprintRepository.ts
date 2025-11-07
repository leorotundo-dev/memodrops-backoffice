import { Pool } from 'pg';

export interface ExamBlueprint {
  id: number;
  harvest_item_id: string;
  model: string;
  prompt_version: string;
  raw_response: any;
  structured_data: any;
  created_at: Date;
}

export interface CreateExamBlueprintParams {
  harvestItemId: string;
  model: string;
  promptVersion: string;
  rawResponse: any;
  structuredData: any;
}

export class ExamBlueprintRepository {
  constructor(private pool: Pool) {}

  /**
   * Cria um novo exam blueprint no banco de dados
   */
  async create(params: CreateExamBlueprintParams): Promise<ExamBlueprint> {
    const { harvestItemId, model, promptVersion, rawResponse, structuredData } = params;

    const query = `
      INSERT INTO exam_blueprints (
        harvest_item_id,
        model,
        prompt_version,
        raw_response,
        structured_data
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      harvestItemId,
      model,
      promptVersion,
      JSON.stringify(rawResponse),
      JSON.stringify(structuredData)
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Busca um blueprint por harvest_item_id
   */
  async findByHarvestItemId(harvestItemId: string): Promise<ExamBlueprint | null> {
    const query = `
      SELECT * FROM exam_blueprints
      WHERE harvest_item_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.pool.query(query, [harvestItemId]);
    return result.rows[0] || null;
  }

  /**
   * Busca um blueprint por ID
   */
  async findById(id: number): Promise<ExamBlueprint | null> {
    const query = `SELECT * FROM exam_blueprints WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Lista todos os blueprints com paginação
   */
  async list(limit: number = 50, offset: number = 0): Promise<ExamBlueprint[]> {
    const query = `
      SELECT * FROM exam_blueprints
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Conta o total de blueprints
   */
  async count(): Promise<number> {
    const query = `SELECT COUNT(*) as total FROM exam_blueprints`;
    const result = await this.pool.query(query);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Deleta um blueprint por ID
   */
  async delete(id: number): Promise<boolean> {
    const query = `DELETE FROM exam_blueprints WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }
}
