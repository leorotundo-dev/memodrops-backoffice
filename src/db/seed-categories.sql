-- Seed initial categories
INSERT INTO categories (name, slug, icon, description, display_order, is_active) VALUES
('Concursos Públicos', 'concursos-publicos', '🎯', 'Concursos públicos federais, estaduais e municipais', 1, true),
('ENEM', 'enem', '📚', 'Exame Nacional do Ensino Médio', 2, true),
('Vestibulares', 'vestibulares', '🎓', 'Vestibulares de universidades públicas e privadas', 3, true),
('Escola/Faculdade', 'escola-faculdade', '📖', 'Conteúdo escolar e acadêmico', 4, true),
('Certificações', 'certificacoes', '💼', 'Certificações profissionais e técnicas', 5, true),
('Outros', 'outros', '🌍', 'Outros objetivos de estudo', 6, true)
ON CONFLICT (slug) DO NOTHING;
