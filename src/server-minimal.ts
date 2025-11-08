// Server mínimo para diagnóstico
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

console.log('[Minimal Server] Iniciando...');

app.use(express.json());

// Ping endpoint
app.get('/api/ping', (req, res) => {
  console.log('[Ping] Request received');
  res.json({ 
    pong: true, 
    timestamp: new Date().toISOString(),
    message: 'Server minimal funcionando!'
  });
});

// Health endpoint
app.get('/api/health', (req, res) => {
  console.log('[Health] Request received');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'memodrops-backoffice-minimal',
    version: '2.0.0-minimal'
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'MemoDrops Backoffice - Minimal Server',
    endpoints: ['/api/ping', '/api/health']
  });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 MemoDrops Backoffice (MINIMAL)');
  console.log('========================================');
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`Ping: http://localhost:${PORT}/api/ping`);
  console.log('========================================');
});
