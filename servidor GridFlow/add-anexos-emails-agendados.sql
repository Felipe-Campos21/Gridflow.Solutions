-- Adiciona coluna anexos na tabela emails_agendados (anexar PDFs, planilhas etc. aos emails)
-- Execute em: Supabase > SQL Editor > New Query

ALTER TABLE emails_agendados ADD COLUMN IF NOT EXISTS anexos JSONB DEFAULT '[]'::jsonb;
