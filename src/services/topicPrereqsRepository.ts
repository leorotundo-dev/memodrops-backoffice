import { Pool } from 'pg';

export interface TopicPrereq {
  topic_id: number;
  prereq_topic_id: number;
  strength: number;
  created_at: Date;
}

export interface CreateTopicPrereqParams {
  topicId: number;
  prereqTopicId: number;
  strength?: number;
}

export class TopicPrereqsRepository {
  constructor(private pool: Pool) {}

  /**
   * Adiciona um pré-requisito a um tópico
   */
  async create(params: CreateTopicPrereqParams): Promise<TopicPrereq> {
    const { topicId, prereqTopicId, strength = 1.0 } = params;

    const query = `
      INSERT INTO topic_prereqs (topic_id, prereq_topic_id, strength)
      VALUES ($1, $2, $3)
      ON CONFLICT (topic_id, prereq_topic_id) DO UPDATE SET strength = $3
      RETURNING *
    `;

    const result = await this.pool.query(query, [topicId, prereqTopicId, strength]);
    return result.rows[0];
  }

  /**
   * Busca todos os pré-requisitos de um tópico
   */
  async findPrereqsByTopic(topicId: number): Promise<TopicPrereq[]> {
    const query = `
      SELECT * FROM topic_prereqs
      WHERE topic_id = $1
      ORDER BY strength DESC
    `;

    const result = await this.pool.query(query, [topicId]);
    return result.rows;
  }

  /**
   * Busca todos os tópicos que dependem de um tópico (dependentes)
   */
  async findDependentTopics(prereqTopicId: number): Promise<TopicPrereq[]> {
    const query = `
      SELECT * FROM topic_prereqs
      WHERE prereq_topic_id = $1
      ORDER BY strength DESC
    `;

    const result = await this.pool.query(query, [prereqTopicId]);
    return result.rows;
  }

  /**
   * Verifica se um tópico é pré-requisito de outro
   */
  async isPrerequisite(topicId: number, prereqTopicId: number): Promise<boolean> {
    const query = `
      SELECT 1 FROM topic_prereqs
      WHERE topic_id = $1 AND prereq_topic_id = $2
    `;

    const result = await this.pool.query(query, [topicId, prereqTopicId]);
    return result.rows.length > 0;
  }

  /**
   * Remove um pré-requisito
   */
  async delete(topicId: number, prereqTopicId: number): Promise<boolean> {
    const query = `
      DELETE FROM topic_prereqs
      WHERE topic_id = $1 AND prereq_topic_id = $2
    `;

    const result = await this.pool.query(query, [topicId, prereqTopicId]);
    return result.rowCount > 0;
  }

  /**
   * Busca o grafo completo de pré-requisitos de um tópico (recursivo)
   */
  async findPrereqsGraph(topicId: number): Promise<number[]> {
    const query = `
      WITH RECURSIVE prereq_tree AS (
        -- Base: pré-requisitos diretos
        SELECT prereq_topic_id
        FROM topic_prereqs
        WHERE topic_id = $1
        
        UNION
        
        -- Recursão: pré-requisitos dos pré-requisitos
        SELECT tp.prereq_topic_id
        FROM topic_prereqs tp
        INNER JOIN prereq_tree pt ON tp.topic_id = pt.prereq_topic_id
      )
      SELECT DISTINCT prereq_topic_id FROM prereq_tree
    `;

    const result = await this.pool.query(query, [topicId]);
    return result.rows.map(row => row.prereq_topic_id);
  }

  /**
   * Verifica se há ciclos no grafo de pré-requisitos
   */
  async hasCycle(topicId: number, prereqTopicId: number): Promise<boolean> {
    // Se prereqTopicId já depende de topicId, criar essa relação causaria um ciclo
    const prereqsOfPrereq = await this.findPrereqsGraph(prereqTopicId);
    return prereqsOfPrereq.includes(topicId);
  }

  /**
   * Lista todos os pré-requisitos
   */
  async listAll(): Promise<TopicPrereq[]> {
    const query = `SELECT * FROM topic_prereqs ORDER BY topic_id, strength DESC`;
    const result = await this.pool.query(query);
    return result.rows;
  }
}
