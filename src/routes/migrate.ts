import express, { Request, Response } from 'express';
import { pool } from '../db/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// POST /api/migrate/institutions - Executar migration de institutions
// ========================================
router.post('/institutions', async (req: Request, res: Response) => {
  try {
    const migrationPath = path.join(__dirname, '../db/migrations/add-institutions-table.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    await pool.query(sql);
    
    res.json({
      success: true,
      message: 'Migration executed successfully'
    });
  } catch (error: any) {
    console.error('Error executing migration:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute migration'
    });
  }
});

// ========================================
// GET /api/migrate/status - Verificar se tabela institutions existe
// ========================================
router.get('/status', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'institutions'
      );
    `);
    
    const exists = result.rows[0].exists;
    
    if (exists) {
      const countResult = await pool.query('SELECT COUNT(*) as count FROM institutions');
      const count = parseInt(countResult.rows[0].count);
      
      res.json({
        success: true,
        table_exists: true,
        institution_count: count
      });
    } else {
      res.json({
        success: true,
        table_exists: false
      });
    }
  } catch (error: any) {
    console.error('Error checking migration status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check migration status'
    });
  }
});

export default router;
