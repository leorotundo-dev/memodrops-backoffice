/**
 * Upload Handler
 * 
 * Endpoint para upload de arquivos (editais em PDF)
 * Storage: Local filesystem (/tmp/editals)
 */

import { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';

// Diretório para uploads
const UPLOAD_DIR = '/tmp/editals';

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

    // Salvar arquivo localmente
    await fs.writeFile(filePath, file.buffer);

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
      size: file.size,
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
