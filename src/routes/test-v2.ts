import { Router } from 'express';
import { pool } from '../db/index.js';
import { extractEditalContent } from '../utils/editalContentExtractor.js';
import { parseEdital } from '../utils/editalParser.js';
import { extractSubjects } from '../utils/subjectExtractor.js';

const router = Router();

/**
 * Endpoint de teste: processa 1 item específico e retorna logs detalhados
 */
router.post('/api/test/process-one', async (req, res) => {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };
  
  try {
    log('[Test] Buscando 1 item para processar...');
    
    // Buscar 1 item fetched
    const itemResult = await pool.query(`
      SELECT id, source, url, title, content_text, meta
      FROM harvest_items
      WHERE status = 'fetched'
      ORDER BY fetched_at DESC
      LIMIT 1
    `);
    
    if (itemResult.rows.length === 0) {
      return res.json({
        success: false,
        message: 'Nenhum item disponível para processar',
        logs
      });
    }
    
    const item = itemResult.rows[0];
    log(`[Test] Item selecionado: ${item.title}`);
    log(`[Test] URL: ${item.url}`);
    log(`[Test] Source: ${item.source}`);
    
    // 1. EXTRAIR CONTEÚDO
    log('[Test] Extraindo conteúdo...');
    let content;
    try {
      content = await extractEditalContent(item.url);
      log(`[Test] ✅ Conteúdo extraído: ${content.full_text.length} chars`);
      log(`[Test] Seções encontradas: ${Object.keys(content.sections).join(', ')}`);
      log(`[Test] Confiança: ${(content.confidence * 100).toFixed(1)}%`);
    } catch (err: any) {
      log(`[Test] ❌ Erro ao extrair: ${err.message}`);
      return res.json({
        success: false,
        error: 'Erro na extração de conteúdo',
        details: err.message,
        logs
      });
    }
    
    // 2. PARSE
    log('[Test] Fazendo parse...');
    const parsed = parseEdital(content.full_text, content.sections);
    log(`[Test] Vagas encontradas: ${parsed.vacancies.length}`);
    log(`[Test] Datas encontradas: ${Object.keys(parsed.dates).length}`);
    
    // 3. EXTRAIR MATÉRIAS
    log('[Test] Extraindo matérias...');
    const subjectsExtraction = extractSubjects(
      content.sections.conteudo_programatico || content.full_text
    );
    log(`[Test] Matérias encontradas: ${subjectsExtraction.total_found}`);
    log(`[Test] Confiança: ${(subjectsExtraction.confidence_score * 100).toFixed(1)}%`);
    
    if (subjectsExtraction.subjects.length > 0) {
      log('[Test] Top 5 matérias:');
      subjectsExtraction.subjects.slice(0, 5).forEach(s => {
        log(`  - ${s.name} (${(s.confidence * 100).toFixed(0)}%)`);
      });
    }
    
    // 4. RESULTADO
    res.json({
      success: true,
      item: {
        id: item.id,
        title: item.title,
        url: item.url,
        source: item.source
      },
      extraction: {
        content_length: content.full_text.length,
        sections: Object.keys(content.sections),
        confidence: content.confidence
      },
      parsed: {
        vacancies_count: parsed.vacancies.length,
        dates_count: Object.keys(parsed.dates).length
      },
      subjects: {
        total_found: subjectsExtraction.total_found,
        confidence: subjectsExtraction.confidence_score,
        subjects: subjectsExtraction.subjects.slice(0, 10)
      },
      logs
    });
    
  } catch (error: any) {
    log(`[Test] ❌ Erro fatal: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      logs
    });
  }
});

export default router;
