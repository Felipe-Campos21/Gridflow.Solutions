-- Adiciona coluna que faltava na tabela emails_agendados (bug pre-existente: o agendamento
-- de email nunca conseguia gravar, mas o erro era sempre engolido silenciosamente)
-- Execute em: Supabase > SQL Editor > New Query

ALTER TABLE emails_agendados ADD COLUMN IF NOT EXISTS variaveis_utilizadas JSONB DEFAULT '{}'::jsonb;
