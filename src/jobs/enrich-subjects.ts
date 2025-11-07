import { pool } from '../db/index.js';
import { extractSubjects } from '../utils/subjectExtractor.js';
import { verifyEditalData } from '../utils/dataVerifier.js';

/**
 * Job para enriquecer editais com extração de matérias
 */
export async function enrichEditalsWithSubjects(): Promise<{
  processed: number;
  subjects_extracted: number;
  needs_review: number;
}> {
  console.log('[Enrich] Iniciando extração de matérias dos editais...');
  
  const result = {
    processed: 0,
    subjects_extracted: 0,
    needs_review: 0
  };
  
  try {
    // Buscar editais sem matérias extraídas
    const editalsResult = await pool.query(`
      SELECT e.id, e.title, e.content_text, e.contest_id, c.title as contest_title
      FROM editals e
      LEFT JOIN contests c ON e.contest_id = c.id
      WHERE e.content_text IS NOT NULL 
        AND e.content_text != ''
        AND (e.subjects_data IS NULL OR e.subjects_data::text = '{}')
      LIMIT 50
    `);
    
    console.log(`[Enrich] Encontrados ${editalsResult.rows.length} editais para processar`);
    
    for (const edital of editalsResult.rows) {
      try {
        result.processed++;
        
        // Extrair matérias
        const extraction = extractSubjects(edital.content_text);
        
        console.log(`[Enrich] Edital ${edital.id}: ${extraction.total_found} matérias encontradas (confiança: ${(extraction.confidence_score * 100).toFixed(1)}%)`);
        
        if (extraction.total_found > 0) {
          result.subjects_extracted += extraction.total_found;
          
          // Verificar veracidade dos dados
          const verification = verifyEditalData({
            title: edital.title,
            subjects: extraction.subjects
          });
          
          // Salvar no banco
          await pool.query(`
            UPDATE editals SET
              subjects_data = $1,
              subjects_confidence = $2,
              needs_review = $3,
              updated_at = NOW()
            WHERE id = $4
          `, [
            JSON.stringify({
              subjects: extraction.subjects,
              extraction_meta: {
                total_found: extraction.total_found,
                confidence_score: extraction.confidence_score,
                needs_review: extraction.needs_review
              },
              verification: {
                overall_confidence: verification.overall_confidence,
                issues_found: verification.issues_found,
                needs_manual_review: verification.needs_manual_review
              }
            }),
            extraction.confidence_score,
            extraction.needs_review || verification.needs_manual_review,
            edital.id
          ]);
          
          // Criar registros de matérias na tabela subjects
          for (const subject of extraction.subjects) {
            try {
              // Verificar se matéria já existe
              const existingSubject = await pool.query(
                'SELECT id FROM subjects WHERE LOWER(name) = LOWER($1)',
                [subject.name]
              );
              
              let subjectId;
              
              if (existingSubject.rows.length > 0) {
                subjectId = existingSubject.rows[0].id;
              } else {
                // Criar nova matéria
                const newSubject = await pool.query(
                  'INSERT INTO subjects (name, created_at) VALUES ($1, NOW()) RETURNING id',
                  [subject.name]
                );
                subjectId = newSubject.rows[0].id;
              }
              
              // Vincular matéria ao edital
              await pool.query(`
                INSERT INTO edital_subjects (edital_id, subject_id, confidence, topics, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (edital_id, subject_id) DO UPDATE SET
                  confidence = EXCLUDED.confidence,
                  topics = EXCLUDED.topics
              `, [edital.id, subjectId, subject.confidence, JSON.stringify(subject.topics)]);
              
            } catch (err) {
              console.error(`[Enrich] Erro ao criar matéria ${subject.name}:`, err);
            }
          }
          
          if (extraction.needs_review || verification.needs_manual_review) {
            result.needs_review++;
          }
        } else {
          console.log(`[Enrich] ⚠️  Nenhuma matéria encontrada no edital ${edital.id}`);
          
          await pool.query(`
            UPDATE editals SET
              needs_review = true,
              subjects_data = $1,
              updated_at = NOW()
            WHERE id = $2
          `, [
            JSON.stringify({ error: 'Nenhuma matéria encontrada' }),
            edital.id
          ]);
          
          result.needs_review++;
        }
        
      } catch (error) {
        console.error(`[Enrich] Erro ao processar edital ${edital.id}:`, error);
      }
    }
    
    console.log(`✅ [Enrich] Concluído:`, result);
    return result;
    
  } catch (error) {
    console.error('[Enrich] Erro fatal:', error);
    throw error;
  }
}
