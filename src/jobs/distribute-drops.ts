// src/jobs/distribute-drops.ts
/**
 * Job que distribui drops para usuários baseado em seus study_plans
 * Pipeline: study_plans → calcula drops do dia → study_plan_items
 */

import { query } from '../db/index.js';

interface StudyPlan {
  id: number;
  user_id: number;
  contest_id: number;
  target_date: string;
  daily_minutes: number;
  status: string;
}

interface KnowledgePill {
  id: number;
  topic_id: number;
  title: string;
  estimated_minutes: number;
  subject_id: number;
  subject_name: string;
}

/**
 * Calcula quantos drops distribuir hoje para um plano de estudos
 */
function calculateDailyDrops(plan: StudyPlan, totalDrops: number): number {
  const now = new Date();
  const targetDate = new Date(plan.target_date);
  const daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) return 0;

  // Distribuir drops uniformemente até a data alvo
  const dropsPerDay = Math.ceil(totalDrops / daysRemaining);

  // Ajustar baseado no tempo disponível por dia
  const maxDropsPerDay = Math.floor(plan.daily_minutes / 10); // Assumindo 10 min por drop em média

  return Math.min(dropsPerDay, maxDropsPerDay);
}

/**
 * Seleciona drops de forma balanceada entre matérias
 */
async function selectBalancedDrops(
  contestId: number,
  count: number,
  excludeIds: number[]
): Promise<KnowledgePill[]> {
  // Buscar todos os drops disponíveis do contest
  const result = await query(`
    SELECT 
      kp.id,
      kp.topic_id,
      kp.title,
      kp.estimated_minutes,
      s.id as subject_id,
      s.name as subject_name
    FROM knowledgePills kp
    INNER JOIN topics t ON kp.topic_id = t.id
    INNER JOIN subjects s ON t.subject_id = s.id
    WHERE s.contest_id = $1
    AND kp.id NOT IN (${excludeIds.length > 0 ? excludeIds.join(',') : '0'})
    ORDER BY RANDOM()
  `, [contestId]);

  const allDrops: KnowledgePill[] = result.rows as any[];

  if (allDrops.length === 0) return [];

  // Agrupar por matéria
  const bySubject = new Map<number, KnowledgePill[]>();
  for (const drop of allDrops) {
    if (!bySubject.has(drop.subject_id)) {
      bySubject.set(drop.subject_id, []);
    }
    bySubject.get(drop.subject_id)!.push(drop);
  }

  // Distribuir de forma balanceada (round-robin entre matérias)
  const selected: KnowledgePill[] = [];
  const subjects = Array.from(bySubject.keys());
  let subjectIndex = 0;

  while (selected.length < count && selected.length < allDrops.length) {
    const subjectId = subjects[subjectIndex % subjects.length];
    const subjectDrops = bySubject.get(subjectId)!;

    if (subjectDrops.length > 0) {
      selected.push(subjectDrops.shift()!);
    }

    subjectIndex++;

    // Se todas as matérias estão vazias, parar
    if (Array.from(bySubject.values()).every(drops => drops.length === 0)) {
      break;
    }
  }

  return selected;
}

/**
 * Distribui drops para todos os planos de estudo ativos
 */
export async function distributeDropsToUsers() {
  console.log('[DistributeDrops] Iniciando distribuição...');

  try {
    // Buscar planos de estudo ativos
    const plansResult = await query(`
      SELECT * FROM study_plans
      WHERE status = 'active'
      AND target_date >= CURRENT_DATE
      ORDER BY user_id
    `);

    const plans: StudyPlan[] = plansResult.rows as any[];
    console.log(`[DistributeDrops] ${plans.length} planos ativos`);

    let totalDistributed = 0;

    for (const plan of plans) {
      console.log(`[DistributeDrops] Processando plano ${plan.id} (usuário ${plan.user_id})`);

      // Contar total de drops disponíveis para este contest
      const totalResult = await query(`
        SELECT COUNT(*) as total
        FROM knowledgePills kp
        INNER JOIN topics t ON kp.topic_id = t.id
        INNER JOIN subjects s ON t.subject_id = s.id
        WHERE s.contest_id = $1
      `, [plan.contest_id]);

      const totalDrops = parseInt(totalResult.rows[0].total);

      if (totalDrops === 0) {
        console.log(`[DistributeDrops] Nenhum drop disponível para contest ${plan.contest_id}`);
        continue;
      }

      // Buscar drops já distribuídos hoje
      const todayResult = await query(`
        SELECT pill_id
        FROM study_plan_items
        WHERE plan_id = $1
        AND scheduled_date = CURRENT_DATE
      `, [plan.id]);

      const todayPillIds = todayResult.rows.map(r => r.pill_id);

      // Calcular quantos drops distribuir hoje
      const dropsToday = calculateDailyDrops(plan, totalDrops);

      if (todayPillIds.length >= dropsToday) {
        console.log(`[DistributeDrops] Plano ${plan.id} já tem drops suficientes para hoje`);
        continue;
      }

      const neededDrops = dropsToday - todayPillIds.length;

      // Selecionar drops de forma balanceada
      const selectedDrops = await selectBalancedDrops(
        plan.contest_id,
        neededDrops,
        todayPillIds
      );

      // Criar study_plan_items
      for (const drop of selectedDrops) {
        await query(`
          INSERT INTO study_plan_items
          (plan_id, pill_id, scheduled_date, status, created_at)
          VALUES ($1, $2, CURRENT_DATE, 'pending', NOW())
          ON CONFLICT (plan_id, pill_id) DO NOTHING
        `, [plan.id, drop.id]);

        totalDistributed++;
      }

      console.log(`[DistributeDrops] Distribuídos ${selectedDrops.length} drops para plano ${plan.id}`);
    }

    console.log(`[DistributeDrops] Concluído: ${totalDistributed} drops distribuídos`);

    return { totalDistributed };
  } catch (error) {
    console.error('[DistributeDrops] Erro na distribuição:', error);
    throw error;
  }
}

if (process.argv[1]?.endsWith('distribute-drops.js') || process.argv[1]?.endsWith('distribute-drops.ts')) {
  distributeDropsToUsers().catch(e => { console.error(e); process.exit(1); });
}
