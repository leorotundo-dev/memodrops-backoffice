import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Extrai texto de um arquivo PDF usando pdftotext (poppler-utils)
 * @param pdfPath Caminho do arquivo PDF
 * @returns Texto extraído do PDF
 */
export async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const outputPath = path.join('/tmp', `${Date.now()}-extracted.txt`);
  
  try {
    // Usar pdftotext do poppler-utils (já instalado no sistema)
    await execAsync(`pdftotext "${pdfPath}" "${outputPath}"`);
    
    // Ler arquivo gerado
    const text = fs.readFileSync(outputPath, 'utf-8');
    
    // Limpar arquivo temporário
    fs.unlinkSync(outputPath);
    
    return text;
  } catch (error) {
    console.error('[PDFExtractor] Error extracting text:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extrai apenas a seção de conteúdo programático do edital
 * @param fullText Texto completo do edital
 * @returns Texto do conteúdo programático
 */
export function extractProgramContent(fullText: string): string {
  // Procurar por padrões comuns de início de conteúdo programático
  const patterns = [
    /ANEXO\s+I\s*[-–]\s*CONTEÚDO PROGRAMÁTICO/i,
    /CONTEÚDO PROGRAMÁTICO/i,
    /PROGRAMA DAS PROVAS/i,
    /CONHECIMENTOS BÁSICOS/i,
  ];
  
  let startIndex = -1;
  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match && match.index !== undefined) {
      startIndex = match.index;
      break;
    }
  }
  
  if (startIndex === -1) {
    // Se não encontrar seção específica, retorna texto completo
    console.warn('[PDFExtractor] Could not find program content section, using full text');
    return fullText;
  }
  
  // Procurar por fim da seção (próximo ANEXO ou fim do documento)
  const endPatterns = [
    /ANEXO\s+II/i,
    /ANEXO\s+2/i,
  ];
  
  let endIndex = fullText.length;
  for (const pattern of endPatterns) {
    const match = fullText.slice(startIndex + 100).match(pattern);
    if (match && match.index !== undefined) {
      endIndex = startIndex + 100 + match.index;
      break;
    }
  }
  
  return fullText.slice(startIndex, endIndex).trim();
}

/**
 * Divide texto longo em chunks para processamento com IA
 * @param text Texto completo
 * @param maxChunkSize Tamanho máximo de cada chunk em caracteres
 * @returns Array de chunks
 */
export function chunkText(text: string, maxChunkSize: number = 15000): string[] {
  const chunks: string[] = [];
  
  // Dividir por seções (matérias)
  const sections = text.split(/\n(?=[A-ZÀÁÂÃÉÊÍÓÔÕÚÇ][A-ZÀÁÂÃÉÊÍÓÔÕÚÇ\s]{3,}:)/);
  
  let currentChunk = '';
  
  for (const section of sections) {
    if ((currentChunk + section).length <= maxChunkSize) {
      currentChunk += section + '\n';
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = section + '\n';
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
