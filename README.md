# memodrops-processing (Motor de IA)

Serviço Node + TypeScript que processa editais coletados (status `fetched`), extrai estrutura com OpenAI e envia para o backoffice via `/api/harvester/ingest`. Feito para Railway.

## Rotas
- `GET /health` → `{ ok: true }`
- `POST /admin/harvest/process` → executa um ciclo agora.

## Env (Railway → Variables)
Veja `.env.example`:
DATABASE_URL, OPENAI_API_KEY, OPENAI_MODEL, MIN_CONTENT_LENGTH, BATCH_SIZE, HARVESTER_BASE_URL, PORT.