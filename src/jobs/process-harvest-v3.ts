// src/jobs/process-harvest-v3.ts
import { pool } from '../db/index.js';
import { extractEditalStructure } from '../services/microservices.js';
import { normalizeSalary, normalizeDate, isValidContestTitle } from '../utils/dataFormatter.js';
import { ExamBlueprintRepository } from '../services/examBlueprintRepository.js';

/**
 * Pipeline V3: Processamento usando microserviços
 * 
 * Utiliza o memodrops-extractor para extrair a estrutura dos editais
 * ao invés de fazer o processamento localmente.
 */
export async function processHarvestItemsV3(): Promise<{
  processed: number;
  contests_created: number;
  editals_created: number;
  subjects_extracted: number;
  errors: number;
}> {
  console.log('[Pipeline V3] Iniciando processamento com microserviços...');
  
  const result = {
    processed: 0,
    contests_created: 0,
    editals_created: 0,
    subjects_extracted: 0,
    errors: 0
  };
  
  try {
    // Buscar itens não processados
    const itemsResult = await pool.query(`
      SELECT id, source, url, title, content_html, content_text, meta
      FROM harvest_items
      WHERE status = 'fetched'
      ORDER BY fetched_at DESC
      LIMIT 50
    `);
    
    console.log(`[Pipeline V3] ${itemsResult.rows.length} itens para processar`);
    
    for (const item of itemsResult.rows) {
      try {
        result.processed++;
        console.log(`\n[Pipeline V3] Processando: ${item.title}`);
        
        // 1. EXTRAIR ESTRUTURA USANDO O MICROSERVIÇO
        let extractorResponse;
        try {
          const html = item.content_html || item.content_text || '';
          
          if (!html || html.trim().length === 0) {
            console.log('[Pipeline V3] ⚠️  Sem conteúdo HTML/texto para processar');
            await markAsError(item.id, 'Sem conteúdo para processar');
            result.errors++;
            continue;
          }
          
          extractorResponse = await extractEditalStructure(html, item.id);
          
        } catch (err: any) {
          console.error(`[Pipeline V3] Erro ao chamar extractor:`, err.message);
          await markAsError(item.id, `Erro no extractor: ${err.message}`);
          result.errors++;
          continue;
        }
        
        const { structure } = extractorResponse;
        
        // SALVAR O BLUEPRINT NO BANCO DE DADOS
        const blueprintRepo = new ExamBlueprintRepository(pool);
        const blueprint = await blueprintRepo.create({
          harvestItemId: item.id,
          model: 'gpt-4o-mini',
          promptVersion: 'v1.0.0',
          rawResponse: extractorResponse,
          structuredData: structure
        });
        
        console.log(`[Pipeline V3] ✅ Blueprint salvo no banco (ID: ${blueprint.id})`);
        
        // Validar se é um título de concurso válido
        if (!isValidContestTitle(structure.contest.title)) {
          console.log(`[Pipeline V3] ⚠️  Título inválido: ${structure.contest.title}`);
          await markAsError(item.id, 'Título inválido (conteúdo irrelevante)');
          result.errors++;
          continue;
        }
        
        console.log(`[Pipeline V3] ✅ Estrutura extraída: ${structure.subjects.length} matérias`);
        
        // 2. CRIAR/BUSCAR INSTITUIÇÃO (BANCA)
        const institutionName = structure.contest.institution || item.source;
        let institutionId = await getOrCreateInstitution(institutionName);
        
        // 3. CRIAR/ATUALIZAR CONCURSO
        const contestResult = await pool.query(`
          INSERT INTO contests (
            title, institution_id, institution, category_id,
            exam_date, vacancies, salary,
            status, source_url, meta, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (source_url) DO UPDATE SET
            title = EXCLUDED.title,
            exam_date = EXCLUDED.exam_date,
            vacancies = EXCLUDED.vacancies,
            salary = EXCLUDED.salary,
            updated_at = NOW()
          RETURNING id
        `, [
          structure.contest.title,
          institutionId,
          institutionName,
          1, // categoria padrão (TODO: mapear categoria)
          structure.contest.year ? `${structure.contest.year}-01-01` : null,
          structure.contest.vacancies || null,
          structure.contest.salary || null,
          'active',
          item.url,
          JSON.stringify({
            ...item.meta,
            extractor_data: structure,
            processed_by: 'microservice-v3'
          })
        ]);
        
        const contestId = contestResult.rows[0].id;
        result.contests_created++;
        
        // 4. CRIAR EDITAL ESTRUTURADO
        const editalResult = await pool.query(`
          INSERT INTO editals (
            contest_id, title, content_text, 
            structured_data, subjects_data,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (contest_id) DO UPDATE SET
            structured_data = EXCLUDED.structured_data,
            subjects_data = EXCLUDED.subjects_data,
            updated_at = NOW()
          RETURNING id
        `, [
          contestId,
          structure.edital.title || `Edital - ${structure.contest.title}`,
          item.content_text || '',
          JSON.stringify({
            contest: structure.contest,
            edital: structure.edital,
            processed_by: 'extractor-microservice'
          }),
          JSON.stringify({
            subjects: structure.subjects,
            extraction_meta: {
              total_found: structure.subjects.length,
              source: 'microservice'
            }
          })
        ]);
        
        const editalId = editalResult.rows[0].id;
        result.editals_created++;
        
        // 5. CRIAR MATÉRIAS E TÓPICOS
        for (const subject of structure.subjects) {
          try {
            // Criar ou buscar matéria
            let subjectId = await getOrCreateSubject(subject.name);
            
            // Vincular ao edital
            await pool.query(`
              INSERT INTO edital_subjects (edital_id, subject_id, topics, created_at)
              VALUES ($1, $2, $3, NOW())
              ON CONFLICT (edital_id, subject_id) DO UPDATE SET
                topics = EXCLUDED.topics,
                updated_at = NOW()
            `, [editalId, subjectId, JSON.stringify(subject.topics)]);
            
            result.subjects_extracted++;
            
            // Criar tópicos individuais
            for (let i = 0; i < subject.topics.length; i++) {
              const topicName = subject.topics[i];
              await getOrCreateTopic(subjectId, topicName, i);
            }
            
          } catch (err) {
            console.error(`[Pipeline V3] Erro ao criar matéria ${subject.name}:`, err);
          }
        }
        
        // 6. MARCAR ITEM COMO PROCESSADO
        await pool.query(`
          UPDATE harvest_items SET
            status = 'processed',
            processed_at = NOW(),
            meta = jsonb_set(
              COALESCE(meta, '{}'::jsonb),
              '{processing_version}',
              '"v3-microservices"'
            )
          WHERE id = $1
        `, [item.id]);
        
        console.log(`✅ [Pipeline V3] Item processado com sucesso!`);
        
      } catch (error) {
        console.error(`[Pipeline V3] Erro ao processar item ${item.id}:`, error);
        await markAsError(item.id, String(error));
        result.errors++;
      }
    }
    
    console.log(`\n✅ [Pipeline V3] Processamento concluído:`, result);
    return result;
    
  } catch (error) {
    console.error('[Pipeline V3] Erro fatal:', error);
    throw error;
  }
}

// ========== FUNÇÕES AUXILIARES ==========

async function getOrCreateInstitution(name: string): Promise<number> {
  if (!name || name.trim().length === 0) {
    name = 'Não informado';
  }
  
  const slug = name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  const existingByName = await pool.query(
    'SELECT id FROM institutions WHERE LOWER(name) = LOWER($1)',
    [name]
  );
  
  if (existingByName.rows.length > 0) {
    return existingByName.rows[0].id;
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO institutions (name, slug, type, is_active, created_at) VALUES ($1, $2, $3, true, NOW()) RETURNING id',
      [name, slug, 'exam_board']
    );
    return result.rows[0].id;
  } catch (err: any) {
    if (err.code === '23505') {
      const existing = await pool.query(
        'SELECT id FROM institutions WHERE slug = $1 OR LOWER(name) = LOWER($2)',
        [slug, name]
      );
      if (existing.rows.length > 0) {
        return existing.rows[0].id;
      }
    }
    throw err;
  }
}

async function getOrCreateSubject(name: string): Promise<number> {
  const slug = name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  const existing = await pool.query(
    'SELECT id FROM subjects WHERE LOWER(name) = LOWER($1)',
    [name]
  );
  
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  
  const result = await pool.query(
    'INSERT INTO subjects (name, slug, is_active, created_at) VALUES ($1, $2, true, NOW()) RETURNING id',
    [name, slug]
  );
  
  return result.rows[0].id;
}

async function getOrCreateTopic(subjectId: number, name: string, displayOrder: number): Promise<number> {
  const slug = name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  const existing = await pool.query(
    'SELECT id FROM topics WHERE subject_id = $1 AND slug = $2',
    [subjectId, slug]
  );
  
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  
  const result = await pool.query(
    'INSERT INTO topics (subject_id, name, slug, display_order, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
    [subjectId, name, slug, displayOrder]
  );
  
  return result.rows[0].id;
}

async function markAsError(itemId: number, errorMessage: string): Promise<void> {
  await pool.query(`
    UPDATE harvest_items SET
      status = 'error',
      error_message = $2,
      processed_at = NOW()
    WHERE id = $1
  `, [itemId, errorMessage]);
}
