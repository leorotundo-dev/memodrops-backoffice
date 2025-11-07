import { pool } from '../db/index.js';

interface ProcessResult {
  processed: number;
  contests_created: number;
  contests_updated: number;
  editals_created: number;
  errors: number;
}

/**
 * Processa harvest_items e cria/atualiza concursos e editais
 */
export async function processHarvestItems(): Promise<ProcessResult> {
  console.log('🔄 [Process] Iniciando processamento de harvest_items...');
  
  const result: ProcessResult = {
    processed: 0,
    contests_created: 0,
    contests_updated: 0,
    editals_created: 0,
    errors: 0,
  };
  
  try {
    // Buscar itens não processados
    const itemsResult = await pool.query(`
      SELECT id, source, url, pdf_url, title, content_text, meta, fetched_at
      FROM harvest_items
      WHERE status = 'fetched'
      ORDER BY fetched_at DESC
      LIMIT 100
    `);
    
    console.log(`[Process] Encontrados ${itemsResult.rows.length} itens para processar`);
    
    for (const item of itemsResult.rows) {
      try {
        result.processed++;
        
        const meta = typeof item.meta === 'string' ? JSON.parse(item.meta) : item.meta;
        
        // Determinar se é concurso ou edital
        const isContest = isContestItem(item.source, item.title, meta);
        
        if (isContest) {
          // Processar como concurso
          const contestResult = await processContest(item, meta);
          if (contestResult.created) {
            result.contests_created++;
          } else if (contestResult.updated) {
            result.contests_updated++;
          }
          
          // Se tem PDF, criar edital
          if (item.pdf_url) {
            const editalCreated = await createEdital(contestResult.contest_id, item);
            if (editalCreated) {
              result.editals_created++;
            }
          }
        } else {
          // Processar como edital avulso (tentar vincular a concurso existente)
          const editalCreated = await createStandaloneEdital(item, meta);
          if (editalCreated) {
            result.editals_created++;
          }
        }
        
        // Marcar como processado
        await pool.query(
          'UPDATE harvest_items SET status = $1, processed_at = NOW() WHERE id = $2',
          ['processed', item.id]
        );
        
      } catch (error) {
        console.error(`[Process] Erro ao processar item ${item.id}:`, error);
        result.errors++;
        
        // Marcar como erro
        await pool.query(
          'UPDATE harvest_items SET status = $1, error = $2 WHERE id = $3',
          ['error', (error as Error).message, item.id]
        );
      }
    }
    
    console.log(`✅ [Process] Concluído:`, result);
    return result;
    
  } catch (error) {
    console.error('[Process] Erro fatal no processamento:', error);
    throw error;
  }
}

/**
 * Determina se item é um concurso
 */
function isContestItem(source: string, title: string, meta: any): boolean {
  // Fontes que sempre são concursos
  const contestSources = ['FGV', 'CESPE', 'FCC', 'Vunesp', 'Quadrix', 'AOCP', 'IBFC', 
                          'Consulplan', 'Idecan', 'FGD', 'IBAM', 'Cesgranrio', 'IBADE',
                          'ConcursosNoBrasil', 'GovBr'];
  
  if (contestSources.includes(source)) {
    return true;
  }
  
  // Verificar palavras-chave no título
  const contestKeywords = /concurso|seleção|processo seletivo|edital/i;
  if (contestKeywords.test(title)) {
    return true;
  }
  
  return false;
}

/**
 * Processa item como concurso
 */
async function processContest(item: any, meta: any): Promise<{ contest_id: number, created: boolean, updated: boolean }> {
  // Buscar instituição (banca)
  const institution = meta.fonte || meta.institution || meta.banca || item.source;
  
  let institutionId = null;
  const instResult = await pool.query(
    'SELECT id FROM institutions WHERE LOWER(name) = LOWER($1)',
    [institution]
  );
  
  if (instResult.rows.length > 0) {
    institutionId = instResult.rows[0].id;
  } else {
    // Criar instituição se não existir
    const newInst = await pool.query(
      'INSERT INTO institutions (name, type) VALUES ($1, $2) RETURNING id',
      [institution, 'banca']
    );
    institutionId = newInst.rows[0].id;
    console.log(`[Process] ✨ Nova instituição criada: ${institution}`);
  }
  
  // Verificar se concurso já existe (por título similar)
  const existingContest = await pool.query(
    `SELECT id FROM contests WHERE similarity(title, $1) > 0.6 LIMIT 1`,
    [item.title]
  );
  
  if (existingContest.rows.length > 0) {
    // Atualizar concurso existente
    const contestId = existingContest.rows[0].id;
    
    await pool.query(`
      UPDATE contests SET
        institution_id = COALESCE($1, institution_id),
        vacancies = COALESCE($2, vacancies),
        salary = COALESCE($3, salary),
        location = COALESCE($4, location),
        education_level = COALESCE($5, education_level),
        exam_date = COALESCE($6, exam_date),
        updated_at = NOW()
      WHERE id = $7
    `, [
      institutionId,
      meta.vacancies || meta.vagas,
      meta.salary || meta.salario,
      meta.location || meta.local,
      meta.education_level,
      meta.exam_date,
      contestId
    ]);
    
    console.log(`[Process] 🔄 Concurso atualizado: ${item.title}`);
    return { contest_id: contestId, created: false, updated: true };
  } else {
    // Criar novo concurso
    const newContest = await pool.query(`
      INSERT INTO contests (
        title, institution, institution_id, category_id, status,
        vacancies, salary, location, education_level, exam_date,
        registration_start, registration_end, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING id
    `, [
      item.title,
      institution,
      institutionId,
      1, // Default category (será melhorado depois)
      'active',
      meta.vacancies || meta.vagas,
      meta.salary || meta.salario,
      meta.location || meta.local,
      meta.education_level,
      meta.exam_date,
      meta.registration_start,
      meta.registration_end
    ]);
    
    const contestId = newContest.rows[0].id;
    console.log(`[Process] ✨ Novo concurso criado: ${item.title} (ID: ${contestId})`);
    return { contest_id: contestId, created: true, updated: false };
  }
}

/**
 * Cria edital vinculado a um concurso
 */
async function createEdital(contestId: number, item: any): Promise<boolean> {
  try {
    // Verificar se edital já existe
    const existing = await pool.query(
      'SELECT id FROM editals WHERE contest_id = $1 AND (url = $2 OR title = $3)',
      [contestId, item.url, item.title]
    );
    
    if (existing.rows.length > 0) {
      console.log(`[Process] ⏭️  Edital já existe para concurso ${contestId}`);
      return false;
    }
    
    // Criar edital
    await pool.query(`
      INSERT INTO editals (
        contest_id, title, edital_number, url, pdf_path, content_text, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      contestId,
      item.title,
      extractEditalNumber(item.title),
      item.url,
      item.pdf_url, // Caminho local do PDF
      item.content_text
    ]);
    
    console.log(`[Process] 📄 Edital criado para concurso ${contestId}`);
    return true;
  } catch (error) {
    console.error(`[Process] Erro ao criar edital:`, error);
    return false;
  }
}

/**
 * Cria edital sem concurso vinculado
 */
async function createStandaloneEdital(item: any, meta: any): Promise<boolean> {
  // Tentar encontrar concurso relacionado pelo título
  const contestMatch = await pool.query(
    `SELECT id FROM contests WHERE similarity(title, $1) > 0.5 LIMIT 1`,
    [item.title]
  );
  
  if (contestMatch.rows.length > 0) {
    return await createEdital(contestMatch.rows[0].id, item);
  }
  
  console.log(`[Process] ⚠️  Edital sem concurso vinculado: ${item.title}`);
  return false;
}

/**
 * Extrai número do edital do título
 */
function extractEditalNumber(title: string): string | null {
  const match = title.match(/(?:edital|n[º°]?)\s*(\d+[-\/]\d+)/i);
  if (match) return match[1];
  
  const simpleMatch = title.match(/\b(\d{1,4}\/\d{4})\b/);
  if (simpleMatch) return simpleMatch[1];
  
  return null;
}
