import { pool } from '../db/index.js';
import { extractEditalContent, findAndExtractProgramatico } from '../utils/editalContentExtractor.js';
import { parseEdital } from '../utils/editalParser.js';
import { extractSubjects } from '../utils/subjectExtractor.js';
import { verifyEditalData } from '../utils/dataVerifier.js';

/**
 * Pipeline V2: Processamento completo sem PDFs
 * 
 * Foco em extração máxima de matérias e dados estruturados
 */
export async function processHarvestItemsV2(): Promise<{
  processed: number;
  concursos_created: number;
  editais_created: number;
  materias_extracted: number;
  errors: number;
}> {
  console.log('[Pipeline V2] Iniciando processamento...');
  
  const result = {
    processed: 0,
    concursos_created: 0,
    editais_created: 0,
    materias_extracted: 0,
    errors: 0
  };
  
  try {
    // Buscar itens não processados
    const itemsResult = await pool.query(`
      SELECT id, source, url, title, content_text, meta
      FROM harvest_items
      WHERE status = 'fetched'
      ORDER BY fetched_at DESC
      LIMIT 100
    `);
    
    console.log(`[Pipeline V2] ${itemsResult.rows.length} itens para processar`);
    
    for (const item of itemsResult.rows) {
      try {
        result.processed++;
        console.log(`\n[Pipeline V2] ========== ITEM ${result.processed}/${itemsResult.rows.length} ==========`);
        console.log(`[Pipeline V2] ID: ${item.id}`);
        console.log(`[Pipeline V2] Source: ${item.source}`);
        console.log(`[Pipeline V2] Title: ${item.title}`);
        console.log(`[Pipeline V2] URL: ${item.url}`);
        
        // 1. EXTRAIR CONTEÚDO COMPLETO
        console.log(`[Pipeline V2] [1/6] Extraindo conteúdo...`);
        let content;
        try {
          content = await extractEditalContent(item.url);
          console.log(`[Pipeline V2] ✅ Conteúdo extraído: ${content.full_text.length} chars`);
          console.log(`[Pipeline V2] ✅ Seções encontradas: ${Object.keys(content.sections).join(', ')}`);
          console.log(`[Pipeline V2] ✅ Confiança da extração: ${(content.confidence * 100).toFixed(1)}%`);
        } catch (err: any) {
          console.error(`[Pipeline V2] ❌ Erro ao extrair conteúdo:`, err.message);
          await markAsError(item.id, `Erro ao extrair conteúdo: ${err.message}`);
          result.errors++;
          continue;
        }
        
        // 2. SE NÃO TEM CONTEÚDO PROGRAMÁTICO, BUSCAR EM LINKS RELACIONADOS
        if (!content.sections.conteudo_programatico) {
          console.log('[Pipeline V2] Conteúdo programático não encontrado, buscando em links...');
          const programatico = await findAndExtractProgramatico(item.url);
          if (programatico) {
            content.sections.conteudo_programatico = programatico;
          }
        }
        
        // 3. FAZER PARSE DAS SEÇÕES
        console.log(`[Pipeline V2] [3/6] Fazendo parse das seções...`);
        const parsed = parseEdital(content.full_text, content.sections);
        console.log(`[Pipeline V2] ✅ Datas: ${Object.keys(parsed.dates).length} campos`);
        console.log(`[Pipeline V2] ✅ Vagas encontradas: ${parsed.vacancies.length}`);
        
        // 4. EXTRAIR MATÉRIAS (CRÍTICO!)
        console.log(`[Pipeline V2] [4/6] Extraindo matérias...`);
        const subjectsExtraction = extractSubjects(
          content.sections.conteudo_programatico || content.full_text
        );
        
        console.log(`[Pipeline V2] ✅ Matérias encontradas: ${subjectsExtraction.total_found}`);
        console.log(`[Pipeline V2] ✅ Confiança: ${(subjectsExtraction.confidence_score * 100).toFixed(1)}%`);
        if (subjectsExtraction.subjects.length > 0) {
          console.log(`[Pipeline V2] 📚 Matérias:`);
          subjectsExtraction.subjects.slice(0, 5).forEach((s: any) => {
            console.log(`[Pipeline V2]    - ${s.name} (${(s.confidence * 100).toFixed(0)}%)`);
          });
          if (subjectsExtraction.subjects.length > 5) {
            console.log(`[Pipeline V2]    ... e mais ${subjectsExtraction.subjects.length - 5}`);
          }
        } else {
          console.log(`[Pipeline V2] ⚠️  Nenhuma matéria encontrada!`);
        }
        
        // 5. VERIFICAR VERACIDADE
        console.log(`[Pipeline V2] [5/6] Verificando veracidade...`);
        const verification = verifyEditalData({
          title: item.title,
          institution: item.meta?.banca || item.source,
          subjects: subjectsExtraction.subjects,
          vacancies: parsed.vacancies.reduce((sum, v) => sum + v.quantity, 0),
          salary: parsed.vacancies[0]?.salary,
          location: item.meta?.location
        });
        
        console.log(`[Pipeline V2] ✅ Confiança geral: ${(verification.overall_confidence * 100).toFixed(1)}%`);
        console.log(`[Pipeline V2] ✅ Problemas encontrados: ${verification.issues_found}`);
        if (verification.needs_manual_review) {
          console.log(`[Pipeline V2] ⚠️  Marcado para revisão manual`);
        }
        
        // 6. CRIAR/ATUALIZAR CONCURSO
        console.log(`[Pipeline V2] [6/6] Salvando no banco...`);
        const banca = item.meta?.banca || item.source;
        console.log(`[Pipeline V2] Banca: ${banca}`);
        let institutionId = await getOrCreateInstitution(banca);
        console.log(`[Pipeline V2] Institution ID: ${institutionId}`);
        
        const contestResult = await pool.query(`
          INSERT INTO contests (
            title, institution_id, institution, category_id,
            vacancies, salary, location, education_level,
            status, source_url, meta, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          ON CONFLICT (source_url) DO UPDATE SET
            updated_at = NOW()
          RETURNING id
        `, [
          item.title,
          institutionId,
          banca,
          1, // categoria padrão
          parsed.vacancies.reduce((sum, v) => sum + v.quantity, 0) || null,
          parsed.vacancies[0]?.salary || null,
          item.meta?.location || null,
          parsed.vacancies[0]?.education_level || null,
          'active',
          item.url,
          JSON.stringify({
            ...item.meta,
            parsed_data: parsed,
            verification: {
              confidence: verification.overall_confidence,
              needs_review: verification.needs_manual_review
            }
          })
        ]);
        
        const contestId = contestResult.rows[0].id;
        result.concursos_created++;
        console.log(`[Pipeline V2] ✅ Concurso criado: ID ${contestId}`);
        
        // 7. CRIAR EDITAL ESTRUTURADO
        console.log(`[Pipeline V2] Criando edital estruturado...`);
        const editalResult = await pool.query(`
          INSERT INTO editals (
            contest_id, title, content_text, 
            structured_data, subjects_data, subjects_confidence,
            needs_review, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING id
        `, [
          contestId,
          `Edital - ${item.title}`,
          content.full_text,
          JSON.stringify({
            sections: content.sections,
            parsed: parsed,
            links: content.links
          }),
          JSON.stringify({
            subjects: subjectsExtraction.subjects,
            extraction_meta: {
              total_found: subjectsExtraction.total_found,
              confidence_score: subjectsExtraction.confidence_score
            }
          }),
          subjectsExtraction.confidence_score,
          subjectsExtraction.needs_review || verification.needs_manual_review
        ]);
        
        const editalId = editalResult.rows[0].id;
        result.editais_created++;
        console.log(`[Pipeline V2] ✅ Edital criado: ID ${editalId}`);
        console.log(`[Pipeline V2] ✅ Content_text: ${content.full_text.length} chars`);
        console.log(`[Pipeline V2] ✅ Subjects_data: ${subjectsExtraction.subjects.length} matérias`);
        
        // 8. CRIAR MATÉRIAS E VÍNCULOS
        console.log(`[Pipeline V2] Vinculando ${subjectsExtraction.subjects.length} matérias...`);
        for (const subject of subjectsExtraction.subjects) {
          try {
            // Criar ou buscar matéria
            let subjectId = await getOrCreateSubject(subject.name);
            
            // Vincular ao edital
            await pool.query(`
              INSERT INTO edital_subjects (edital_id, subject_id, confidence, topics, created_at)
              VALUES ($1, $2, $3, $4, NOW())
              ON CONFLICT (edital_id, subject_id) DO UPDATE SET
                confidence = EXCLUDED.confidence,
                topics = EXCLUDED.topics
            `, [editalId, subjectId, subject.confidence, JSON.stringify(subject.topics)]);
            
                 result.materias_extracted++;
            console.log(`[Pipeline V2]    ✅ ${subject.name} vinculada`);
          } catch (err: any) {
            console.error(`[Pipeline V2]    ❌ Erro ao vincular ${subject.name}:`, err.message);
          }
        }
        
        console.log(`[Pipeline V2] ✅ Item processado com sucesso!`);
        console.log(`[Pipeline V2] ✅ Total de vínculos criados: ${result.materias_extracted}`);
        
        // 9. MARCAR ITEM COMO PROCESSADO
        await pool.query(`
          UPDATE harvest_items SET
            status = 'processed',
            processed_at = NOW()
          WHERE id = $1
        `, [item.id]);
        
        console.log(`✅ [Pipeline V2] Item processado com sucesso!`);
        
      } catch (error) {
        console.error(`[Pipeline V2] Erro ao processar item ${item.id}:`, error);
        await markAsError(item.id, String(error));
        result.errors++;
      }
    }
    
    console.log(`\n✅ [Pipeline V2] Processamento concluído:`, result);
    return result;
    
  } catch (error) {
    console.error('[Pipeline V2] Erro fatal:', error);
    throw error;
  }
}

async function getOrCreateInstitution(name: string): Promise<number> {
  if (!name || name.trim().length === 0) {
    name = 'Não informado';
  }
  
  const slug = name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, ''); // Remove hífens do início/fim
  
  // Buscar por nome primeiro (case insensitive)
  const existingByName = await pool.query(
    'SELECT id FROM institutions WHERE LOWER(name) = LOWER($1)',
    [name]
  );
  
  if (existingByName.rows.length > 0) {
    return existingByName.rows[0].id;
  }
  
  // Tentar criar
  try {
    const result = await pool.query(
      'INSERT INTO institutions (name, slug, created_at) VALUES ($1, $2, NOW()) RETURNING id',
      [name, slug]
    );
    return result.rows[0].id;
  } catch (err: any) {
    // Se der erro de duplicata, buscar novamente
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
  const existing = await pool.query(
    'SELECT id FROM subjects WHERE LOWER(name) = LOWER($1)',
    [name]
  );
  
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  
  const result = await pool.query(
    'INSERT INTO subjects (name, created_at) VALUES ($1, NOW()) RETURNING id',
    [name]
  );
  
  return result.rows[0].id;
}

async function markAsError(itemId: string, error: string): Promise<void> {
  await pool.query(`
    UPDATE harvest_items SET
      status = 'error',
      error = $1,
      processed_at = NOW()
    WHERE id = $2
  `, [error, itemId]);
}
