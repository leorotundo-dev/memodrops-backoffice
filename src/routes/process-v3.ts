// src/routes/process-v3.ts
import { Router } from 'express';
import { processHarvestItemsV3 } from '../jobs/process-harvest-v3.js';
import { generateDrops } from '../services/microservices.js';
import { query, pool } from '../db/index.js';
import { DropRepository } from '../services/dropRepository.js';
import { DropCacheRepository } from '../services/dropCacheRepository.js';
import { ExamBlueprintRepository } from '../services/examBlueprintRepository.js';
import { generateDropCacheHash } from '../lib/hash.js';
import { GOLD_RULE_CONFIG } from '../config/goldRule.js';

const router = Router();

/**
 * Endpoint para processar harvest items usando microserviços (V3)
 * POST /api/process-v3/harvest
 */
router.post('/api/process-v3/harvest', async (req, res) => {
  try {
    console.log('[Process V3] Iniciando processamento de harvest items...');
    
    const result = await processHarvestItemsV3();
    
    res.json({
      success: true,
      message: 'Processamento V3 concluído',
      stats: result
    });
  } catch (error: any) {
    console.error('[Process V3] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Endpoint para gerar drops de uma matéria específica
 * POST /api/process-v3/generate-drops
 */
router.post('/api/process-v3/generate-drops', async (req, res) => {
  try {
    const { subjectId, targetDropCount } = req.body;
    
    if (!subjectId) {
      return res.status(400).json({
        success: false,
        error: 'subjectId é obrigatório'
      });
    }
    
    console.log(`[Process V3] Gerando drops para subject ${subjectId}...`);
    
    // Buscar informações da matéria e seus tópicos
    const subjectResult = await query(`
      SELECT s.id, s.name, s.slug
      FROM subjects s
      WHERE s.id = $1
    `, [subjectId]);
    
    if (subjectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Matéria não encontrada'
      });
    }
    
    const subject = subjectResult.rows[0];
    
    // Buscar tópicos da matéria
    const topicsResult = await query(`
      SELECT t.name
      FROM topics t
      WHERE t.subject_id = $1
      ORDER BY t.display_order, t.name
    `, [subjectId]);
    
    const topics = topicsResult.rows.map(t => t.name);
    
    if (topics.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Matéria não possui tópicos cadastrados'
      });
    }
    
    // Chamar o microserviço learning-engine
    const dropsResponse = await generateDrops(
      String(subject.id),
      subject.name,
      topics,
      targetDropCount
    );
    
    // Salvar drops no banco de dados usando repository
    const dropRepo = new DropRepository(pool);
    const dropCacheRepo = new DropCacheRepository(pool);
    
    // Buscar o blueprint mais recente para esta matéria (se existir)
    const blueprintResult = await query(`
      SELECT eb.id FROM exam_blueprints eb
      INNER JOIN harvest_items hi ON eb.harvest_item_id = hi.id::text
      INNER JOIN editals e ON e.content_text = hi.content_text
      INNER JOIN edital_subjects es ON es.edital_id = e.id
      WHERE es.subject_id = $1
      ORDER BY eb.created_at DESC
      LIMIT 1
    `, [subjectId]);
    
    const blueprintId = blueprintResult.rows[0]?.id || 0;
    
    for (const drop of dropsResponse.drops) {
      // Gerar hash para cache
      const cacheHash = generateDropCacheHash({
        blueprintId,
        subjectId: Number(subjectId),
        dropType: 'generated',
        additionalContext: drop.title
      });
      
      // Verificar se já existe no cache
      const exists = await dropCacheRepo.exists(cacheHash);
      if (exists) {
        console.log(`[Process V3] ⚠️  Drop duplicado (cache hit): ${drop.title}`);
        continue;
      }
      
      // Criar o drop
      const createdDrop = await dropRepo.create({
        blueprintId: blueprintId || 0,
        subjectId: Number(subjectId),
        dropText: `${drop.title}\n\n${drop.content}\n\nDica: ${drop.memorizationTip}`,
        dropType: 'fundamento',
        model: 'gpt-4o-mini',
        promptVersion: GOLD_RULE_CONFIG.PROMPT_VERSION,
        metadata: {
          difficulty: drop.difficulty,
          estimatedMinutes: drop.estimatedMinutes,
          topicName: drop.topicName
        }
      });
      
      // Adicionar ao cache
      if (blueprintId > 0) {
        await dropCacheRepo.create({
          blueprintId,
          subjectId: Number(subjectId),
          contentHash: cacheHash,
          dropId: createdDrop.id
        });
      }
    }
    
    console.log(`[Process V3] ✅ ${dropsResponse.dropsCount} drops gerados e salvos`);
    
    res.json({
      success: true,
      message: `${dropsResponse.dropsCount} drops gerados com sucesso`,
      drops: dropsResponse.drops
    });
    
  } catch (error: any) {
    console.error('[Process V3] Erro ao gerar drops:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Endpoint para gerar drops de todas as matérias de um edital
 * POST /api/process-v3/generate-drops-for-edital
 */
router.post('/api/process-v3/generate-drops-for-edital', async (req, res) => {
  try {
    const { editalId, targetDropsPerSubject } = req.body;
    
    if (!editalId) {
      return res.status(400).json({
        success: false,
        error: 'editalId é obrigatório'
      });
    }
    
    console.log(`[Process V3] Gerando drops para edital ${editalId}...`);
    
    // Buscar todas as matérias do edital
    const subjectsResult = await query(`
      SELECT DISTINCT s.id, s.name
      FROM subjects s
      INNER JOIN edital_subjects es ON s.id = es.subject_id
      WHERE es.edital_id = $1
    `, [editalId]);
    
    if (subjectsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Edital não possui matérias cadastradas'
      });
    }
    
    const results = [];
    let totalDropsGenerated = 0;
    
    for (const subject of subjectsResult.rows) {
      try {
        // Buscar tópicos da matéria
        const topicsResult = await query(`
          SELECT t.name
          FROM topics t
          WHERE t.subject_id = $1
          ORDER BY t.display_order, t.name
        `, [subject.id]);
        
        const topics = topicsResult.rows.map(t => t.name);
        
        if (topics.length === 0) {
          console.log(`[Process V3] ⚠️  Matéria ${subject.name} não possui tópicos`);
          continue;
        }
        
        // Gerar drops
        const dropsResponse = await generateDrops(
          String(subject.id),
          subject.name,
          topics,
          targetDropsPerSubject
        );
        
        // Salvar drops
        for (const drop of dropsResponse.drops) {
          await query(`
            INSERT INTO drops (
              subject_id, topic_name, title, content,
              memorization_tip, difficulty, estimated_minutes,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          `, [
            subject.id,
            drop.topicName,
            drop.title,
            drop.content,
            drop.memorizationTip,
            drop.difficulty,
            drop.estimatedMinutes
          ]);
        }
        
        totalDropsGenerated += dropsResponse.dropsCount;
        
        results.push({
          subjectId: subject.id,
          subjectName: subject.name,
          dropsGenerated: dropsResponse.dropsCount
        });
        
        console.log(`[Process V3] ✅ ${subject.name}: ${dropsResponse.dropsCount} drops`);
        
      } catch (error: any) {
        console.error(`[Process V3] Erro ao gerar drops para ${subject.name}:`, error.message);
        results.push({
          subjectId: subject.id,
          subjectName: subject.name,
          error: error.message
        });
      }
    }
    
    console.log(`[Process V3] ✅ Total: ${totalDropsGenerated} drops gerados`);
    
    res.json({
      success: true,
      message: `${totalDropsGenerated} drops gerados para ${results.length} matérias`,
      totalDrops: totalDropsGenerated,
      results
    });
    
  } catch (error: any) {
    console.error('[Process V3] Erro ao gerar drops para edital:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
