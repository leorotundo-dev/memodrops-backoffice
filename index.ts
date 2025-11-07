import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { adminProcessRouter } from './routes/admin.process';
import { startCron } from './jobs/process';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/admin', adminProcessRouter);

if (process.env.DISABLE_CRON !== 'true') {
  startCron();
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`[memodrops-processing] listening on :${PORT}`));