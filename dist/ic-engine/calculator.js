// src/ic-engine/calculator.ts
import { query } from '../db/index.js';
/**
 * Calcula o Índice de Cobrança (IC) de um tema
 * IC varia de 0 a 10, onde:
 * - 0-3: Pouco cobrado
 * - 4-6: Médio
 * - 7-8: Muito cobrado
 * - 9-10: Extremamente cobrado
 */
export async function calculateIC(topic, subject) {
    try {
        // Buscar frequência do tema nas provas coletadas
        let sql = `
      SELECT COUNT(*) as frequency
      FROM harvest_items
      WHERE 
        status = 'fetched'
        AND (
          LOWER(title) LIKE LOWER($1)
          OR LOWER(content_text) LIKE LOWER($1)
        )
    `;
        const params = [`%${topic}%`];
        if (subject) {
            sql += ` AND (LOWER(title) LIKE LOWER($2) OR LOWER(content_text) LIKE LOWER($2))`;
            params.push(`%${subject}%`);
        }
        const result = await query(sql, params);
        const frequency = parseInt(result.rows[0]?.frequency || '0');
        // Buscar total de provas
        const totalResult = await query(`
      SELECT COUNT(*) as total
      FROM harvest_items
      WHERE status = 'fetched'
    `);
        const total = parseInt(totalResult.rows[0]?.total || '1');
        // Calcular IC normalizado (0-10)
        // Fórmula: IC = (frequency / total) * 100, depois normaliza para 0-10
        const percentage = (frequency / total) * 100;
        // Normalização não-linear para dar mais peso a temas frequentes
        let ic = 0;
        if (percentage >= 50)
            ic = 10;
        else if (percentage >= 30)
            ic = 9;
        else if (percentage >= 20)
            ic = 8;
        else if (percentage >= 15)
            ic = 7;
        else if (percentage >= 10)
            ic = 6;
        else if (percentage >= 7)
            ic = 5;
        else if (percentage >= 5)
            ic = 4;
        else if (percentage >= 3)
            ic = 3;
        else if (percentage >= 1)
            ic = 2;
        else if (percentage > 0)
            ic = 1;
        return ic;
    }
    catch (error) {
        console.error('[IC Engine] Erro ao calcular IC:', error);
        return 0;
    }
}
/**
 * Identifica temas com IC alto mas poucos cards
 * Útil para priorizar geração de conteúdo
 */
export async function getTopicGaps(subject, minIC = 7) {
    try {
        // Buscar temas mais frequentes
        let sql = `
      SELECT 
        LOWER(TRIM(REGEXP_REPLACE(title, '[^a-zA-ZÀ-ÿ\\s]', '', 'g'))) as topic,
        COUNT(*) as frequency
      FROM harvest_items
      WHERE 
        status = 'fetched'
        AND LENGTH(title) > 10
    `;
        if (subject) {
            sql += ` AND (LOWER(title) LIKE LOWER($1) OR LOWER(content_text) LIKE LOWER($1))`;
        }
        sql += `
      GROUP BY topic
      HAVING COUNT(*) > 2
      ORDER BY frequency DESC
      LIMIT 50
    `;
        const params = subject ? [`%${subject}%`] : [];
        const result = await query(sql, params);
        const gaps = [];
        for (const row of result.rows) {
            const topic = row.topic;
            const frequency = parseInt(row.frequency);
            // Calcular IC do tema
            const ic = await calculateIC(topic, subject);
            if (ic >= minIC) {
                // Nota: cardsCount seria buscado da API do MemoDrops
                // Por enquanto, simulamos com 0
                const cardsCount = 0;
                gaps.push({
                    topic,
                    ic,
                    frequency,
                    cardsCount,
                    gap: ic - cardsCount,
                });
            }
        }
        // Ordenar por gap (maior gap = maior prioridade)
        gaps.sort((a, b) => b.gap - a.gap);
        return gaps.slice(0, 20); // Top 20 gaps
    }
    catch (error) {
        console.error('[IC Engine] Erro ao buscar gaps:', error);
        return [];
    }
}
/**
 * Extrai temas de um texto de prova
 * Usa heurísticas simples para identificar tópicos
 */
export function extractTopics(text) {
    const topics = [];
    // Padrões comuns em questões de concurso
    const patterns = [
        /(?:sobre|acerca de|em relação a|quanto a)\s+([A-ZÀ-Ÿ][a-zà-ÿ\s]{5,50})/gi,
        /(?:tema|assunto|matéria):\s*([A-ZÀ-Ÿ][a-zà-ÿ\s]{5,50})/gi,
        /(?:questão de|prova de)\s+([A-ZÀ-Ÿ][a-zà-ÿ\s]{5,50})/gi,
    ];
    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            if (match[1]) {
                const topic = match[1].trim();
                if (topic.length > 5 && topic.length < 100) {
                    topics.push(topic);
                }
            }
        }
    }
    return [...new Set(topics)]; // Remove duplicatas
}
