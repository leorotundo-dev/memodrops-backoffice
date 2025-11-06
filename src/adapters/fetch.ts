// src/adapters/fetch.ts
import { request } from 'undici';

export async function fetchHTML(url: string): Promise<string> {
  const res = await request(url, {
    method: 'GET',
    headers: { 
      'user-agent': process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8'
    }
  });
  if (res.statusCode >= 400) throw new Error(`HTTP ${res.statusCode} for ${url}`);
  return await res.body.text();
}
