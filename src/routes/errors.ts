import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

// Endpoint para analisar erros de processamento
router.get('/api/errors/analysis', async (req, res) => {
  try {
    // Buscar todos os erros
    const errorsResult = await pool.query(`
      SELECT error, source, COUNT(*) as count
      FROM harvest_items
      WHERE status = 'error' AND error IS NOT NULL
      GROUP BY error, source
      ORDER BY count DESC
      LIMIT 20
    `);
    
    // Agrupar por tipo de erro (primeira linha do erro)
    const errorTypes: Record<string, { count: number, sources: string[], examples: string[] }> = {};
    
    errorsResult.rows.forEach(row => {
      const errorType = row.error.split('\n')[0].substring(0, 100); // Primeira linha, max 100 chars
      
      if (!errorTypes[errorType]) {
        errorTypes[errorType] = { count: 0, sources: [], examples: [] };
      }
      
      errorTypes[errorType].count += parseInt(row.count);
      if (!errorTypes[errorType].sources.includes(row.source)) {
        errorTypes[errorType].sources.push(row.source);
      }
      if (errorTypes[errorType].examples.length < 3) {
        errorTypes[errorType].examples.push(row.error);
      }
    });
    
    // Ordenar por frequência
    const sortedErrors = Object.entries(errorTypes)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count);
    
    res.json({
      total_errors: sortedErrors.reduce((sum, e) => sum + e.count, 0),
      error_types: sortedErrors.slice(0, 10),
      top_5: sortedErrors.slice(0, 5)
    });
  } catch (error) {
    console.error('[Errors] Erro ao analisar:', error);
    res.status(500).json({ error: 'Erro ao analisar erros' });
  }
});

// Endpoint para ver exemplos de um tipo de erro específico
router.get('/api/errors/examples', async (req, res) => {
  try {
    const { pattern } = req.query;
    
    if (!pattern) {
      return res.status(400).json({ error: 'Parâmetro pattern é obrigatório' });
    }
    
    const result = await pool.query(`
      SELECT id, source, title, url, error, fetched_at
      FROM harvest_items
      WHERE status = 'error' AND error ILIKE $1
      ORDER BY fetched_at DESC
      LIMIT 10
    `, [`%${pattern}%`]);
    
    res.json({ examples: result.rows });
  } catch (error) {
    console.error('[Errors] Erro ao buscar exemplos:', error);
    res.status(500).json({ error: 'Erro ao buscar exemplos' });
  }
});

export default router;
