-- Permite agendar/enviar email sem escolher um template (escrita manual de assunto/mensagem)
-- Execute em: Supabase > SQL Editor > New Query

ALTER TABLE emails_agendados ALTER COLUMN template_id DROP NOT NULL;
