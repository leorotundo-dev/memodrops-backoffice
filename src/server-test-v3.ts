// Servidor de teste v3: Adicionar logger, cron jobs, e imports complexos
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import { query } from './db/index.js';
import logger from './utils/logger.js';
import { globalErrorHandler } from './utils/errorHandler.js';
import { runAll } from './jobs/harvest.js';
import { processHarvestItems } from './jobs/process-content.js';
import { runCleanup } from './jobs/cleanup-files.js';

const app = express();
const PORT = process.env.PORT || 3000;

logger.info('[v3] Iniciando servidor de teste v3...');

// Middlewares
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

logger.info('[v3] Middlewares configurados');

// Health check
app.get('/health', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as now');
    
    res.json({ 
      status: 'ok',
      version: 'test-v3',
      message: 'Logger + Jobs OK',
      dbTime: result.rows[0].now
    });
  } catch (error) {
    logger.error('[v3] Database error:', error);
    res.status(500).json({
      status: 'error',
      version: 'test-v3',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    message: 'MemoDrops Test v3 - Logger + Jobs',
    status: 'running'
  });
});

// Error handler
app.use(globalErrorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`✅ [v3] Servidor rodando na porta ${PORT}`);
  logger.info('[v3] Logger, Cron e Jobs carregados com sucesso');
});
