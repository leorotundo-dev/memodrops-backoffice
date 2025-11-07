import 'dotenv/config';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn('[openai] OPENAI_API_KEY não definida!');
}
export const openai = new OpenAI({ apiKey });

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export function buildPrompt(content: string) {
  return [
    { role: 'system', content: 'Você é um extrator de estrutura de editais de concursos. Responda em JSON válido com keys: contests, subjects, topics. Seja fiel ao texto.' },
    { role: 'user', content: content },
  ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}

export async function extractStructure(content: string) {
  const messages = buildPrompt(content);
  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    temperature: 0.2,
    response_format: { type: 'json_object' } as any
  });
  const out = resp.choices[0]?.message?.content || '{}';
  return JSON.parse(out);
}