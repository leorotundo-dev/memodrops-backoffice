-- Migration: 008_create_user_tables
-- Descrição: Cria as tabelas users, user_stats e daily_plans para personalização
-- Data: 2025-11-07

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}'::jsonb, -- preferências do usuário (temas, notificações, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de estatísticas de usuário (respostas aos drops)
CREATE TABLE IF NOT EXISTS user_stats (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drop_id INT NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL,
  confidence_level INT CHECK (confidence_level BETWEEN 1 AND 5), -- 1=muito difícil, 5=muito fácil
  time_spent_seconds INT, -- tempo gasto para responder
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, drop_id, answered_at) -- permite múltiplas tentativas ao longo do tempo
);

-- Tabela de planos diários
CREATE TABLE IF NOT EXISTS daily_plans (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  drops_ids INT[] NOT NULL, -- array de IDs dos drops do plano
  target_drops_count INT DEFAULT 10, -- meta de drops para o dia
  completed_drops_count INT DEFAULT 0, -- drops completados
  total_time_minutes INT DEFAULT 0, -- tempo total gasto
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Índices para melhorar performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

CREATE INDEX idx_user_stats_user ON user_stats(user_id);
CREATE INDEX idx_user_stats_drop ON user_stats(drop_id);
CREATE INDEX idx_user_stats_answered_at ON user_stats(answered_at DESC);
CREATE INDEX idx_user_stats_user_drop ON user_stats(user_id, drop_id);

CREATE INDEX idx_daily_plans_user ON daily_plans(user_id);
CREATE INDEX idx_daily_plans_date ON daily_plans(date DESC);
CREATE INDEX idx_daily_plans_user_date ON daily_plans(user_id, date);
CREATE INDEX idx_daily_plans_status ON daily_plans(status);

-- Comentários para documentação
COMMENT ON TABLE users IS 'Usuários do sistema MemoDrops';
COMMENT ON COLUMN users.preferences IS 'Preferências do usuário (JSON): temas, notificações, metas diárias, etc.';

COMMENT ON TABLE user_stats IS 'Estatísticas de respostas dos usuários aos drops';
COMMENT ON COLUMN user_stats.is_correct IS 'Se o usuário acertou o drop';
COMMENT ON COLUMN user_stats.confidence_level IS 'Nível de confiança do usuário (1-5): 1=muito difícil, 5=muito fácil';
COMMENT ON COLUMN user_stats.time_spent_seconds IS 'Tempo gasto para responder ao drop (em segundos)';

COMMENT ON TABLE daily_plans IS 'Planos diários de estudo personalizados para cada usuário';
COMMENT ON COLUMN daily_plans.drops_ids IS 'Array de IDs dos drops selecionados para o dia';
COMMENT ON COLUMN daily_plans.target_drops_count IS 'Meta de drops para completar no dia';
COMMENT ON COLUMN daily_plans.completed_drops_count IS 'Quantidade de drops já completados';
COMMENT ON COLUMN daily_plans.total_time_minutes IS 'Tempo total gasto no plano (em minutos)';
COMMENT ON COLUMN daily_plans.status IS 'Status do plano: pending, in_progress, completed';
