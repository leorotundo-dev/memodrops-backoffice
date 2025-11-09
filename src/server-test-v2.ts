// Servidor de teste v2: Adicionar database connection
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { query } from './db/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

console.log('[v2] Iniciando servidor de teste v2...');

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

console.log('[v2] Middlewares configurados');

// Health check
app.get('/health', async (req, res) => {
  try {
    // Testar conexão com banco
    const result = await query('SELECT NOW() as now');
    
    res.json({ 
      status: 'ok',
      version: 'test-v2',
      message: 'Database OK',
      dbTime: result.rows[0].now
    });
  } catch (error) {
    console.error('[v2] Database error:', error);
    res.status(500).json({
      status: 'error',
      version: 'test-v2',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    message: 'MemoDrops Test v2 - Database',
    status: 'running'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ [v2] Servidor rodando na porta ${PORT}`);
});
