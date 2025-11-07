
import axios from 'axios';

/**
 * fetchHTML - baixa HTML com timeout e headers básicos
 */
export async function fetchHTML(url: string, timeoutMs = 30000): Promise<string> {
  const res = await axios.get(url, {
    timeout: timeoutMs,
    headers: {
      'User-Agent': 'MemoDropsBot/1.0 (+https://memodrops.com)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    // evita redirects infinitos
    maxRedirects: 3
  });
  return String(res.data || '');
}
