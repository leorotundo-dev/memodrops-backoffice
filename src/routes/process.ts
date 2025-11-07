import { Router } from 'express';
import { processHarvestItems } from '../jobs/process-harvest.js';

const router = Router();

// Endpoint para executar processamento manual
router.post('/api/process/run', async (req, res) => {
  try {
    console.log('[API] Iniciando processamento manual...');
    
    // Executar em background
    processHarvestItems()
      .then(result => {
        console.log('[API] Processamento concluído:', result);
      })
      .catch(err => {
        console.error('[API] Erro no processamento:', err);
      });
    
    res.json({
      success: true,
      message: 'Processamento iniciado em background'
    });
  } catch (error) {
    console.error('[API] Erro ao iniciar processamento:', error);
    res.status(500).json({ error: 'Erro ao iniciar processamento' });
  }
});

// Endpoint para ver status do processamento
router.get('/api/process/status', async (req, res) => {
  try {
    const { pool } = await import('../db/index.js');
    
    // Contar itens por status
    const statusResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM harvest_items
      GROUP BY status
    `);
    
    const stats: Record<string, number> = {};
    statusResult.rows.forEach(row => {
      stats[row.status] = parseInt(row.count);
    });
    
    // Últimos processados
    const recentResult = await pool.query(`
      SELECT id, source, title, status, processed_at
      FROM harvest_items
      WHERE status IN ('processed', 'error')
      ORDER BY processed_at DESC
      LIMIT 10
    `);
    
    res.json({
      stats,
      recent: recentResult.rows
    });
  } catch (error) {
    console.error('[API] Erro ao obter status:', error);
    res.status(500).json({ error: 'Erro ao obter status' });
  }
});

export default router;
