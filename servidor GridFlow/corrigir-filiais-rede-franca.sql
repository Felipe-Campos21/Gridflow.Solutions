-- Corrige o vínculo matriz→filiais da Rede Franca no Supabase
-- Execute em: Supabase > SQL Editor > New Query

DO $$
DECLARE
  mtz_id INTEGER;
  total  INTEGER;
BEGIN
  -- Encontra a matriz pelo CNPJ (0001 = matriz)
  SELECT id INTO mtz_id
  FROM empresas
  WHERE cnpj LIKE '29.897.237/0001%'
    AND ativo = 1
  LIMIT 1;

  IF mtz_id IS NULL THEN
    RAISE EXCEPTION 'Empresa matriz Rede Franca não encontrada. Verifique o CNPJ na tabela.';
  END IF;

  -- Atualiza todas as filiais (mesmo CNPJ raiz, exceto a matriz)
  UPDATE empresas
  SET matriz_id = mtz_id
  WHERE cnpj LIKE '29.897.237/%'
    AND cnpj NOT LIKE '29.897.237/0001%'
    AND ativo = 1;

  SELECT COUNT(*) INTO total FROM empresas WHERE matriz_id = mtz_id AND ativo = 1;

  RAISE NOTICE 'Matriz ID: % | Filiais vinculadas: %', mtz_id, total;
END $$;
