// src/pipeline/utils.ts
import crypto from 'node:crypto';
export function hashText(s: string){ return crypto.createHash('sha256').update(s).digest('hex'); }
export function now(){ return new Date().toISOString(); }
