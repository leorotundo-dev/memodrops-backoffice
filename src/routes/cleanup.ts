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

// Endpoint para limpar TUDO e começar do zero
router.post('/api/cleanup/reset-all', async (req, res) => {
  try {
    console.log('[Cleanup] Limpando todos os dados...');
    
    // TRUNCATE CASCADE limpa tudo de uma vez, respeitando foreign keys
    await pool.query('TRUNCATE TABLE harvest_items, contests, editals, institutions, subjects, edital_subjects, contest_categories RESTART IDENTITY CASCADE');
    
    console.log('[Cleanup] ✅ Todos os dados limpos!');
    
    res.json({
      success: true,
      message: 'Todos os dados foram limpos. Banco resetado para estado inicial.'
    });
  } catch (error: any) {
    console.error('[Cleanup] Erro ao limpar dados:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro ao limpar dados',
      details: error.message 
    });
  }
});

// Endpoint para resetar itens com erro para reprocessar
router.post('/api/cleanup/reset-errors', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE harvest_items
      SET status = 'fetched', error = NULL, processed_at = NULL
      WHERE status = 'error'
    `);
    
    res.json({
      success: true,
      message: `${result.rowCount} itens resetados para reprocessamento`
    });
  } catch (error) {
    console.error('Erro ao resetar erros:', error);
    res.status(500).json({ error: 'Erro ao resetar erros' });
  }
});

export default router;
