import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

/**
 * Health check endpoint - verifica status do serviço e banco
 */
router.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'memodrops-backoffice',
    version: '2.0.0',
    database: {
      connected: false,
      error: null as string | null
    },
    features: {
      harvester: true,
      pipeline_v2: true,
      subject_extraction: true,
      data_verification: true
    }
  };

  // Testar conexão com banco
  try {
    const result = await pool.query('SELECT NOW() as time, version() as version');
    health.database.connected = true;
    health.database.error = null;
  } catch (error: any) {
    health.status = 'degraded';
    health.database.connected = false;
    health.database.error = error.message;
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * Ping endpoint - resposta rápida sem dependências
 */
router.get('/api/ping', (req, res) => {
  res.json({
    pong: true,
    timestamp: new Date().toISOString()
  });
});

export default router;
