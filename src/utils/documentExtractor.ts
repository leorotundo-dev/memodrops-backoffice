/**
 * Extrator Universal de Documentos
 * 
 * Suporta múltiplos formatos: PDF, DOC, DOCX, TXT, HTML, RTF, ODT
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

export interface ExtractionResult {
  text: string;
  format: string;
  pages?: number;
  error?: string;
}

/**
 * Detecta o formato do documento pela URL ou content-type
 */
function detectFormat(url: string, contentType?: string): string {
  const urlLower = url.toLowerCase();
  
  if (contentType) {
    if (contentType.includes('pdf')) return 'pdf';
    if (contentType.includes('msword') || contentType.includes('document')) return 'doc';
    if (contentType.includes('wordprocessingml')) return 'docx';
    if (contentType.includes('text/plain')) return 'txt';
    if (contentType.includes('text/html')) return 'html';
    if (contentType.includes('rtf')) return 'rtf';
    if (contentType.includes('opendocument')) return 'odt';
  }
  
  if (urlLower.endsWith('.pdf')) return 'pdf';
  if (urlLower.endsWith('.doc')) return 'doc';
  if (urlLower.endsWith('.docx')) return 'docx';
  if (urlLower.endsWith('.txt')) return 'txt';
  if (urlLower.endsWith('.html') || urlLower.endsWith('.htm')) return 'html';
  if (urlLower.endsWith('.rtf')) return 'rtf';
  if (urlLower.endsWith('.odt')) return 'odt';
  
  return 'unknown';
}

/**
 * Extrai texto de PDF usando pdftotext
 */
async function extractPDF(filePath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`pdftotext "${filePath}" -`);
    return stdout;
  } catch (error: any) {
    throw new Error(`Erro ao extrair PDF: ${error.message}`);
  }
}

/**
 * Extrai texto de DOC/DOCX usando antiword ou catdoc
 */
async function extractDOC(filePath: string, format: string): Promise<string> {
  try {
    if (format === 'docx') {
      // Para DOCX, tentar usar unzip + xml parsing
      const { stdout } = await execAsync(`unzip -p "${filePath}" word/document.xml | sed 's/<[^>]*>//g'`);
      return stdout;
    } else {
      // Para DOC, tentar catdoc ou antiword
      try {
        const { stdout } = await execAsync(`catdoc "${filePath}"`);
        return stdout;
      } catch {
        const { stdout } = await execAsync(`antiword "${filePath}"`);
        return stdout;
      }
    }
  } catch (error: any) {
    throw new Error(`Erro ao extrair DOC/DOCX: ${error.message}`);
  }
}

/**
 * Extrai texto de HTML removendo tags
 */
async function extractHTML(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    // Remove tags HTML e scripts
    let text = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text;
  } catch (error: any) {
    throw new Error(`Erro ao extrair HTML: ${error.message}`);
  }
}

/**
 * Extrai texto de TXT
 */
async function extractTXT(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error: any) {
    throw new Error(`Erro ao extrair TXT: ${error.message}`);
  }
}

/**
 * Extrai texto de RTF
 */
async function extractRTF(filePath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`unrtf --text "${filePath}"`);
    return stdout;
  } catch (error: any) {
    // Se unrtf não estiver disponível, tentar extrair manualmente
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      // Remove comandos RTF básicos
      let text = content
        .replace(/\\[a-z]+\d*\s?/g, ' ')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return text;
    } catch {
      throw new Error(`Erro ao extrair RTF: ${error.message}`);
    }
  }
}

/**
 * Extrai texto de ODT usando odt2txt
 */
async function extractODT(filePath: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`odt2txt "${filePath}"`);
    return stdout;
  } catch (error: any) {
    // Se odt2txt não estiver disponível, tentar unzip + xml
    try {
      const { stdout } = await execAsync(`unzip -p "${filePath}" content.xml | sed 's/<[^>]*>//g'`);
      return stdout;
    } catch {
      throw new Error(`Erro ao extrair ODT: ${error.message}`);
    }
  }
}

/**
 * Limpa e normaliza texto extraído
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
}

/**
 * Extrai texto de documento (formato universal)
 */
export async function extractDocument(url: string): Promise<ExtractionResult> {
  const tempDir = '/tmp/document-extraction';
  let tempFile: string | null = null;
  
  try {
    // Criar diretório temporário
    await fs.mkdir(tempDir, { recursive: true });
    
    // Baixar documento
    console.log(`[DocumentExtractor] Baixando: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    const format = detectFormat(url, contentType);
    
    if (format === 'unknown') {
      throw new Error(`Formato não suportado: ${url}`);
    }
    
    // Salvar arquivo temporário
    const buffer = await response.buffer();
    const ext = format === 'docx' ? 'docx' : format;
    tempFile = path.join(tempDir, `doc_${Date.now()}.${ext}`);
    await fs.writeFile(tempFile, buffer);
    
    console.log(`[DocumentExtractor] Extraindo ${format.toUpperCase()}...`);
    
    // Extrair texto baseado no formato
    let text: string;
    
    switch (format) {
      case 'pdf':
        text = await extractPDF(tempFile);
        break;
      case 'doc':
      case 'docx':
        text = await extractDOC(tempFile, format);
        break;
      case 'html':
        text = await extractHTML(tempFile);
        break;
      case 'txt':
        text = await extractTXT(tempFile);
        break;
      case 'rtf':
        text = await extractRTF(tempFile);
        break;
      case 'odt':
        text = await extractODT(tempFile);
        break;
      default:
        throw new Error(`Formato não implementado: ${format}`);
    }
    
    // Limpar e normalizar
    const cleanedText = cleanText(text);
    
    console.log(`[DocumentExtractor] ✅ Texto extraído: ${cleanedText.length} caracteres`);
    
    return {
      text: cleanedText,
      format,
      pages: undefined // TODO: calcular número de páginas se possível
    };
    
  } catch (error: any) {
    console.error(`[DocumentExtractor] Erro ao extrair ${url}:`, error.message);
    return {
      text: '',
      format: 'unknown',
      error: error.message
    };
  } finally {
    // Limpar arquivo temporário
    if (tempFile) {
      try {
        await fs.unlink(tempFile);
      } catch (err) {
        // Ignorar erro de limpeza
      }
    }
  }
}

/**
 * Verifica se uma URL é um documento suportado
 */
export function isDocumentURL(url: string): boolean {
  const urlLower = url.toLowerCase();
  const supportedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.html', '.htm', '.rtf', '.odt'];
  return supportedExtensions.some(ext => urlLower.includes(ext));
}
