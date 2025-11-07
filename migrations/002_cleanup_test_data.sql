-- Migração 002: Limpeza de dados de teste
-- Data: 07/11/2025
-- Descrição: Remove todos os dados de teste coletados anteriormente para começar com dados reais

-- Limpar tabela de itens coletados (harvest_items)
TRUNCATE TABLE harvest_items CASCADE;

-- Limpar tabela de contests (se existir)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contests') THEN
        TRUNCATE TABLE contests CASCADE;
    END IF;
END $$;

-- Limpar tabela de subjects (se existir)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subjects') THEN
        TRUNCATE TABLE subjects CASCADE;
    END IF;
END $$;

-- Limpar tabela de topics (se existir)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'topics') THEN
        TRUNCATE TABLE topics CASCADE;
    END IF;
END $$;

-- Limpar tabela de drops (se existir)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'drops') THEN
        TRUNCATE TABLE drops CASCADE;
    END IF;
END $$;

-- Limpar tabela de user_drops (se existir)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_drops') THEN
        TRUNCATE TABLE user_drops CASCADE;
    END IF;
END $$;

-- Resetar sequências (IDs)
DO $$ 
BEGIN
    -- Reset harvest_items ID
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'harvest_items_id_seq') THEN
        ALTER SEQUENCE harvest_items_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset contests ID
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'contests_id_seq') THEN
        ALTER SEQUENCE contests_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset subjects ID
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'subjects_id_seq') THEN
        ALTER SEQUENCE subjects_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset topics ID
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'topics_id_seq') THEN
        ALTER SEQUENCE topics_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset drops ID
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'drops_id_seq') THEN
        ALTER SEQUENCE drops_id_seq RESTART WITH 1;
    END IF;
END $$;

-- Log de limpeza
DO $$
BEGIN
    RAISE NOTICE '✅ Limpeza de dados de teste concluída!';
    RAISE NOTICE '📊 Todas as tabelas foram truncadas';
    RAISE NOTICE '🔢 Todas as sequências foram resetadas';
    RAISE NOTICE '🚀 Sistema pronto para coleta real de dados';
END $$;
