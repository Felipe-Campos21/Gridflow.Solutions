-- Permite agendar/enviar email sem vincular a uma empresa (envio avulso/teste)
-- Execute em: Supabase > SQL Editor > New Query

ALTER TABLE emails_agendados ALTER COLUMN empresa_id DROP NOT NULL;
