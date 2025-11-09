// Servidor de teste v5: Registrar routers um por um
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { query } from './db/index.js';
import logger from './utils/logger.js';

// Importar routers essenciais
import healthRouter from './routes/health.js';
import debugRouter from './routes/debug.js';
import adminRouter from './routes/admin.js';
import dropsRouter from './routes/drops.js';

const app = express();
const PORT = process.env.PORT || 3000;

logger.info('[v5] Iniciando servidor de teste v5...');

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

logger.info('[v5] Middlewares configurados');

// Health check simples PRIMEIRO
app.get('/health', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as now');
    res.json({ 
      status: 'ok',
      version: 'test-v5',
      message: 'Essential routers registered',
      dbTime: result.rows[0].now
    });
  } catch (error) {
    logger.error('[v5] Error:', error);
    res.status(500).json({
      status: 'error',
      version: 'test-v5',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Registrar routers essenciais
logger.info('[v5] Registrando health router...');
app.use(healthRouter);

logger.info('[v5] Registrando debug router...');
app.use(debugRouter);

logger.info('[v5] Registrando admin router...');
app.use('/api/admin', adminRouter);

logger.info('[v5] Registrando drops router...');
app.use(dropsRouter);

logger.info('[v5] Routers essenciais registrados');

// Root
app.get('/', (req, res) => {
  res.json({ 
    message: 'MemoDrops Test v5 - Essential Routers',
    status: 'running',
    routers: ['health', 'debug', 'admin', 'drops']
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`✅ [v5] Servidor rodando na porta ${PORT}`);
  logger.info('[v5] Routers essenciais registrados com sucesso');
});
