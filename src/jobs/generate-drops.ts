// src/jobs/generate-drops.ts
/**
 * Job que gera pílulas de conhecimento (drops) para contests processados
 * Pipeline: contests + subjects + topics → LLM gera conteúdo didático → knowledgePills
 */

import { query } from '../db/index.js';

interface Contest {
  id: number;
  title: string;
  category_id: number;
}

interface Subject {
  id: number;
  contest_id: number;
  name: string;
  slug: string;
}

interface Topic {
  id: number;
  subject_id: number;
  name: string;
  slug: string;
}

interface GeneratedDrop {
  title: string;
  content: string;
  memorizationTechniques: {
    type: string;
    content: string;
  }[];
  estimatedMinutes: number;
}

/**
 * Gera conteúdo didático para um tópico usando LLM
 */
async function generateDropContent(
  contestName: string,
  subjectName: string,
  topicName: string
): Promise<GeneratedDrop | null> {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      console.warn('[GenerateDrops] OPENAI_API_KEY não configurada');
      return null;
    }

    const prompt = `Você é um especialista em criação de conteúdo didático para concursos públicos brasileiros.

CONCURSO: ${contestName}
MATÉRIA: ${subjectName}
TÓPICO: ${topicName}

Crie uma "pílula de conhecimento" (drop) completa e didática sobre este tópico, seguindo estas diretrizes:

1. **Conteúdo Principal**: Explique o tópico de forma clara, objetiva e completa (300-500 palavras)
   - Use linguagem acessível mas técnica quando necessário
   - Inclua definições, conceitos-chave e exemplos práticos
   - Destaque pontos importantes que costumam cair em provas
   - Use formatação Markdown (negrito, listas, etc)

2. **Técnicas de Memorização**: Forneça 3 técnicas diferentes:
   - **Mnemônico**: Crie uma frase, acrônimo ou história para memorizar
   - **Mapa Mental**: Descreva como organizar o conteúdo visualmente
   - **Flashcard**: Crie uma pergunta e resposta objetiva

3. **Tempo Estimado**: Estime quantos minutos leva para estudar este drop (5-15 min)

Retorne JSON no formato:
{
  "title": "Título da pílula (ex: 'Direitos Fundamentais na CF/88')",
  "content": "Conteúdo didático completo em Markdown",
  "memorizationTechniques": [
    {
      "type": "mnemonic",
      "content": "Frase ou acrônimo para memorizar"
    },
    {
      "type": "mindmap",
      "content": "Descrição da estrutura do mapa mental"
    },
    {
      "type": "flashcard",
      "content": "Pergunta: ... | Resposta: ..."
    }
  ],
  "estimatedMinutes": 10
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um especialista em educação e criação de conteúdo didático para concursos públicos brasileiros. Sempre retorne JSON válido.' 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('[GenerateDrops] Erro na API OpenAI:', response.statusText);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) return null;
    
    const parsed = JSON.parse(content);
    return parsed.title ? parsed : null;
  } catch (error) {
    console.error('[GenerateDrops] Erro ao gerar drop:', error);
    return null;
  }
}

/**
 * Processa contests e gera drops para todos os tópicos
 */
export async function generateDropsForContests() {
  console.log('[GenerateDrops] Iniciando geração de drops...');

  try {
    // Buscar contests que ainda não tiveram drops gerados
    const contestsResult = await query(`
      SELECT DISTINCT c.id, c.title, c.category_id
      FROM contests c
      INNER JOIN subjects s ON c.id = s.contest_id
      INNER JOIN topics t ON s.id = t.subject_id
      LEFT JOIN knowledgePills kp ON t.id = kp.topic_id
      WHERE c.is_official = true
      AND kp.id IS NULL
      ORDER BY c.created_at DESC
      LIMIT 5
    `);

    const contests: Contest[] = contestsResult.rows as any[];
    console.log(`[GenerateDrops] ${contests.length} contests para processar`);

    let totalGenerated = 0;

    for (const contest of contests) {
      console.log(`[GenerateDrops] Processando: ${contest.title}`);

      // Buscar subjects do contest
      const subjectsResult = await query(
        'SELECT * FROM subjects WHERE contest_id = $1 ORDER BY display_order, name',
        [contest.id]
      );
      const subjects: Subject[] = subjectsResult.rows as any[];

      for (const subject of subjects) {
        // Buscar topics do subject
        const topicsResult = await query(
          'SELECT * FROM topics WHERE subject_id = $1 ORDER BY display_order, name',
          [subject.id]
        );
        const topics: Topic[] = topicsResult.rows as any[];

        for (const topic of topics) {
          // Verificar se já existe drop para este tópico
          const existingResult = await query(
            'SELECT id FROM knowledgePills WHERE topic_id = $1',
            [topic.id]
          );

          if (existingResult.rows.length > 0) {
            console.log(`[GenerateDrops] Drop já existe para: ${topic.name}`);
            continue;
          }

          console.log(`[GenerateDrops] Gerando drop para: ${subject.name} > ${topic.name}`);

          // Gerar conteúdo com IA
          const drop = await generateDropContent(contest.title, subject.name, topic.name);

          if (drop) {
            // Inserir na tabela knowledgePills
            await query(
              `INSERT INTO knowledgePills 
               (topic_id, title, content, mnemonic, mindmap, flashcard, estimated_minutes, difficulty, source, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'intermediate', 'ai_generated', NOW())`,
              [
                topic.id,
                drop.title,
                drop.content,
                drop.memorizationTechniques.find(t => t.type === 'mnemonic')?.content || null,
                drop.memorizationTechniques.find(t => t.type === 'mindmap')?.content || null,
                drop.memorizationTechniques.find(t => t.type === 'flashcard')?.content || null,
                drop.estimatedMinutes
              ]
            );

            totalGenerated++;
            console.log(`[GenerateDrops] Drop criado: ${drop.title}`);
          }

          // Delay para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    console.log(`[GenerateDrops] Concluído: ${totalGenerated} drops gerados`);

    return { totalGenerated };
  } catch (error) {
    console.error('[GenerateDrops] Erro na geração:', error);
    throw error;
  }
}

if (process.argv[1]?.endsWith('generate-drops.js') || process.argv[1]?.endsWith('generate-drops.ts')) {
  generateDropsForContests().catch(e => { console.error(e); process.exit(1); });
}
