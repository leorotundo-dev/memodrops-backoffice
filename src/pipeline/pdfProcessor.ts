/**
 * PDF Processor for Harvest Pipeline
 * 
 * Baixa e extrai texto de PDFs encontrados pelos adaptadores
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Verifica se uma URL é de um PDF
 */
export function isPdfUrl(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?');
}

/**
 * Baixa um PDF de uma URL e salva temporariamente
 */
async function downloadPdf(url: string): Promise<string> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Salvar temporariamente
  const tempPath = path.join('/tmp', `pdf-${Date.now()}.pdf`);
  fs.writeFileSync(tempPath, buffer);
  
  return tempPath;
}

/**
 * Extrai texto de um arquivo PDF usando pdftotext
 */
async function extractTextFromPdfFile(pdfPath: string): Promise<string> {
  const outputPath = path.join('/tmp', `${Date.now()}-extracted.txt`);
  
  try {
    // Usar pdftotext do poppler-utils
    await execAsync(`pdftotext "${pdfPath}" "${outputPath}"`);
    
    // Ler arquivo gerado
    const text = fs.readFileSync(outputPath, 'utf-8');
    
    // Limpar arquivo temporário
    fs.unlinkSync(outputPath);
    
    return text;
  } catch (error) {
    console.error('[PDFProcessor] Erro ao extrair texto:', error);
    throw error;
  }
}

/**
 * Limpa e normaliza texto extraído de PDF
 */
function cleanPdfText(text: string): string {
  return text
    // Remove múltiplos espaços
    .replace(/\s+/g, ' ')
    // Remove quebras de linha excessivas
    .replace(/\n{3,}/g, '\n\n')
    // Remove caracteres especiais problemáticos
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Trim
    .trim();
}

/**
 * Processa um PDF: baixa, extrai texto e limpa
 */
export async function processPdf(url: string): Promise<string | null> {
  let tempPath: string | null = null;
  
  try {
    console.log(`[PDFProcessor] Processando PDF: ${url}`);
    
    // Baixar PDF
    tempPath = await downloadPdf(url);
    console.log(`[PDFProcessor] PDF baixado: ${tempPath}`);
    
    // Extrair texto
    const rawText = await extractTextFromPdfFile(tempPath);
    console.log(`[PDFProcessor] Texto extraído: ${rawText.length} caracteres`);
    
    // Limpar texto
    const cleanText = cleanPdfText(rawText);
    console.log(`[PDFProcessor] Texto limpo: ${cleanText.length} caracteres`);
    
    return cleanText;
  } catch (error) {
    console.error(`[PDFProcessor] Erro ao processar PDF ${url}:`, error);
    return null;
  } finally {
    // Limpar arquivo temporário
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

/**
 * Processa múltiplos PDFs em paralelo (com limite)
 */
export async function processPdfsInBatch(urls: string[], maxConcurrent: number = 3): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  
  // Processar em batches
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);
    const promises = batch.map(async url => {
      const text = await processPdf(url);
      return { url, text };
    });
    
    const batchResults = await Promise.all(promises);
    
    for (const { url, text } of batchResults) {
      results.set(url, text);
    }
  }
  
  return results;
}
