import { Router } from 'express';

const router = Router();

// Capturar logs de inicialização
const startupLogs: string[] = [];
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Interceptar console.log e console.error
console.log = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  startupLogs.push(`[LOG] ${new Date().toISOString()} - ${message}`);
  originalConsoleLog(...args);
};

console.error = (...args: any[]) => {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  startupLogs.push(`[ERROR] ${new Date().toISOString()} - ${message}`);
  originalConsoleError(...args);
};

// Capturar erros não tratados
process.on('uncaughtException', (error) => {
  startupLogs.push(`[UNCAUGHT] ${new Date().toISOString()} - ${error.message}\n${error.stack}`);
});

process.on('unhandledRejection', (reason: any) => {
  startupLogs.push(`[UNHANDLED] ${new Date().toISOString()} - ${reason}`);
});

/**
 * Endpoint de debug para ver logs de inicialização
 * GET /api/debug/startup
 */
router.get('/api/debug/startup', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      HAS_DATABASE_URL: !!process.env.DATABASE_URL,
      HAS_OPENAI_KEY: !!process.env.OPENAI_API_KEY,
    },
    logs: startupLogs.slice(-100), // Últimos 100 logs
    totalLogs: startupLogs.length
  });
});

/**
 * Endpoint para limpar logs
 * POST /api/debug/clear
 */
router.post('/api/debug/clear', (req, res) => {
  const count = startupLogs.length;
  startupLogs.length = 0;
  res.json({
    success: true,
    message: `${count} logs limpos`
  });
});

export default router;
