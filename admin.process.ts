import { Router } from 'express';
import { runProcessingOnce } from '../jobs/process';

export const adminProcessRouter = Router();

adminProcessRouter.post('/harvest/process', async (_req, res) => {
  try {
    const result = await runProcessingOnce();
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});