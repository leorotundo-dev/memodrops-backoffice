import { Router } from 'express';
import { enrichEditalsWithSubjects } from '../jobs/enrich-subjects.js';

const router = Router();

// Endpoint para executar enriquecimento manual
router.post('/api/enrich/subjects', async (req, res) => {
  try {
    console.log('[API] Iniciando enriquecimento de matérias...');
    
    // Executar em background
    enrichEditalsWithSubjects()
      .then(result => {
        console.log('[API] Enriquecimento concluído:', result);
      })
      .catch(err => {
        console.error('[API] Erro no enriquecimento:', err);
      });
    
    res.json({
      success: true,
      message: 'Enriquecimento iniciado em background'
    });
  } catch (error) {
    console.error('[API] Erro ao iniciar enriquecimento:', error);
    res.status(500).json({ error: 'Erro ao iniciar enriquecimento' });
  }
});

export default router;
