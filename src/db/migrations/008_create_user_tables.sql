-- Migration: 008_create_user_tables
-- Descrição: Adiciona colunas à tabela users existente e cria tabelas user_stats e daily_plans
-- Data: 2025-11-07

-- Adicionar colunas à tabela users existente
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Tabela de estatísticas de usuário (respostas aos drops)
CREATE TABLE IF NOT EXISTS user_stats (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drop_id INT NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  is_correct BOOLEAN NOT NULL,
  confidence_level INT CHECK (confidence_level BETWEEN 1 AND 5),
  time_spent_seconds INT,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, drop_id, answered_at)
);

-- Tabela de planos diários
CREATE TABLE IF NOT EXISTS daily_plans (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  drops_ids INT[] NOT NULL,
  target_drops_count INT DEFAULT 10,
  completed_drops_count INT DEFAULT 0,
  total_time_minutes INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_user ON user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_drop ON user_stats(drop_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_answered_at ON user_stats(answered_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_drop ON user_stats(user_id, drop_id);
CREATE INDEX IF NOT EXISTS idx_daily_plans_user ON daily_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_plans_date ON daily_plans(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_plans_status ON daily_plans(status);
