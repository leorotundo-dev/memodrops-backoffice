// src/adapters/fetch.ts
import { request } from 'undici';
export async function fetchHTML(url) {
    const res = await request(url, {
        method: 'GET',
        headers: { 'user-agent': process.env.USER_AGENT || 'MemoDropsHarvester/0.1' }
    });
    if (res.statusCode >= 400)
        throw new Error(`HTTP ${res.statusCode} for ${url}`);
    return await res.body.text();
}
