// Servidor de teste v4: Importar TODOS os routers (mas não registrar)
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { query } from './db/index.js';
import logger from './utils/logger.js';

// IMPORTAR TODOS OS ROUTERS (para ver se algum quebra ao ser importado)
console.log('[v4] Importando routers...');
import harvesterRouter from './routes/harvester.js';
console.log('[v4] ✅ harvesterRouter');
import dropsRouter from './routes/drops.js';
console.log('[v4] ✅ dropsRouter');
import adminRouter from './routes/admin.js';
console.log('[v4] ✅ adminRouter');
import costsRouter from './routes/costs.js';
console.log('[v4] ✅ costsRouter');
import institutionsRouter from './routes/institutions.js';
console.log('[v4] ✅ institutionsRouter');
import migrateRouter from './routes/migrate.js';
console.log('[v4] ✅ migrateRouter');
import cleanupRouter from './routes/cleanup.js';
console.log('[v4] ✅ cleanupRouter');
import processRouter from './routes/process.js';
console.log('[v4] ✅ processRouter');
import errorsRouter from './routes/errors.js';
console.log('[v4] ✅ errorsRouter');
import enrichRouter from './routes/enrich.js';
console.log('[v4] ✅ enrichRouter');
import processV2Router from './routes/process-v2.js';
console.log('[v4] ✅ processV2Router');
import testV2Router from './routes/test-v2.js';
console.log('[v4] ✅ testV2Router');
import processV3Router from './routes/process-v3.js';
console.log('[v4] ✅ processV3Router');
import healthRouter from './routes/health.js';
console.log('[v4] ✅ healthRouter');
import personalizationRouter from './routes/personalization.js';
console.log('[v4] ✅ personalizationRouter');
import qaRouter from './routes/qa.js';
console.log('[v4] ✅ qaRouter');
import pedagogyRouter from './routes/pedagogy.js';
console.log('[v4] ✅ pedagogyRouter');
import ragRouter from './routes/rag.js';
console.log('[v4] ✅ ragRouter');
import adminMigrationsRouter from './routes/admin-migrations.js';
console.log('[v4] ✅ adminMigrationsRouter');
import debugRouter from './routes/debug.js';
console.log('[v4] ✅ debugRouter');
import hierarchyRouter from './routes/hierarchy.js';
console.log('[v4] ✅ hierarchyRouter');

console.log('[v4] Todos os routers importados com sucesso!');

const app = express();
const PORT = process.env.PORT || 3000;

logger.info('[v4] Iniciando servidor de teste v4...');

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

logger.info('[v4] Middlewares configurados');

// Health check simples
app.get('/health', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as now');
    
    res.json({ 
      status: 'ok',
      version: 'test-v4',
      message: 'All routers imported OK (not registered)',
      dbTime: result.rows[0].now
    });
  } catch (error) {
    logger.error('[v4] Database error:', error);
    res.status(500).json({
      status: 'error',
      version: 'test-v4',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    message: 'MemoDrops Test v4 - All Routers Imported',
    status: 'running'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`✅ [v4] Servidor rodando na porta ${PORT}`);
  logger.info('[v4] Todos os 21 routers foram importados mas NÃO registrados');
});
