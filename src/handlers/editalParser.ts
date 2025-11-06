/**
 * Parser de Edital com IA
 * 
 * Extrai conteúdo programático de editais de concursos públicos
 * e mapeia matérias, tópicos e subtópicos automaticamente
 * 
 * Schema: categories → contests → editals → subjects → topics → subtopics
 */

import { query } from '../db/index.js';
import OpenAI from 'openai';
import { extractTextFromPDF, extractProgramContent, chunkText } from '../utils/pdfExtractor.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Estrutura de matéria extraída do edital
 */
interface ExtractedSubject {
  name: string;
  weight: number; // 1-10
  difficulty: number; // 1-3
  priority: number; // 1-10
  topics: ExtractedTopic[];
}

/**
 * Estrutura de tópico extraído
 */
interface ExtractedTopic {
  name: string;
  description?: string;
  difficulty: number; // 1-3
  priority: number; // 1-10
  estimatedConcepts: number;
  subtopics?: ExtractedSubtopic[];
}

/**
 * Estrutura de subtópico extraído
 */
interface ExtractedSubtopic {
  name: string;
  description?: string;
  difficulty: number; // 1-3
  priority: number; // 1-10
  estimatedConcepts: number;
}

/**
 * Processa edital completo: extrai conteúdo e salva no banco
 */
export async function processEdital(editalId: number): Promise<void> {
  try {
    // Buscar edital
    const editalResult = await query(
      'SELECT * FROM editals WHERE id = $1',
      [editalId]
    );

    if (editalResult.rows.length === 0) {
      throw new Error('Edital not found');
    }

    const edital = editalResult.rows[0];

    // Atualizar status para processing
    await query(
      'UPDATE editals SET status = $1 WHERE id = $2',
      ['processing', editalId]
    );

    // Extrair texto do PDF se fileUrl estiver disponível
    let editalText = edital.original_text || '';
    
    if (edital.file_url && !editalText) {
      try {
        console.log(`[EditalParser] Downloading PDF from: ${edital.file_url}`);
        
        // Baixar PDF da URL
        const response = await fetch(edital.file_url);
        if (!response.ok) {
          throw new Error(`Failed to download PDF: ${response.statusText}`);
        }
        
        const buffer = await response.arrayBuffer();
        console.log(`[EditalParser] Downloaded ${buffer.byteLength} bytes`);
        
        // Salvar temporariamente
        const tempPath = `/tmp/${Date.now()}-edital.pdf`;
        const fs = await import('fs');
        fs.writeFileSync(tempPath, Buffer.from(buffer));
        
        console.log(`[EditalParser] Extracting text from: ${tempPath}`);
        const fullText = await extractTextFromPDF(tempPath);
        
        // Extrair apenas seção de conteúdo programático
        editalText = extractProgramContent(fullText);
        
        console.log(`[EditalParser] Extracted ${editalText.length} characters from PDF`);
        
        // Limpar arquivo temporário
        fs.unlinkSync(tempPath);
      } catch (error) {
        console.error('[EditalParser] Failed to download/extract PDF:', error);
        console.warn('[EditalParser] Falling back to original_text');
      }
    }

    // Extrair conteúdo programático com IA
    console.log(`[EditalParser] Calling extractSubjectsFromEdital with ${editalText.length} chars`);
    const subjects = await extractSubjectsFromEdital(editalText);
    console.log(`[EditalParser] Extracted ${subjects.length} subjects`);

    // Salvar matérias, tópicos e subtópicos no banco
    for (let i = 0; i < subjects.length; i++) {
      await saveSubjectWithTopics(editalId, subjects[i], i);
    }

    // Atualizar status para completed
    await query(
      'UPDATE editals SET status = $1, processed_at = NOW() WHERE id = $2',
      ['completed', editalId]
    );

    console.log(`[EditalParser] Edital ${editalId} processed successfully`);
  } catch (error) {
    // Marcar como failed em caso de erro
    await query(
      'UPDATE editals SET status = $1 WHERE id = $2',
      ['failed', editalId]
    );

    console.error(`[EditalParser] Error processing edital ${editalId}:`, error);
    throw error;
  }
}

/**
 * Extrai matérias e tópicos do texto do edital usando IA
 */
async function extractSubjectsFromEdital(editalText: string): Promise<ExtractedSubject[]> {
  console.log(`[extractSubjectsFromEdital] Starting with ${editalText.length} chars`);
  
  // Se o texto for muito longo, dividir em chunks
  // GPT-4.1 suporta 128k tokens (~100k caracteres)
  if (editalText.length > 100000) {
    console.log(`[EditalParser] Text is long (${editalText.length} chars), using chunking strategy`);
    return await extractWithChunking(editalText);
  }
  
  // Texto curto: processar diretamente
  return await extractFromSingleText(editalText);
}

/**
 * Extrai conteúdo de texto longo usando chunking
 */
async function extractWithChunking(editalText: string): Promise<ExtractedSubject[]> {
  const chunks = chunkText(editalText, 100000);
  console.log(`[EditalParser] Split into ${chunks.length} chunks`);
  
  const allSubjects: ExtractedSubject[] = [];
  
  // Processar cada chunk
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[EditalParser] Processing chunk ${i + 1}/${chunks.length}`);
    
    try {
      const chunkSubjects = await extractFromSingleText(chunks[i]);
      
      // Mesclar com resultados anteriores
      for (const subject of chunkSubjects) {
        const existing = allSubjects.find(s => s.name.toLowerCase() === subject.name.toLowerCase());
        
        if (existing) {
          // Matéria já existe: adicionar tópicos
          existing.topics.push(...subject.topics);
          // Atualizar peso (média)
          existing.weight = Math.round((existing.weight + subject.weight) / 2);
        } else {
          // Nova matéria
          allSubjects.push(subject);
        }
      }
    } catch (error) {
      console.error(`[EditalParser] Error processing chunk ${i + 1}:`, error);
      // Continuar com próximos chunks
    }
  }
  
  return allSubjects;
}

/**
 * Extrai conteúdo de um único texto (chunk)
 */
async function extractFromSingleText(editalText: string): Promise<ExtractedSubject[]> {
  const prompt = `Você é um especialista em análise de editais de concursos públicos.

Analise o seguinte conteúdo programático de um edital e extraia:

1. **Matérias** (ex: Português, Matemática, Direito Constitucional)
2. **Tópicos** principais de cada matéria
3. **Subtópicos** quando houver hierarquia clara
4. **Peso** de cada matéria (1-10, baseado no volume de conteúdo)
5. **Dificuldade** de cada matéria, tópico e subtópico (1=básico, 2=intermediário, 3=avançado)
6. **Prioridade** (1-10, baseado em frequência em concursos similares)
7. **Estimativa de conceitos** por tópico/subtópico (quantos conceitos diferentes precisam ser aprendidos)

EDITAL:
\`\`\`
${editalText} 
\`\`\`

Retorne um JSON estruturado seguindo este formato EXATO:

{
  "subjects": [
    {
      "name": "Português",
      "weight": 8,
      "difficulty": 2,
      "priority": 9,
      "topics": [
        {
          "name": "Gramática",
          "description": "Regras gramaticais da língua portuguesa",
          "difficulty": 2,
          "priority": 9,
          "estimatedConcepts": 15,
          "subtopics": [
            {
              "name": "Concordância Verbal",
              "description": "Regras de concordância entre verbo e sujeito",
              "difficulty": 2,
              "priority": 10,
              "estimatedConcepts": 5
            }
          ]
        }
      ]
    }
  ]
}

IMPORTANTE:
- Seja específico nos tópicos
- Estime conceitos de forma realista (1 conceito = 1 pílula de teoria)
- Prioridade alta (8-10) para tópicos muito cobrados
- Peso baseado no volume total de conteúdo da matéria
- **SEMPRE inclua subtópicos quando houver itens numerados ou detalhamento**
- Subtópicos devem capturar a granularidade do edital (ex: "1.1", "1.2", "a)", "b)")
- Se um tópico tem 5+ itens listados, cada item deve virar um subtópico
- Descrições devem ser claras e auto-explicativas
- Priorize COMPLETUDE: não omita nenhum tópico ou subtópico do edital`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    messages: [
      { role: 'system', content: 'Você é um especialista em análise de editais de concursos públicos.' },
      { role: 'user', content: prompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'edital_content',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            subjects: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  weight: { type: 'integer' },
                  difficulty: { type: 'integer' },
                  priority: { type: 'integer' },
                  topics: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        difficulty: { type: 'integer' },
                        priority: { type: 'integer' },
                        estimatedConcepts: { type: 'integer' },
                        subtopics: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: { type: 'string' },
                              description: { type: 'string' },
                              difficulty: { type: 'integer' },
                              priority: { type: 'integer' },
                              estimatedConcepts: { type: 'integer' },
                            },
                            required: ['name', 'description', 'difficulty', 'priority', 'estimatedConcepts'],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ['name', 'description', 'difficulty', 'priority', 'estimatedConcepts', 'subtopics'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['name', 'weight', 'difficulty', 'priority', 'topics'],
                additionalProperties: false,
              },
            },
          },
          required: ['subjects'],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 16000,
  });

  const content = response.choices[0].message.content;
  if (typeof content !== 'string') {
    throw new Error('Invalid response from LLM');
  }

  const parsed = JSON.parse(content);
  return parsed.subjects;
}

/**
 * Salva matéria e seus tópicos no banco
 */
async function saveSubjectWithTopics(
  editalId: number,
  subject: ExtractedSubject,
  displayOrder: number
): Promise<void> {
  // Gerar slug
  const slug = subject.name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Inserir matéria
  const subjectResult = await query(
    `INSERT INTO subjects (edital_id, name, slug, weight, difficulty, priority, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [editalId, subject.name, slug, subject.weight, subject.difficulty, subject.priority, displayOrder]
  );

  const subjectId = subjectResult.rows[0].id;

  // Inserir tópicos
  for (let i = 0; i < subject.topics.length; i++) {
    const topic = subject.topics[i];
    await saveTopicWithSubtopics(subjectId, topic, i);
  }
}

/**
 * Salva tópico e subtópicos no banco
 */
async function saveTopicWithSubtopics(
  subjectId: number,
  topic: ExtractedTopic,
  displayOrder: number
): Promise<void> {
  // Gerar slug
  const slug = topic.name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Inserir tópico
  const topicResult = await query(
    `INSERT INTO topics (subject_id, name, slug, description, difficulty, priority, estimated_concepts, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [subjectId, topic.name, slug, topic.description || '', topic.difficulty, topic.priority, topic.estimatedConcepts, displayOrder]
  );

  const topicId = topicResult.rows[0].id;

  // Inserir subtópicos se houver
  if (topic.subtopics && topic.subtopics.length > 0) {
    for (let i = 0; i < topic.subtopics.length; i++) {
      const subtopic = topic.subtopics[i];
      await saveSubtopic(topicId, subtopic, i);
    }
  }
}

/**
 * Salva subtópico no banco
 */
async function saveSubtopic(
  topicId: number,
  subtopic: ExtractedSubtopic,
  displayOrder: number
): Promise<void> {
  // Gerar slug
  const slug = subtopic.name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Inserir subtópico
  await query(
    `INSERT INTO subtopics (topic_id, name, slug, description, difficulty, priority, estimated_concepts, display_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [topicId, subtopic.name, slug, subtopic.description || '', subtopic.difficulty, subtopic.priority, subtopic.estimatedConcepts, displayOrder]
  );
}

/**
 * Busca matérias de um edital
 */
export async function getEditalSubjects(editalId: number): Promise<any[]> {
  const result = await query(
    'SELECT * FROM subjects WHERE edital_id = $1 ORDER BY display_order',
    [editalId]
  );
  return result.rows;
}

/**
 * Busca tópicos de uma matéria
 */
export async function getSubjectTopics(subjectId: number): Promise<any[]> {
  const result = await query(
    'SELECT * FROM topics WHERE subject_id = $1 ORDER BY display_order',
    [subjectId]
  );
  return result.rows;
}

/**
 * Busca subtópicos de um tópico
 */
export async function getTopicSubtopics(topicId: number): Promise<any[]> {
  const result = await query(
    'SELECT * FROM subtopics WHERE topic_id = $1 ORDER BY display_order',
    [topicId]
  );
  return result.rows;
}

/**
 * Calcula estatísticas do edital
 */
export async function calculateEditalStats(editalId: number): Promise<{
  totalSubjects: number;
  totalTopics: number;
  totalSubtopics: number;
  totalConcepts: number;
  estimatedPills: number;
}> {
  // Buscar matérias
  const subjects = await getEditalSubjects(editalId);
  const totalSubjects = subjects.length;

  let totalTopics = 0;
  let totalSubtopics = 0;
  let totalConcepts = 0;

  // Somar tópicos, subtópicos e conceitos de todas as matérias
  for (const subject of subjects) {
    const topics = await getSubjectTopics(subject.id);
    totalTopics += topics.length;

    for (const topic of topics) {
      totalConcepts += topic.estimated_concepts || 0;
      
      const subtopics = await getTopicSubtopics(topic.id);
      totalSubtopics += subtopics.length;
      
      for (const subtopic of subtopics) {
        totalConcepts += subtopic.estimated_concepts || 0;
      }
    }
  }

  // Cada conceito gera 1 teoria + 1 exercício + 5 revisões = 7 pílulas
  const estimatedPills = totalConcepts * 7;

  return {
    totalSubjects,
    totalTopics,
    totalSubtopics,
    totalConcepts,
    estimatedPills,
  };
}
