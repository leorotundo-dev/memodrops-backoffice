// Servidor de teste v1: Adicionar apenas middlewares básicos
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

console.log('[v1] Iniciando servidor de teste v1...');

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

console.log('[v1] Middlewares configurados');

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    version: 'test-v1',
    message: 'Middlewares OK'
  });
});

// Root
app.get('/', (req, res) => {
  res.json({ 
    message: 'MemoDrops Test v1 - Middlewares',
    status: 'running'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ [v1] Servidor rodando na porta ${PORT}`);
});
