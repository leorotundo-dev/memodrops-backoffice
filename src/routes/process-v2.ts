import { Router } from 'express';
import { processHarvestItemsV2 } from '../jobs/process-harvest-v2.js';

const router = Router();

// Endpoint para executar pipeline V2
router.post('/api/process/v2', async (req, res) => {
  try {
    console.log('[API] Iniciando Pipeline V2...');
    
    // Executar em background
    processHarvestItemsV2()
      .then(result => {
        console.log('[API] Pipeline V2 concluído:', result);
      })
      .catch(err => {
        console.error('[API] Erro no Pipeline V2:', err);
      });
    
    res.json({
      success: true,
      message: 'Pipeline V2 iniciado em background (extração completa sem PDFs)'
    });
  } catch (error) {
    console.error('[API] Erro ao iniciar Pipeline V2:', error);
    res.status(500).json({ error: 'Erro ao iniciar Pipeline V2' });
  }
});

export default router;
