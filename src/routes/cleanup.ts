import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

// Endpoint para limpar concursos antigos da Câmara (proposições legislativas)
router.post('/api/cleanup/camara', async (req, res) => {
  try {
    // Deletar editais dos concursos da Câmara
    await pool.query(`DELETE FROM editals WHERE contest_id IN (SELECT id FROM contests WHERE institution = 'Câmara')`);
    
    // Deletar concursos da Câmara
    const result = await pool.query(`DELETE FROM contests WHERE institution = 'Câmara' RETURNING id`);
    
    res.json({ 
      success: true, 
      message: `${result.rowCount} concursos da Câmara deletados` 
    });
  } catch (error) {
    console.error('[Cleanup] Erro ao limpar dados da Câmara:', error);
    res.status(500).json({ error: 'Failed to cleanup Câmara data' });
  }
});

// Endpoint para executar harvester
router.post('/api/harvest/run', async (req, res) => {
  try {
    // Importar dinamicamente para evitar problemas de inicialização
    const { runAll } = await import('../jobs/harvest.js');
    
    // Executar em background
    runAll().then(result => {
      console.log('[Harvest] Concluído:', result);
    }).catch(err => {
      console.error('[Harvest] Erro:', err);
    });
    
    res.json({ 
      success: true, 
      message: 'Harvester iniciado em background' 
    });
  } catch (error) {
    console.error('[Harvest] Erro ao iniciar:', error);
    res.status(500).json({ error: 'Failed to start harvester' });
  }
});

export default router;
