-- Migração: Adicionar índices para melhorar performance
-- Data: 2025-11-08
-- Descrição: Adiciona índices em chaves estrangeiras e colunas de data

-- Índices em chaves estrangeiras
CREATE INDEX IF NOT EXISTS idx_daily_plans_user_id ON daily_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_id ON daily_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_questions_subject_id ON diagnostic_questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_user_id ON diagnostic_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_subject_id ON diagnostic_tests(subject_id);
CREATE INDEX IF NOT EXISTS idx_drop_cache_subject_id ON drop_cache(subject_id);
CREATE INDEX IF NOT EXISTS idx_drops_subject_id ON drops(subject_id);
CREATE INDEX IF NOT EXISTS idx_edital_subjects_edital_id ON edital_subjects(edital_id);
CREATE INDEX IF NOT EXISTS idx_edital_subjects_subject_id ON edital_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_editals_contest_id ON editals(contest_id);
CREATE INDEX IF NOT EXISTS idx_exam_logs_user_id ON exam_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_logs_edital_id ON exam_logs(edital_id);
CREATE INDEX IF NOT EXISTS idx_official_subjects_contest_id ON official_subjects(contest_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_items_subject_id ON study_plan_items(subject_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_edital_id ON subjects(edital_id);
CREATE INDEX IF NOT EXISTS idx_topic_priorities_user_id ON topic_priorities(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_priorities_subject_id ON topic_priorities(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);

-- Índices em colunas de data (created_at, updated_at)
CREATE INDEX IF NOT EXISTS idx_achievements_created_at ON achievements(created_at);
CREATE INDEX IF NOT EXISTS idx_categories_created_at ON categories(created_at);
CREATE INDEX IF NOT EXISTS idx_contests_created_at ON contests(created_at);
CREATE INDEX IF NOT EXISTS idx_contests_updated_at ON contests(updated_at);
CREATE INDEX IF NOT EXISTS idx_daily_plans_created_at ON daily_plans(created_at);
CREATE INDEX IF NOT EXISTS idx_daily_plans_updated_at ON daily_plans(updated_at);
CREATE INDEX IF NOT EXISTS idx_daily_rewards_created_at ON daily_rewards(created_at);
CREATE INDEX IF NOT EXISTS idx_diagnostic_questions_created_at ON diagnostic_questions(created_at);
CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_created_at ON diagnostic_tests(created_at);
CREATE INDEX IF NOT EXISTS idx_drop_cache_created_at ON drop_cache(created_at);
CREATE INDEX IF NOT EXISTS idx_drop_metrics_created_at ON drop_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_drops_created_at ON drops(created_at);
CREATE INDEX IF NOT EXISTS idx_edital_subjects_created_at ON edital_subjects(created_at);
CREATE INDEX IF NOT EXISTS idx_editals_created_at ON editals(created_at);
CREATE INDEX IF NOT EXISTS idx_exam_blueprints_created_at ON exam_blueprints(created_at);
CREATE INDEX IF NOT EXISTS idx_exam_logs_created_at ON exam_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_institutions_created_at ON institutions(created_at);
CREATE INDEX IF NOT EXISTS idx_institutions_updated_at ON institutions(updated_at);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_created_at ON metrics_daily(created_at);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_updated_at ON metrics_daily(updated_at);
CREATE INDEX IF NOT EXISTS idx_qa_reviews_created_at ON qa_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_study_plan_items_created_at ON study_plan_items(created_at);
CREATE INDEX IF NOT EXISTS idx_study_plan_items_updated_at ON study_plan_items(updated_at);
CREATE INDEX IF NOT EXISTS idx_study_plans_created_at ON study_plans(created_at);
CREATE INDEX IF NOT EXISTS idx_study_plans_updated_at ON study_plans(updated_at);
CREATE INDEX IF NOT EXISTS idx_subjects_created_at ON subjects(created_at);
CREATE INDEX IF NOT EXISTS idx_subtopics_created_at ON subtopics(created_at);
CREATE INDEX IF NOT EXISTS idx_topic_prereqs_created_at ON topic_prereqs(created_at);
CREATE INDEX IF NOT EXISTS idx_topic_priorities_created_at ON topic_priorities(created_at);
CREATE INDEX IF NOT EXISTS idx_topic_priorities_updated_at ON topic_priorities(updated_at);
CREATE INDEX IF NOT EXISTS idx_topics_created_at ON topics(created_at);
CREATE INDEX IF NOT EXISTS idx_user_progress_created_at ON user_progress(created_at);
CREATE INDEX IF NOT EXISTS idx_user_progress_updated_at ON user_progress(updated_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

-- Índices compostos para queries comuns
CREATE INDEX IF NOT EXISTS idx_harvest_items_source_status ON harvest_items(source, status);
CREATE INDEX IF NOT EXISTS idx_editals_contest_created ON editals(contest_id, created_at);
CREATE INDEX IF NOT EXISTS idx_drops_subject_created ON drops(subject_id, created_at);
CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, created_at);

-- Comentário final
COMMENT ON INDEX idx_daily_plans_user_id IS 'Performance: Acelera queries de planos por usuário';
COMMENT ON INDEX idx_harvest_items_source_status IS 'Performance: Acelera queries de coleta por fonte e status';
