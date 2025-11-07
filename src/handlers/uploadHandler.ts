/**
 * Upload Handler
 * 
 * Endpoint para upload de arquivos (editais em PDF)
 * Storage: Persistent volume (/data/uploads via Railway Volume)
 */

import { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

// Diretório para uploads (persistente via Railway Volume)
// Railway monta volumes em /data, então usamos /data/uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

// Configurar multer para armazenar em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Aceitar apenas PDFs
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos'));
    }
  },
});

export const uploadMiddleware = upload.single('file');

export async function handleUpload(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const file = req.file;
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.originalname}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Criar diretório se não existir
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Comprimir PDF antes de salvar
    let finalBuffer = file.buffer;
    let compressionRatio = 0;
    
    try {
      const pdfDoc = await PDFDocument.load(file.buffer);
      
      // Remover metadados desnecessários para reduzir tamanho
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
      
      // Salvar com compressão
      const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
      
      compressionRatio = ((file.size - compressedBytes.length) / file.size * 100);
      
      if (compressedBytes.length < file.size) {
        finalBuffer = Buffer.from(compressedBytes);
        console.log(`[Upload] PDF comprimido: ${file.size} -> ${compressedBytes.length} bytes (${compressionRatio.toFixed(1)}% redução)`);
      } else {
        console.log('[Upload] Compressão não reduziu tamanho, usando original');
      }
    } catch (compressError) {
      console.warn('[Upload] Erro ao comprimir PDF, usando original:', compressError);
    }
    
    // Salvar arquivo localmente
    await fs.writeFile(filePath, finalBuffer);

    // Construir URL pública
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${process.env.PORT || 3001}`;
    
    const url = `${baseUrl}/uploads/${fileName}`;

    console.log('[Upload] File saved:', {
      originalName: file.originalname,
      fileName,
      filePath,
      size: file.size,
      url,
    });

    return res.json({ 
      success: true,
      url, 
      filePath,
      fileName,
      size: finalBuffer.length,
      originalSize: file.size,
      compressionRatio: compressionRatio.toFixed(1) + '%',
      mimeType: file.mimetype,
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao fazer upload' 
    });
  }
}
