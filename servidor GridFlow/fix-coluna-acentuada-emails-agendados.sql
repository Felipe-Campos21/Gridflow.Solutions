-- Corrige coluna antiga com nome acentuado ("variáveis_utilizadas") que ficou
-- obrigatoria (NOT NULL) sem nunca ser preenchida pelo codigo (que usa o nome
-- sem acento "variaveis_utilizadas") -- causa raiz de todo agendamento de email falhar.
-- Execute em: Supabase > SQL Editor > New Query

ALTER TABLE emails_agendados ALTER COLUMN "variáveis_utilizadas" DROP NOT NULL;
