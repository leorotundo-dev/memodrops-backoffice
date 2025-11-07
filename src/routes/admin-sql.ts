import { Router } from 'express';
import pool from '../db/connection';

const router = Router();

// Endpoint para executar SQL direto (APENAS PARA DESENVOLVIMENTO/ADMIN)
router.post('/execute', async (req, res) => {
  try {
    const { sql } = req.body;
    
    if (!sql) {
      return res.status(400).json({ success: false, error: 'SQL é obrigatório' });
    }
    
    const result = await pool.query(sql);
    
    res.json({
      success: true,
      result: result.rows,
      rowCount: result.rowCount
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
