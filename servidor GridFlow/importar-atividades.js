// Script de importação das atividades — rode UMA VEZ com o servidor ligado
// Configure CONTA_ID com o ID da sua conta no Supabase antes de rodar
const https = require('https');
const http  = require('http');

// ⚠️  Preencha com o ID da sua conta (veja em: Supabase > contas > id)
// Para usar contra o servidor local, deixe RENDER_URL vazio
const CONTA_ID  = process.env.CONTA_ID  || '';
const RENDER_URL = process.env.RENDER_URL || ''; // ex: 'meu-app.onrender.com'

const ATIVIDADES = [
  { nome: 'Banco',                      grupo: 'Conciliação' },
  { nome: 'Parcelamento',               grupo: 'Conciliação' },
  { nome: 'Aluguel',                    grupo: 'Conciliação' },
  { nome: 'Caixa',                      grupo: 'Conciliação' },
  { nome: 'Empréstimo',                 grupo: 'Conciliação' },
  { nome: 'Cartão Empresa',             grupo: 'Conciliação' },
  { nome: 'Aplicações',                 grupo: 'Conciliação' },
  { nome: 'Consórcio',                  grupo: 'Conciliação' },
  { nome: 'Receitas',                   grupo: 'Fiscal x Contabilidade' },
  { nome: 'Custos',                     grupo: 'Fiscal x Contabilidade' },
  { nome: 'Contas de resultado',        grupo: 'Fiscal x Contabilidade' },
  { nome: 'Fornecedores',               grupo: 'Fiscal x Contabilidade' },
  { nome: 'Impostos',                   grupo: 'Fiscal x Contabilidade' },
  { nome: 'Folha',                      grupo: 'Cálculos/ Integralizações' },
  { nome: 'Imobilizados',               grupo: 'Cálculos/ Integralizações' },
  { nome: 'Estoque',                    grupo: 'Cálculos/ Integralizações' },
  { nome: 'Contas a pagar',             grupo: 'Receb. Documentos' },
  { nome: 'Extrato Bancario',           grupo: 'Receb. Documentos' },
  { nome: 'Venda Maquininha de cartão', grupo: 'Receb. Documentos' },
  { nome: 'ECF',                        grupo: 'Relatórios' },
  { nome: 'ECD',                        grupo: 'Relatórios' },
];

function post(atividade) {
  return new Promise((resolve) => {
    const body = JSON.stringify(atividade);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (CONTA_ID) headers['X-Conta-ID'] = CONTA_ID;

    const opts = RENDER_URL
      ? { hostname: RENDER_URL, port: 443, path: '/api/atividades', method: 'POST', headers }
      : { hostname: 'localhost',  port: 5000, path: '/api/atividades', method: 'POST', headers };

    const lib = RENDER_URL ? https : http;
    const req = lib.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          resolve({ ok: res.statusCode === 201, status: res.statusCode, erro: r.erro || r.error || null });
        } catch { resolve({ ok: false, erro: 'Resposta inválida' }); }
      });
    });
    req.on('error', e => resolve({ ok: false, erro: e.message }));
    req.write(body); req.end();
  });
}

async function main() {
  console.log('\n========================================');
  console.log('  IMPORTAR ATIVIDADES - GRIDFLOW');
  console.log('========================================');
  if (CONTA_ID)  console.log('  Conta ID :', CONTA_ID);
  if (RENDER_URL) console.log('  Servidor :', RENDER_URL);
  else            console.log('  Servidor : localhost:5000');
  console.log('========================================\n');
  console.log(`Total: ${ATIVIDADES.length} atividades\n`);

  let ok = 0, erros = 0;

  for (let i = 0; i < ATIVIDADES.length; i++) {
    const a = ATIVIDADES[i];
    const r = await post(a);
    if (r.ok) {
      ok++;
      console.log(`✅ [${i+1}/${ATIVIDADES.length}] ${a.grupo} › ${a.nome}`);
    } else {
      erros++;
      console.log(`❌ [${i+1}/${ATIVIDADES.length}] ${a.grupo} › ${a.nome} — ${r.erro || r.status}`);
    }
  }

  console.log('\n========================================');
  console.log(`  ✅ Criadas: ${ok}`);
  console.log(`  ❌ Erros:   ${erros}`);
  console.log('========================================\n');
}

main();
