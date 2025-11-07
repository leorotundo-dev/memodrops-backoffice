import { Pool } from 'pg';

export interface User {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  preferences: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserParams {
  email: string;
  name?: string;
  avatarUrl?: string;
  preferences?: any;
}

export interface UpdateUserParams {
  name?: string;
  avatarUrl?: string;
  preferences?: any;
}

export class UserRepository {
  constructor(private pool: Pool) {}

  /**
   * Cria um novo usuário
   */
  async create(params: CreateUserParams): Promise<User> {
    const { email, name, avatarUrl, preferences } = params;

    const query = `
      INSERT INTO users (email, name, avatar_url, preferences)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const values = [
      email,
      name || null,
      avatarUrl || null,
      preferences ? JSON.stringify(preferences) : '{}'
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Busca um usuário por email
   */
  async findByEmail(email: string): Promise<User | null> {
    const query = `SELECT * FROM users WHERE email = $1`;
    const result = await this.pool.query(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Busca um usuário por ID
   */
  async findById(id: number): Promise<User | null> {
    const query = `SELECT * FROM users WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Atualiza um usuário
   */
  async update(id: number, params: UpdateUserParams): Promise<User | null> {
    const { name, avatarUrl, preferences } = params;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(avatarUrl);
    }

    if (preferences !== undefined) {
      updates.push(`preferences = $${paramIndex++}`);
      values.push(JSON.stringify(preferences));
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Lista usuários com paginação
   */
  async list(limit: number = 50, offset: number = 0): Promise<User[]> {
    const query = `
      SELECT * FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await this.pool.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Conta o total de usuários
   */
  async count(): Promise<number> {
    const query = `SELECT COUNT(*) as total FROM users`;
    const result = await this.pool.query(query);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Deleta um usuário
   */
  async delete(id: number): Promise<boolean> {
    const query = `DELETE FROM users WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }

  /**
   * Busca ou cria um usuário por email
   */
  async findOrCreate(params: CreateUserParams): Promise<User> {
    const existing = await this.findByEmail(params.email);
    if (existing) {
      return existing;
    }
    return this.create(params);
  }
}
