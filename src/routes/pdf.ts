import { Router } from 'express';
import { pool } from '../db/index.js';
import fs from 'fs';
import path from 'path';

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

// Servir PDF de um edital
router.get('/api/pdf/edital/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar edital no banco
    const result = await pool.query(
      'SELECT pdf_path, title FROM editals WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Edital não encontrado' });
    }
    
    const edital = result.rows[0];
    
    if (!edital.pdf_path) {
      return res.status(404).json({ error: 'PDF não disponível para este edital' });
    }
    
    // Verificar se arquivo existe
    if (!fs.existsSync(edital.pdf_path)) {
      return res.status(404).json({ error: 'Arquivo PDF não encontrado no servidor' });
    }
    
    // Servir arquivo
    const fileName = `${edital.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(edital.pdf_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('[PDF] Erro ao servir PDF:', error);
    res.status(500).json({ error: 'Erro ao carregar PDF' });
  }
});

// Download de PDF (força download ao invés de preview)
router.get('/api/pdf/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT pdf_path, title FROM editals WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Edital não encontrado' });
    }
    
    const edital = result.rows[0];
    
    if (!edital.pdf_path || !fs.existsSync(edital.pdf_path)) {
      return res.status(404).json({ error: 'PDF não disponível' });
    }
    
    const fileName = `${edital.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(edital.pdf_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('[PDF] Erro ao fazer download:', error);
    res.status(500).json({ error: 'Erro ao baixar PDF' });
  }
});

// Buscar no texto dos PDFs
router.get('/api/pdf/search', async (req, res) => {
  try {
    const { q, contest_id } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Parâmetro q (query) é obrigatório' });
    }
    
    let query_text = `
      SELECT e.id, e.title, e.pdf_path, e.content_text, c.title as contest_title
      FROM editals e
      LEFT JOIN contests c ON e.contest_id = c.id
      WHERE e.content_text ILIKE $1
    `;
    
    const params: any[] = [`%${q}%`];
    
    if (contest_id) {
      query_text += ' AND e.contest_id = $2';
      params.push(contest_id);
    }
    
    query_text += ' ORDER BY e.created_at DESC LIMIT 50';
    
    const result = await pool.query(query_text, params);
    
    // Extrair trechos relevantes
    const results = result.rows.map(row => {
      const text = row.content_text || '';
      const queryLower = (q as string).toLowerCase();
      const textLower = text.toLowerCase();
      const index = textLower.indexOf(queryLower);
      
      let snippet = '';
      if (index !== -1) {
        const start = Math.max(0, index - 100);
        const end = Math.min(text.length, index + (q as string).length + 100);
        snippet = '...' + text.substring(start, end) + '...';
      } else {
        snippet = text.substring(0, 200) + '...';
      }
      
      return {
        id: row.id,
        title: row.title,
        contest_title: row.contest_title,
        snippet,
        has_pdf: !!row.pdf_path,
      };
    });
    
    res.json({ results, total: results.length });
  } catch (error) {
    console.error('[PDF] Erro na busca:', error);
    res.status(500).json({ error: 'Erro ao buscar' });
  }
});

export default router;
