import { pool } from '../db/index.js';
import { PersonalizationEngine } from '../personalization/engine.js';
import { DailyPlanRepository } from '../services/dailyPlanRepository.js';
import { UserRepository } from '../services/userRepository.js';

/**
 * Job: Geração de Plano Diário
 * 
 * Gera planos de estudo personalizados para os usuários com base em:
 * - Performance histórica
 * - Drops com dificuldade
 * - Espaçamento repetido
 * - Preferências do usuário
 */

export interface GenerateDailyPlanOptions {
  userId: number;
  date?: Date;
  targetDropsCount?: number;
  subjectId?: number;
}

export interface DailyPlanResult {
  planId: number;
  userId: number;
  date: Date;
  dropsCount: number;
  estimatedTimeMinutes: number;
  breakdown: {
    weakTopics: number;
    newContent: number;
    review: number;
  };
}

/**
 * Gera um plano diário personalizado para um usuário
 */
export async function generateDailyPlan(options: GenerateDailyPlanOptions): Promise<DailyPlanResult> {
  const {
    userId,
    date = new Date(),
    targetDropsCount = 10,
    subjectId
  } = options;

  console.log(`[Daily Plan] Gerando plano para usuário ${userId}...`);

  // 1. BUSCAR USUÁRIO E PREFERÊNCIAS
  const userRepo = new UserRepository(pool);
  const user = await userRepo.findById(userId);

  if (!user) {
    throw new Error(`Usuário ${userId} não encontrado`);
  }

  const userPreferences = user.preferences || {};
  const targetCount = userPreferences.daily_drops_target || targetDropsCount;

  // 2. USAR O PERSONALIZATION ENGINE PARA CALCULAR PRIORIDADES
  const personalizationEngine = new PersonalizationEngine(pool);
  
  const priorities = await personalizationEngine.calculateDropPriorities({
    userId,
    subjectId,
    targetDropsCount: targetCount,
    includeWeakTopics: true,
    includeReview: true
  });

  if (priorities.length === 0) {
    throw new Error('Nenhum drop disponível para o plano diário');
  }

  // 3. EXTRAIR IDS DOS DROPS
  const dropsIds = priorities.map(p => p.dropId);

  // 4. CALCULAR BREAKDOWN
  const breakdown = {
    weakTopics: priorities.filter(p => p.reason === 'weak_topic').length,
    newContent: priorities.filter(p => p.reason === 'new_content').length,
    review: priorities.filter(p => p.reason === 'spaced_repetition').length
  };

  // 5. ESTIMAR TEMPO DE ESTUDO
  const estimatedTimeMinutes = await personalizationEngine.recommendStudyTime(userId);

  // 6. CRIAR O PLANO NO BANCO DE DADOS
  const dailyPlanRepo = new DailyPlanRepository(pool);
  
  const plan = await dailyPlanRepo.create({
    userId,
    date,
    dropsIds,
    targetDropsCount: targetCount
  });

  console.log(`[Daily Plan] ✅ Plano criado (ID: ${plan.id}) com ${dropsIds.length} drops`);
  console.log(`[Daily Plan] Breakdown: ${breakdown.weakTopics} weak, ${breakdown.newContent} new, ${breakdown.review} review`);

  return {
    planId: plan.id,
    userId: plan.user_id,
    date: plan.date,
    dropsCount: dropsIds.length,
    estimatedTimeMinutes,
    breakdown
  };
}

/**
 * Gera planos diários para todos os usuários ativos
 */
export async function generateDailyPlansForAllUsers(): Promise<{
  generated: number;
  errors: number;
  results: Array<{ userId: number; success: boolean; error?: string }>;
}> {
  console.log('[Daily Plan] Gerando planos para todos os usuários ativos...');

  const result = {
    generated: 0,
    errors: 0,
    results: [] as Array<{ userId: number; success: boolean; error?: string }>
  };

  try {
    // Buscar usuários ativos (que têm estatísticas recentes)
    const usersQuery = `
      SELECT DISTINCT u.id, u.email
      FROM users u
      INNER JOIN user_stats us ON u.id = us.user_id
      WHERE us.answered_at >= NOW() - INTERVAL '30 days'
      ORDER BY u.id
    `;

    const usersResult = await pool.query(usersQuery);
    console.log(`[Daily Plan] ${usersResult.rows.length} usuários ativos encontrados`);

    for (const user of usersResult.rows) {
      try {
        await generateDailyPlan({
          userId: user.id,
          date: new Date()
        });

        result.generated++;
        result.results.push({
          userId: user.id,
          success: true
        });

        console.log(`[Daily Plan] ✅ Plano gerado para usuário ${user.id} (${user.email})`);

      } catch (error: any) {
        console.error(`[Daily Plan] ❌ Erro ao gerar plano para usuário ${user.id}:`, error.message);
        result.errors++;
        result.results.push({
          userId: user.id,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`[Daily Plan] ✅ Concluído: ${result.generated} planos gerados, ${result.errors} erros`);
    return result;

  } catch (error) {
    console.error('[Daily Plan] Erro fatal:', error);
    throw error;
  }
}

/**
 * Atualiza o progresso de um plano diário quando o usuário completa um drop
 */
export async function updateDailyPlanProgress(
  userId: number,
  dropId: number,
  timeSpentMinutes: number
): Promise<void> {
  const dailyPlanRepo = new DailyPlanRepository(pool);

  // Buscar o plano de hoje
  const todayPlan = await dailyPlanRepo.findTodayPlan(userId);

  if (!todayPlan) {
    console.log(`[Daily Plan] Usuário ${userId} não tem plano para hoje`);
    return;
  }

  // Verificar se o drop está no plano
  if (!todayPlan.drops_ids.includes(dropId)) {
    console.log(`[Daily Plan] Drop ${dropId} não está no plano de hoje do usuário ${userId}`);
    return;
  }

  // Atualizar o progresso
  await dailyPlanRepo.markDropCompleted(todayPlan.id, timeSpentMinutes);

  console.log(`[Daily Plan] ✅ Progresso atualizado: usuário ${userId}, drop ${dropId}, ${timeSpentMinutes}min`);
}
