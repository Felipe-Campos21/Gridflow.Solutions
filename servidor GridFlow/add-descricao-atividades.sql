-- Adiciona coluna descricao na tabela atividades
-- Execute em: Supabase > SQL Editor > New Query

ALTER TABLE atividades ADD COLUMN IF NOT EXISTS descricao TEXT;
