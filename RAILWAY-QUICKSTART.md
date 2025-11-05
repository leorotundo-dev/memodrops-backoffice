# 🚀 Deploy Rápido no Railway (5 minutos)

## Pré-requisitos
- ✅ Conta no Railway: https://railway.app
- ✅ Conta no GitHub
- ✅ Git instalado localmente

---

## 📝 Passo a Passo

### 1️⃣ Criar Repositório no GitHub

```bash
# No seu computador, extraia o ZIP e entre na pasta
cd memodrops-backoffice

# Crie um repositório no GitHub (via web ou CLI)
gh repo create memodrops-backoffice --public --source=. --remote=origin --push
```

**Ou via interface web:**
1. Acesse https://github.com/new
2. Nome: `memodrops-backoffice`
3. Público ou Privado (tanto faz)
4. **NÃO** inicialize com README
5. Clique em "Create repository"
6. Execute os comandos mostrados na tela:

```bash
git remote add origin https://github.com/SEU-USUARIO/memodrops-backoffice.git
git branch -M main
git push -u origin main
```

---

### 2️⃣ Criar Projeto no Railway

1. Acesse https://railway.app/dashboard
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Escolha o repositório `memodrops-backoffice`
5. Railway vai detectar automaticamente e iniciar o build

---

### 3️⃣ Adicionar PostgreSQL

1. No projeto Railway, clique em **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Aguarde 1-2 minutos (provisionamento automático)
3. Railway vai criar automaticamente as variáveis:
   - `PGHOST`
   - `PGPORT`
   - `PGDATABASE`
   - `PGUSER`
   - `PGPASSWORD`
   - `DATABASE_URL`

---

### 4️⃣ Configurar Variáveis Adicionais

No Railway, vá em **Settings** → **Variables** e adicione:

```env
PORT=3001
NODE_ENV=production
USER_AGENT=MemoDropsHarvester/1.0
```

---

### 5️⃣ Inicializar Schema do Banco

Após o primeiro deploy bem-sucedido:

1. No Railway, clique no serviço do backoffice
2. Vá em **"Deploy"** → **"View Logs"**
3. Aguarde o build terminar
4. Clique nos **3 pontinhos** → **"Run Command"**
5. Digite: `pnpm setup-db`
6. Execute

**Ou via Railway CLI:**

```bash
# Instalar CLI (se não tiver)
npm install -g @railway/cli

# Login
railway login

# Linkar projeto
railway link

# Executar setup
railway run pnpm setup-db
```

---

### 6️⃣ Verificar Deploy

Railway vai gerar uma URL automática. Acesse:

**Health Check:**
```
https://seu-app.railway.app/health
```

Deve retornar:
```json
{
  "status": "ok",
  "service": "memodrops-backoffice"
}
```

**Dashboard:**
```
https://seu-app.railway.app/dashboard/
```

**API de IC:**
```
https://seu-app.railway.app/api/ic/calculate?topic=Direito%20Constitucional
```

Deve retornar:
```json
{
  "topic": "Direito Constitucional",
  "ic": 0
}
```
*(IC será 0 até você coletar provas)*

---

### 7️⃣ Testar Coleta de Provas

**Via Railway Dashboard:**
1. Vá em **"Deploy"** → **"Run Command"**
2. Digite: `pnpm harvest`
3. Execute
4. Acompanhe os logs

**Ou via API:**
```bash
curl -X POST https://seu-app.railway.app/admin/harvest/run
```

---

### 8️⃣ Conectar ao MemoDrops

No projeto MemoDrops (Manus), adicione a variável:

```env
BACKOFFICE_URL=https://seu-app.railway.app
```

Depois, reinicie o MemoDrops.

---

## 🔄 Cron Job (Coleta Automática)

Para coleta diária às 2h da manhã, edite `src/server.ts` e adicione:

```typescript
import cron from 'node-cron';
import { runAll } from './jobs/harvest.js';

// Após app.listen()
cron.schedule('0 2 * * *', async () => {
  console.log('🕐 Executando coleta agendada...');
  try {
    await runAll();
    console.log('✅ Coleta concluída');
  } catch (error) {
    console.error('❌ Erro na coleta:', error);
  }
});
```

Depois, faça commit e push:

```bash
git add .
git commit -m "Add cron job for daily harvesting"
git push
```

Railway vai fazer redeploy automático.

---

## 🐛 Troubleshooting

### Erro: "Cannot connect to database"

**Solução:** Verifique se o PostgreSQL está rodando e as variáveis estão configuradas.

```bash
railway run psql $DATABASE_URL
```

### Erro: "Table does not exist"

**Solução:** Execute o setup do banco:

```bash
railway run pnpm setup-db
```

### Build falha

**Solução:** Verifique os logs no Railway Dashboard.

Teste localmente:

```bash
pnpm install
pnpm build
```

### Dashboard não carrega

**Solução:** Verifique se a pasta `public/dashboard/` foi commitada no Git.

```bash
git add public/dashboard/
git commit -m "Add dashboard"
git push
```

---

## 💰 Custos

**Railway Pricing (2025):**
- PostgreSQL: ~$5/mês (1GB)
- Backoffice Service: ~$5-10/mês
- **Total:** ~$10-15/mês

**Plano Gratuito:**
- $5 de crédito/mês grátis
- Suficiente para testes

---

## ✅ Checklist

- [ ] Repositório criado no GitHub
- [ ] Projeto criado no Railway
- [ ] PostgreSQL adicionado
- [ ] Variáveis configuradas
- [ ] Schema inicializado (`pnpm setup-db`)
- [ ] Health check respondendo
- [ ] Dashboard acessível
- [ ] API de IC funcionando
- [ ] Coleta de provas testada
- [ ] MemoDrops conectado (`BACKOFFICE_URL`)
- [ ] Cron job configurado (opcional)

---

## 🎉 Pronto!

Seu backoffice está no ar! 🚀

**Próximos passos:**
1. Testar coleta de provas reais
2. Verificar cálculo de IC
3. Integrar com MemoDrops
4. Monitorar logs

**Dúvidas?** Consulte `DEPLOY.md` ou `ARCHITECTURE.md`
