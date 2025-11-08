// src/routes/admin-migrations.ts
import { Router } from 'express';
import { pool } from '../db/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * POST /admin/migrations/run
 * Executa todas as migrations pendentes
 */
router.post('/admin/migrations/run', async (req, res) => {
  try {
    const migrationsDir = path.join(__dirname, '../db/migrations');
    
    // Lista de migrations em ordem
    const migrations = [
      '004_create_exam_blueprints.sql',
      '005_create_drops_and_cache.sql',
      '006_create_qa_tables.sql',
      '007_create_rag_blocks.sql',
      '008_create_user_tables.sql',
      '009_create_pedagogy_tables.sql',
      '010_add_pdf_url_to_editals.sql'
    ];

    const results = [];

    for (const migration of migrations) {
      const migrationPath = path.join(migrationsDir, migration);
      
      if (!fs.existsSync(migrationPath)) {
        results.push({
          migration,
          status: 'skipped',
          message: 'Arquivo não encontrado'
        });
        continue;
      }

      try {
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        await pool.query(sql);
        
        results.push({
          migration,
          status: 'success',
          message: 'Executada com sucesso'
        });
      } catch (error: any) {
        // Se o erro for "already exists", considerar como sucesso
        if (error.message.includes('already exists')) {
          results.push({
            migration,
            status: 'already_exists',
            message: 'Tabela já existe'
          });
        } else {
          results.push({
            migration,
            status: 'error',
            message: error.message
          });
        }
      }
    }

    res.json({
      success: true,
      message: 'Migrations executadas',
      results
    });
  } catch (error: any) {
    console.error('[Migrations] Erro ao executar migrations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /admin/migrations/status
 * Verifica quais tabelas existem no banco
 */
router.get('/admin/migrations/status', async (req, res) => {
  try {
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    const result = await pool.query(query);
    const tables = result.rows.map(row => row.table_name);

    // Tabelas esperadas das novas migrations
    const expectedTables = [
      'exam_blueprints',
      'drops',
      'drop_cache',
      'qa_reviews',
      'drop_metrics',
      'metrics_daily',
      'rag_blocks',
      'users',
      'user_stats',
      'daily_plans',
      'topic_prereqs',
      'exam_logs'
    ];

    const missingTables = expectedTables.filter(t => !tables.includes(t));

    res.json({
      success: true,
      tables,
      expectedTables,
      missingTables,
      allTablesExist: missingTables.length === 0
    });
  } catch (error: any) {
    console.error('[Migrations] Erro ao verificar status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;

/**
 * POST /admin/migrations/install-pgvector
 * Instala a extensão pgvector no PostgreSQL
 */
router.post('/admin/migrations/install-pgvector', async (req, res) => {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    res.json({
      success: true,
      message: 'Extensão pgvector instalada com sucesso'
    });
  } catch (error: any) {
    console.error('[Migrations] Erro ao instalar pgvector:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
