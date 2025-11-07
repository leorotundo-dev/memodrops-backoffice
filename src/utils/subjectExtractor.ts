/**
 * Extrator Inteligente de Matérias
 * 
 * Busca e extrai matérias/disciplinas de editais com alta precisão
 */

// Base de conhecimento de matérias comuns em concursos
const KNOWN_SUBJECTS = {
  // Básicas
  'português': ['língua portuguesa', 'portugues', 'gramatica', 'redação'],
  'matemática': ['matematica', 'raciocínio lógico', 'raciocinio logico'],
  'informática': ['informatica', 'computação', 'ti', 'tecnologia da informação'],
  'inglês': ['ingles', 'língua inglesa', 'lingua inglesa'],
  
  // Específicas
  'direito constitucional': ['constitucional', 'const.'],
  'direito administrativo': ['administrativo', 'adm.'],
  'direito penal': ['penal'],
  'direito civil': ['civil'],
  'direito tributário': ['tributario', 'tributário'],
  'direito processual': ['processual'],
  
  // Conhecimentos gerais
  'atualidades': ['conhecimentos gerais', 'atualidades'],
  'geografia': ['geografia'],
  'história': ['historia', 'história'],
  
  // Específicas por área
  'contabilidade': ['contabilidade', 'ciências contábeis'],
  'administração': ['administracao', 'administração pública'],
  'economia': ['economia'],
  'estatística': ['estatistica', 'estatística'],
  'legislação': ['legislacao', 'legislação'],
};

export interface ExtractedSubject {
  name: string;
  confidence: number; // 0-1
  topics: string[];
  source: string; // onde foi encontrado
  verified: boolean;
}

export interface SubjectExtractionResult {
  subjects: ExtractedSubject[];
  total_found: number;
  confidence_score: number; // média de confiança
  needs_review: boolean;
}

/**
 * Extrai matérias de texto de edital
 */
export function extractSubjects(text: string, url?: string): SubjectExtractionResult {
  const subjects: ExtractedSubject[] = [];
  const textLower = text.toLowerCase();
  
  // Padrão 1: Seções explícitas de "Conteúdo Programático" ou "Disciplinas"
  const programaticSections = extractFromProgramaticSection(text);
  subjects.push(...programaticSections);
  
  // Padrão 2: Listas numeradas ou com marcadores
  const listedSubjects = extractFromLists(text);
  subjects.push(...listedSubjects);
  
  // Padrão 3: Busca por matérias conhecidas
  const knownMatches = extractKnownSubjects(textLower);
  subjects.push(...knownMatches);
  
  // Padrão 4: Busca por padrões específicos (ex: "Conhecimentos de X")
  const patternMatches = extractByPatterns(text);
  subjects.push(...patternMatches);
  
  // Deduplica e mescla matérias similares
  const merged = mergeAndDeduplicate(subjects);
  
  // Calcula score de confiança
  const confidenceScore = calculateConfidence(merged);
  
  // Determina se precisa revisão manual
  const needsReview = confidenceScore < 0.7 || merged.length === 0;
  
  return {
    subjects: merged,
    total_found: merged.length,
    confidence_score: confidenceScore,
    needs_review: needsReview
  };
}

/**
 * Extrai matérias de seção de conteúdo programático
 */
function extractFromProgramaticSection(text: string): ExtractedSubject[] {
  const subjects: ExtractedSubject[] = [];
  
  // Buscar seção de conteúdo programático
  const patterns = [
    /CONTEÚDO PROGRAMÁTICO[:\s]+(.*?)(?=ANEXO|CRONOGRAMA|$)/is,
    /CONHECIMENTOS EXIGIDOS[:\s]+(.*?)(?=ANEXO|CRONOGRAMA|$)/is,
    /DISCIPLINAS[:\s]+(.*?)(?=ANEXO|CRONOGRAMA|$)/is,
    /MATÉRIAS[:\s]+(.*?)(?=ANEXO|CRONOGRAMA|$)/is,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const section = match[1];
      
      // Extrair matérias da seção
      const lines = section.split('\n').filter(l => l.trim().length > 5);
      
      for (const line of lines) {
        // Remover numeração e marcadores
        const cleaned = line.replace(/^[\d\.\-\*\•\s]+/, '').trim();
        
        if (cleaned.length > 3 && cleaned.length < 100) {
          // Extrair tópicos se houver
          const topics = extractTopicsFromLine(line);
          
          subjects.push({
            name: cleaned,
            confidence: 0.9,
            topics,
            source: 'programatic_section',
            verified: false
          });
        }
      }
      
      break; // Encontrou seção, não precisa continuar
    }
  }
  
  return subjects;
}

/**
 * Extrai matérias de listas
 */
function extractFromLists(text: string): ExtractedSubject[] {
  const subjects: ExtractedSubject[] = [];
  const lines = text.split('\n');
  
  let inList = false;
  let listItems: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detectar início de lista
    if (/^[\d\.\-\*\•]\s+[A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜ]/.test(trimmed)) {
      inList = true;
      const cleaned = trimmed.replace(/^[\d\.\-\*\•\s]+/, '');
      listItems.push(cleaned);
    } else if (inList && trimmed.length === 0) {
      // Fim da lista
      if (listItems.length >= 3 && listItems.length <= 30) {
        // Provavelmente é lista de matérias
        listItems.forEach(item => {
          if (item.length > 3 && item.length < 100) {
            subjects.push({
              name: item,
              confidence: 0.7,
              topics: [],
              source: 'list',
              verified: false
            });
          }
        });
      }
      inList = false;
      listItems = [];
    } else if (inList) {
      const cleaned = trimmed.replace(/^[\d\.\-\*\•\s]+/, '');
      if (cleaned.length > 0) {
        listItems.push(cleaned);
      }
    }
  }
  
  return subjects;
}

/**
 * Busca por matérias conhecidas
 */
function extractKnownSubjects(textLower: string): ExtractedSubject[] {
  const subjects: ExtractedSubject[] = [];
  
  for (const [subject, aliases] of Object.entries(KNOWN_SUBJECTS)) {
    for (const alias of aliases) {
      if (textLower.includes(alias)) {
        subjects.push({
          name: subject,
          confidence: 0.8,
          topics: [],
          source: 'known_subject',
          verified: true
        });
        break; // Encontrou, não precisa testar outros aliases
      }
    }
  }
  
  return subjects;
}

/**
 * Extrai por padrões específicos
 */
function extractByPatterns(text: string): ExtractedSubject[] {
  const subjects: ExtractedSubject[] = [];
  
  const patterns = [
    /Conhecimentos? (?:de|em) ([A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜ][a-zàáâãäåçèéêëìíîïñòóôõöùúûü\s]+)/g,
    /Noções de ([A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜ][a-zàáâãäåçèéêëìíîïñòóôõöùúûü\s]+)/g,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const subject = match[1].trim();
      if (subject.length > 3 && subject.length < 50) {
        subjects.push({
          name: subject,
          confidence: 0.75,
          topics: [],
          source: 'pattern',
          verified: false
        });
      }
    }
  }
  
  return subjects;
}

/**
 * Extrai tópicos de uma linha de matéria
 */
function extractTopicsFromLine(line: string): string[] {
  const topics: string[] = [];
  
  // Buscar tópicos após ":" ou "-"
  const topicMatch = line.match(/[:–-]\s*(.+)$/);
  if (topicMatch) {
    const topicsText = topicMatch[1];
    // Separar por vírgula, ponto-e-vírgula
    const items = topicsText.split(/[;,]/).map(t => t.trim()).filter(t => t.length > 3);
    topics.push(...items);
  }
  
  return topics;
}

/**
 * Mescla e deduplica matérias similares
 */
function mergeAndDeduplicate(subjects: ExtractedSubject[]): ExtractedSubject[] {
  const merged: ExtractedSubject[] = [];
  
  for (const subject of subjects) {
    // Verificar se já existe matéria similar
    const existing = merged.find(m => 
      similarity(m.name.toLowerCase(), subject.name.toLowerCase()) > 0.8
    );
    
    if (existing) {
      // Mesclar: manter maior confiança e combinar tópicos
      if (subject.confidence > existing.confidence) {
        existing.confidence = subject.confidence;
      }
      existing.topics = [...new Set([...existing.topics, ...subject.topics])];
      existing.verified = existing.verified || subject.verified;
    } else {
      merged.push({ ...subject });
    }
  }
  
  return merged.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Calcula similaridade entre duas strings (0-1)
 */
function similarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calcula distância de Levenshtein
 */
function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * Calcula score de confiança geral
 */
function calculateConfidence(subjects: ExtractedSubject[]): number {
  if (subjects.length === 0) return 0;
  
  const avgConfidence = subjects.reduce((sum, s) => sum + s.confidence, 0) / subjects.length;
  
  // Penalizar se muito poucas matérias (concursos normalmente têm 5+)
  const quantityFactor = Math.min(subjects.length / 5, 1);
  
  // Bonus se tem matérias verificadas
  const verifiedCount = subjects.filter(s => s.verified).length;
  const verifiedBonus = Math.min(verifiedCount * 0.05, 0.15);
  
  return Math.min(avgConfidence * quantityFactor + verifiedBonus, 1);
}
