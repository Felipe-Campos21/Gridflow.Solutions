-- Seed das atividades GridFlow
-- Execute no Supabase: Dashboard > SQL Editor > New Query
-- Substitua SEU_CONTA_ID pelo ID numérico da sua conta (tabela "contas")

DO $$
DECLARE
  cid INTEGER := SEU_CONTA_ID; -- ⚠️  troque pelo seu conta_id
BEGIN

INSERT INTO atividades (conta_id, nome, grupo, ativo) VALUES
  -- Conciliação
  (cid, 'Banco',                      'Conciliação',             1),
  (cid, 'Parcelamento',               'Conciliação',             1),
  (cid, 'Aluguel',                    'Conciliação',             1),
  (cid, 'Caixa',                      'Conciliação',             1),
  (cid, 'Empréstimo',                 'Conciliação',             1),
  (cid, 'Cartão Empresa',             'Conciliação',             1),
  (cid, 'Aplicações',                 'Conciliação',             1),
  (cid, 'Consórcio',                  'Conciliação',             1),
  -- Fiscal x Contabilidade
  (cid, 'Receitas',                   'Fiscal x Contabilidade',  1),
  (cid, 'Custos',                     'Fiscal x Contabilidade',  1),
  (cid, 'Contas de resultado',        'Fiscal x Contabilidade',  1),
  (cid, 'Fornecedores',               'Fiscal x Contabilidade',  1),
  (cid, 'Impostos',                   'Fiscal x Contabilidade',  1),
  -- Cálculos / Integralizações
  (cid, 'Folha',                      'Cálculos/ Integralizações', 1),
  (cid, 'Imobilizados',               'Cálculos/ Integralizações', 1),
  (cid, 'Estoque',                    'Cálculos/ Integralizações', 1),
  -- Receb. Documentos
  (cid, 'Contas a pagar',             'Receb. Documentos',       1),
  (cid, 'Extrato Bancario',           'Receb. Documentos',       1),
  (cid, 'Venda Maquininha de cartão', 'Receb. Documentos',       1),
  -- Relatórios
  (cid, 'ECF',                        'Relatórios',              1),
  (cid, 'ECD',                        'Relatórios',              1)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Atividades inseridas com sucesso para conta_id = %', cid;
END $$;
