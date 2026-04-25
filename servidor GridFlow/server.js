// Servidor Ambar v2 - Sem dependencias externas (so Node.js puro)
const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT    = process.env.PORT || 5000;
const DB_FILE = process.env.DB_PATH || path.join(__dirname, 'ambar-central.json');
const PUBLIC  = path.join(__dirname, 'public');

// ─── Tipos MIME para arquivos estáticos ───────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    const index = fs.readFileSync(path.join(PUBLIC, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(index);
  }
}

// ─── Banco JSON ───────────────────────────────────────────────────────────────

let DB = { empresas:[], atividades:[], empresa_atividades:[], historico:[], colaboradores:[], colaborador_empresas:[], notas:[], config:{ grupos_integrados:[] }, seq:{} };

function carregar() {
  if (!fs.existsSync(DB_FILE)) return;
  try { Object.assign(DB, JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch(e) { console.error('Erro ao ler banco:', e.message); }
  ['empresas','atividades','empresa_atividades','historico','colaboradores','colaborador_empresas','notas'].forEach(t => { if (!Array.isArray(DB[t])) DB[t] = []; });
  if (!DB.seq) DB.seq = {};
  if (!DB.config) DB.config = { grupos_integrados: [] };
  if (!DB.config.grupos_integrados) DB.config.grupos_integrados = [];
  if (!DB.config.periodos) {
    const ps = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      ps.push(String(dt.getMonth()+1).padStart(2,'0') + '/' + dt.getFullYear());
    }
    DB.config.periodos = ps;
  }
}

function salvar() { fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2)); }

function novoId(t) { DB.seq[t] = (DB.seq[t] || 0) + 1; return DB.seq[t]; }

function agora() {
  const d = new Date();
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}

carregar();
console.log('✅ Banco de dados carregado');

// ─── Dados Iniciais ───────────────────────────────────────────────────────────

function popularDados() {
  if (DB.empresas.length) return;
  console.log('📦 Populando dados iniciais...');
  const empresas = [
    { nome:'BRAVO DISTRIBUIDORA LTDA', cnpj:'12.345.678/0001-90', codigo_interno:'BRV001' },
    { nome:'TOPSPIN COMERCIAL ME',     cnpj:'23.456.789/0001-01', codigo_interno:'TOP001' },
    { nome:'ALFA SERVIÇOS EIRELI',     cnpj:'34.567.890/0001-12', codigo_interno:'ALF001' },
    { nome:'BETA TECNOLOGIA SA',       cnpj:'45.678.901/0001-23', codigo_interno:'BET001' },
    { nome:'GAMA LOGÍSTICA LTDA',      cnpj:'56.789.012/0001-34', codigo_interno:'GAM001' },
  ];
  const atividades = [
    { codigo:'ALU001', nome:'Aluguel',              descricao:'Pagamento de aluguel',         grupo:'Fixo'           },
    { codigo:'AGU001', nome:'Água',                 descricao:'Conta de água e saneamento',   grupo:'Utilidades'     },
    { codigo:'ENE001', nome:'Energia Elétrica',     descricao:'Conta de energia elétrica',    grupo:'Utilidades'     },
    { codigo:'TEL001', nome:'Telefone',             descricao:'Conta de telefone fixo',       grupo:'Comunicação'    },
    { codigo:'INT001', nome:'Internet',             descricao:'Mensalidade de internet',      grupo:'Comunicação'    },
    { codigo:'FOL001', nome:'Folha de Pagamento',   descricao:'Processamento da folha',       grupo:'RH'             },
    { codigo:'IMP001', nome:'Impostos',             descricao:'Impostos e tributos',          grupo:'Fiscal'         },
    { codigo:'CON001', nome:'Contabilidade',        descricao:'Honorários contábeis',         grupo:'Administrativo' },
    { codigo:'SEG001', nome:'Seguro',               descricao:'Apólice de seguro',            grupo:'Administrativo' },
    { codigo:'MAT001', nome:'Material de Escritório', descricao:'Compra de materiais',        grupo:'Administrativo' },
  ];
  for (const e of empresas)   DB.empresas.push({ id: novoId('empresas'),   ativo:1, ...e });
  for (const a of atividades) DB.atividades.push({ id: novoId('atividades'), ativo:1, ...a });
  for (const e of DB.empresas)
    for (const a of DB.atividades)
      DB.empresa_atividades.push({ empresa_id: e.id, atividade_id: a.id, habilitada: 1 });
  salvar();
  console.log('✅ Dados iniciais populados');
}

function popularColaboradores() {
  if (DB.colaboradores.length) return;
  DB.colaboradores.push({ id: novoId('colaboradores'), nome:'Felipe Campos', funcao:'Administrador', admin:1, ativo:1 });
  DB.colaboradores.push({ id: novoId('colaboradores'), nome:'Milena',        funcao:'Administrador', admin:1, ativo:1 });
  salvar();
  console.log('✅ Colaboradores iniciais criados');
}

popularDados();
popularColaboradores();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEA(eId, aId) { return DB.empresa_atividades.find(x => x.empresa_id===eId && x.atividade_id===aId); }
function setEA(eId, aId, hab) {
  const ea = getEA(eId, aId);
  if (ea) ea.habilitada = hab; else DB.empresa_atividades.push({ empresa_id:eId, atividade_id:aId, habilitada:hab });
  salvar();
}

function enrichHistorico(h) {
  const e = DB.empresas.find(x => x.id===h.empresa_id) || {};
  const a = DB.atividades.find(x => x.id===h.atividade_id) || {};
  return { ...h, empresa_nome:e.nome||'', codigo_interno:e.codigo_interno||'', atividade_nome:a.nome||'', atividade_codigo:a.codigo||'' };
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

function json(res, data, status=200) {
  res.writeHead(status, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}

function match(pattern, pathname) {
  const pp = pattern.split('/'), rp = pathname.split('/');
  if (pp.length !== rp.length) return null;
  const params = {};
  for (let i=0; i<pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = rp[i];
    else if (pp[i] !== rp[i]) return null;
  }
  return params;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { json(res, {}); return; }

  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/\/$/, '') || '/';
  const query    = parsed.query;
  const method   = req.method;
  let params, body;

  // ── Health ────────────────────────────────────────────────────────────────
  if (method==='GET' && pathname==='/api/health') {
    return json(res, { status:'ok', timestamp: new Date().toISOString() });
  }

  // ── Empresas ──────────────────────────────────────────────────────────────

  // Retorna TODAS as empresas sem limite (para o gerenciador)
  if (method==='GET' && pathname==='/api/empresas/todas') {
    const lista = DB.empresas.filter(e => e.ativo).sort((a,b)=>a.nome.localeCompare(b.nome));
    return json(res, lista);
  }

  if (method==='GET' && pathname==='/api/empresas') {
    let lista = DB.empresas.filter(e => e.ativo);
    if (query.search) {
      const q = query.search.toLowerCase();
      lista = lista.filter(e => e.nome.toLowerCase().includes(q) || (e.cnpj||'').includes(q) || (e.codigo_interno||'').toLowerCase().includes(q));
    }
    // Sem filtro de search: retorna todas (para busca por colaborador)
    const limite = query.search ? 20 : lista.length;
    return json(res, lista.sort((a,b)=>a.nome.localeCompare(b.nome)).slice(0, limite));
  }

  if (method==='POST' && pathname==='/api/empresas') {
    body = await readBody(req);
    if (!body.nome?.trim()) return json(res, { error:'Nome é obrigatório' }, 400);
    const nomeNorm = body.nome.trim().toUpperCase();
    if (DB.empresas.find(e => e.ativo && e.nome.toUpperCase() === nomeNorm)) {
      return json(res, { error:'Empresa já cadastrada' }, 400);
    }
    const empresa = {
      id: novoId('empresas'), ativo: 1,
      nome:               body.nome?.trim()               || '',
      codigo_interno:     (body.codigo_interno?.trim()    || '').toUpperCase(),
      cnpj:               body.cnpj?.trim()               || '',
      inscricao_estadual: body.inscricao_estadual?.trim() || '',
      regime_tributario:  body.regime_tributario?.trim()  || '',
      municipio:          body.municipio?.trim()          || '',
      segmento:           body.segmento?.trim()           || '',
      email:              body.email?.trim()              || '',
      com_movimento:      body.com_movimento ? 1 : 0,
      matriz_id:          body.matriz_id ? parseInt(body.matriz_id) : null,
    };
    DB.empresas.push(empresa);
    DB.atividades.filter(a=>a.ativo).forEach(a => { if (!getEA(empresa.id,a.id)) DB.empresa_atividades.push({ empresa_id:empresa.id, atividade_id:a.id, habilitada:1 }); });
    salvar();
    return json(res, empresa, 201);
  }

  if ((params = match('/api/empresas/:id', pathname))) {
    const id = parseInt(params.id);
    if (method==='GET') {
      const e = DB.empresas.find(x=>x.id===id);
      return e ? json(res, e) : json(res, { error:'Não encontrado' }, 404);
    }
    if (method==='PUT') {
      body = await readBody(req);
      const e = DB.empresas.find(x=>x.id===id);
      if (!e) return json(res, { error:'Não encontrado' }, 404);
      const campos = ['nome','codigo_interno','cnpj','inscricao_estadual','regime_tributario','municipio','segmento','email'];
      for (const c of campos) { if (body[c] !== undefined) e[c] = body[c].trim(); }
      if (e.codigo_interno) e.codigo_interno = e.codigo_interno.toUpperCase();
      if (body.com_movimento !== undefined) e.com_movimento = body.com_movimento ? 1 : 0;
      if (body.matriz_id !== undefined) e.matriz_id = body.matriz_id ? parseInt(body.matriz_id) : null;
      salvar(); return json(res, e);
    }
    if (method==='DELETE') {
      const e = DB.empresas.find(x=>x.id===id);
      if (!e) return json(res, { error:'Não encontrado' }, 404);
      e.ativo = 0; salvar(); return json(res, { success:true });
    }
  }

  // ── Filiais de uma Empresa ────────────────────────────────────────────────
  if ((params = match('/api/empresas/:id/filiais', pathname)) && method === 'GET') {
    const id = parseInt(params.id);
    const filiais = DB.empresas.filter(e => e.ativo && e.matriz_id === id)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return json(res, filiais);
  }

  // ── Atividades ────────────────────────────────────────────────────────────
  if (method==='GET' && pathname==='/api/atividades') {
    return json(res, [...DB.atividades].sort((a,b)=>a.grupo.localeCompare(b.grupo)||a.nome.localeCompare(b.nome)));
  }

  if (method==='POST' && pathname==='/api/atividades') {
    body = await readBody(req);
    if (!body.nome?.trim()) return json(res, { error:'Nome é obrigatório' }, 400);
    const atv = { id:novoId('atividades'), ativo:1, codigo:'', nome:body.nome.trim(), descricao:body.descricao?.trim()||'', grupo:body.grupo?.trim()||'Geral' };
    DB.atividades.push(atv);
    DB.empresas.filter(e=>e.ativo).forEach(e => { if (!getEA(e.id,atv.id)) DB.empresa_atividades.push({ empresa_id:e.id, atividade_id:atv.id, habilitada:1 }); });
    salvar();
    return json(res, atv, 201);
  }

  if ((params = match('/api/atividades/:id', pathname))) {
    const id = parseInt(params.id);
    if (method==='PUT') {
      body = await readBody(req);
      const atv = DB.atividades.find(a=>a.id===id);
      if (!atv) return json(res, { error:'Não encontrado' }, 404);
      if (body.nome!==undefined)      atv.nome      = body.nome.trim();
      if (body.descricao!==undefined) atv.descricao = body.descricao.trim();
      if (body.grupo!==undefined)     atv.grupo     = body.grupo.trim();
      if (body.ativo!==undefined)     atv.ativo     = body.ativo ? 1 : 0;
      salvar(); return json(res, atv);
    }
    if (method==='DELETE') {
      const atv = DB.atividades.find(a=>a.id===id);
      if (!atv) return json(res, { error:'Não encontrado' }, 404);
      atv.ativo = 0; salvar(); return json(res, { success:true });
    }
  }

  // ── Atividades por Empresa ────────────────────────────────────────────────
  if ((params = match('/api/empresas/:id/atividades', pathname))) {
    const eId = parseInt(params.id);
    if (method==='GET') {
      const lista = DB.atividades.filter(a=>a.ativo).map(a => {
        const ea = getEA(eId, a.id);
        return { atividade_id:a.id, codigo:a.codigo, nome:a.nome, descricao:a.descricao, grupo:a.grupo, ativo:a.ativo, habilitada:ea?ea.habilitada:1 };
      }).sort((a,b)=>a.grupo.localeCompare(b.grupo)||a.nome.localeCompare(b.nome));
      return json(res, lista);
    }
  }

  if ((params = match('/api/empresas/:id/atividades/:atId', pathname))) {
    if (method==='PUT') {
      body = await readBody(req);
      setEA(parseInt(params.id), parseInt(params.atId), body.habilitada ? 1 : 0);
      return json(res, { success:true });
    }
  }

  // ── Histórico ─────────────────────────────────────────────────────────────
  if (method==='GET' && pathname==='/api/historico') {
    let lista = [...DB.historico];
    if (query.empresa_id) lista = lista.filter(h=>h.empresa_id===parseInt(query.empresa_id));
    if (query.periodo)    lista = lista.filter(h=>h.periodo===query.periodo);
    lista.sort((a,b)=>b.id-a.id);
    lista = lista.slice(0, parseInt(query.limit)||200);
    return json(res, lista.map(enrichHistorico));
  }

  if (method==='POST' && pathname==='/api/historico') {
    body = await readBody(req);
    if (!body.empresa_id||!body.atividade_id||!body.usuario) return json(res, { error:'Campos obrigatórios faltando' }, 400);
    const h = { id:novoId('historico'), empresa_id:parseInt(body.empresa_id), atividade_id:parseInt(body.atividade_id), usuario:body.usuario, observacao:body.observacao||'', status:body.status||'OK', periodo:body.periodo||'', data:agora() };
    DB.historico.push(h); salvar();
    return json(res, enrichHistorico(h), 201);
  }

  { const m = pathname.match(/^\/api\/historico\/(\d+)$/);
    if (method==='DELETE' && m) {
      const idx = DB.historico.findIndex(h => h.id === parseInt(m[1]));
      if (idx === -1) return json(res, { error:'Não encontrado' }, 404);
      DB.historico.splice(idx, 1); salvar();
      return json(res, { ok: true });
    }
  }

  // ── Colaboradores ─────────────────────────────────────────────────────────
  if (method==='GET' && pathname==='/api/colaboradores/buscar') {
    const nome = query.nome;
    if (!nome) return json(res, { error:'Nome obrigatório' }, 400);
    const col = DB.colaboradores.find(c=>c.ativo && c.nome.trim().toLowerCase()===nome.trim().toLowerCase());
    if (!col) return json(res, null);
    const empIds = DB.colaborador_empresas.filter(ce=>ce.colaborador_id===col.id).map(ce=>ce.empresa_id);
    const empresas = DB.empresas.filter(e=>empIds.includes(e.id)).sort((a,b)=>a.nome.localeCompare(b.nome));
    return json(res, { ...col, empresas });
  }

  if (method==='GET' && pathname==='/api/colaboradores') {
    return json(res, [...DB.colaboradores].sort((a,b)=>b.admin-a.admin||a.nome.localeCompare(b.nome)));
  }

  if (method==='POST' && pathname==='/api/colaboradores') {
    body = await readBody(req);
    if (!body.nome?.trim()) return json(res, { error:'Nome obrigatório' }, 400);
    const col = { id:novoId('colaboradores'), ativo:1, nome:body.nome.trim(), funcao:body.funcao?.trim()||'', admin:body.admin?1:0, foto:body.foto||null };
    DB.colaboradores.push(col); salvar();
    return json(res, col, 201);
  }

  if ((params = match('/api/colaboradores/:id', pathname)) && !pathname.includes('/empresas')) {
    const id = parseInt(params.id);
    if (method==='GET') {
      const col = DB.colaboradores.find(c => c.id === id);
      if (!col) return json(res, { error:'Não encontrado' }, 404);
      const empIds = DB.colaborador_empresas.filter(ce => ce.colaborador_id === id).map(ce => ce.empresa_id);
      const empresas = DB.empresas.filter(e => empIds.includes(e.id) && e.ativo).sort((a,b)=>a.nome.localeCompare(b.nome));
      return json(res, { ...col, empresas });
    }
    if (method==='PUT') {
      body = await readBody(req);
      const col = DB.colaboradores.find(c=>c.id===id);
      if (!col) return json(res, { error:'Não encontrado' }, 404);
      if (body.nome!==undefined)   col.nome   = body.nome;
      if (body.funcao!==undefined) col.funcao = body.funcao;
      if (body.admin!==undefined)  col.admin  = body.admin?1:0;
      if (body.ativo!==undefined)  col.ativo  = body.ativo?1:0;
      if (body.foto!==undefined)   col.foto   = body.foto;
      salvar(); return json(res, col);
    }
    if (method==='DELETE') {
      const col = DB.colaboradores.find(c=>c.id===id);
      if (!col) return json(res, { error:'Não encontrado' }, 404);
      col.ativo = 0; salvar(); return json(res, { success:true });
    }
  }

  if ((params = match('/api/colaboradores/:id/empresas', pathname))) {
    const colId = parseInt(params.id);
    if (method==='GET') {
      const empIds = DB.colaborador_empresas.filter(ce=>ce.colaborador_id===colId).map(ce=>ce.empresa_id);
      return json(res, DB.empresas.filter(e=>empIds.includes(e.id)).sort((a,b)=>a.nome.localeCompare(b.nome)));
    }
    if (method==='POST') {
      body = await readBody(req);
      const empresaId = parseInt(body.empresa_id);
      if (!empresaId) return json(res, { error:'empresa_id obrigatório' }, 400);
      if (!DB.colaborador_empresas.find(ce=>ce.colaborador_id===colId&&ce.empresa_id===empresaId))
        DB.colaborador_empresas.push({ colaborador_id:colId, empresa_id:empresaId });
      salvar(); return json(res, { success:true }, 201);
    }
  }

  if ((params = match('/api/colaboradores/:id/empresas/:empresaId', pathname))) {
    if (method==='DELETE') {
      const colId = parseInt(params.id), empId = parseInt(params.empresaId);
      DB.colaborador_empresas = DB.colaborador_empresas.filter(ce=>!(ce.colaborador_id===colId&&ce.empresa_id===empId));
      salvar(); return json(res, { success:true });
    }
  }

  // ── Notas por Empresa/Período ─────────────────────────────────────────────
  if (pathname === '/api/notas') {
    if (method === 'GET') {
      const eId = parseInt(query.empresa_id);
      const per  = query.periodo || '';
      const nota = DB.notas.find(n => n.empresa_id === eId && n.periodo === per);
      return json(res, nota ? [nota] : []);
    }
    if (method === 'POST') {
      body = await readBody(req);
      const eId = parseInt(body.empresa_id);
      const per  = body.periodo || '';
      const existing = DB.notas.find(n => n.empresa_id === eId && n.periodo === per);
      if (existing) {
        existing.texto = body.texto || '';
        existing.usuario = body.usuario || '';
        existing.atualizado_em = agora();
      } else {
        DB.notas.push({ empresa_id: eId, periodo: per, texto: body.texto || '', usuario: body.usuario || '', criado_em: agora() });
      }
      salvar(); return json(res, { success: true });
    }
  }

  // ── Status por colaborador/período ────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/status') {
    const nomeCol = query.colaborador;
    const periodo = query.periodo || '';
    if (!nomeCol) return json(res, []);

    const col = DB.colaboradores.find(c => c.ativo && c.nome.trim().toLowerCase() === nomeCol.trim().toLowerCase());
    if (!col) return json(res, []);

    const empIds  = DB.colaborador_empresas.filter(ce => ce.colaborador_id === col.id).map(ce => ce.empresa_id);
    const empresas = DB.empresas.filter(e => empIds.includes(e.id) && e.ativo);

    const resultado = empresas.map(empresa => {
      const atvsHab = DB.atividades.filter(a => a.ativo).filter(a => {
        const ea = getEA(empresa.id, a.id);
        return ea ? ea.habilitada === 1 : true;
      });
      const hist = DB.historico.filter(h => h.empresa_id === empresa.id && h.periodo === periodo);
      const feitasIds   = new Set(hist.filter(h => h.status === 'OK').map(h => h.atividade_id));
      const naIds       = new Set(hist.filter(h => h.status === 'Não Aplicável').map(h => h.atividade_id));
      const todasIds    = new Set([...feitasIds, ...naIds]);
      const total       = atvsHab.length;
      const concluidas  = todasIds.size;
      const pct         = total > 0 ? Math.round((concluidas / total) * 100) : 0;
      const pendentes_lista = atvsHab
        .filter(a => !todasIds.has(a.id))
        .map(a => ({ id: a.id, nome: a.nome, grupo: a.grupo || 'Geral' }));
      return {
        empresa:  { id: empresa.id, nome: empresa.nome, codigo_interno: empresa.codigo_interno || '' },
        total, ok: feitasIds.size, nao_aplicavel: naIds.size, concluidas, pct,
        pendentes: total - concluidas,
        pendentes_lista,
      };
    });

    return json(res, resultado.sort((a, b) => a.empresa.nome.localeCompare(b.empresa.nome)));
  }

  // ── Status geral: todos os colaboradores + visão geral de empresas ──────────
  if (method === 'GET' && pathname === '/api/status/geral') {
    const periodo = query.periodo || '';

    // Função reutilizável: calcula progresso de uma lista de empresas
    function calcEmpresas(empresas) {
      return empresas.map(empresa => {
        const atvsHab = DB.atividades.filter(a => a.ativo).filter(a => {
          const ea = getEA(empresa.id, a.id);
          return ea ? ea.habilitada === 1 : true;
        });
        const hist      = DB.historico.filter(h => h.empresa_id === empresa.id && h.periodo === periodo);
        const feitasIds = new Set(hist.filter(h => h.status === 'OK').map(h => h.atividade_id));
        const naIds     = new Set(hist.filter(h => h.status === 'Não Aplicável').map(h => h.atividade_id));
        const todasIds  = new Set([...feitasIds, ...naIds]);
        const total     = atvsHab.length;
        const concluidas = todasIds.size;
        const pct       = total > 0 ? Math.round((concluidas / total) * 100) : 0;
        const pendentes_lista = atvsHab.filter(a => !todasIds.has(a.id)).map(a => ({ id: a.id, nome: a.nome, grupo: a.grupo || 'Geral' }));
        return { empresa: { id: empresa.id, nome: empresa.nome, codigo_interno: empresa.codigo_interno || '' }, total, ok: feitasIds.size, nao_aplicavel: naIds.size, concluidas, pct, pendentes: total - concluidas, pendentes_lista };
      });
    }

    // Bloco por colaborador
    const colaboradores = DB.colaboradores.filter(c => c.ativo);
    const porColaborador = colaboradores.map(col => {
      const empIds  = DB.colaborador_empresas.filter(ce => ce.colaborador_id === col.id).map(ce => ce.empresa_id);
      const empresas = DB.empresas.filter(e => empIds.includes(e.id) && e.ativo);
      const empDetalhe = calcEmpresas(empresas).sort((a, b) => a.empresa.nome.localeCompare(b.empresa.nome));
      const totalAtv    = empDetalhe.reduce((s, e) => s + e.total, 0);
      const concluidasT = empDetalhe.reduce((s, e) => s + e.concluidas, 0);
      const pct         = totalAtv > 0 ? Math.round((concluidasT / totalAtv) * 100) : 0;
      return { colaborador: { id: col.id, nome: col.nome, funcao: col.funcao || '', admin: !!col.admin, foto: col.foto || null }, empresas: empDetalhe, total_empresas: empresas.length, total_atividades: totalAtv, concluidas: concluidasT, pct };
    }).filter(r => r.total_empresas > 0).sort((a, b) => b.pct - a.pct);

    // Visão geral: todas as empresas ativas
    const todasEmpresas = DB.empresas.filter(e => e.ativo);
    const geralEmpresas = calcEmpresas(todasEmpresas).sort((a, b) => a.empresa.nome.localeCompare(b.empresa.nome));

    return json(res, { colaboradores: porColaborador, geral: geralEmpresas });
  }

  // ── Configurações globais ─────────────────────────────────────────────────
  if (pathname === '/api/config') {
    if (method === 'GET') return json(res, DB.config);
    if (method === 'PUT') {
      body = await readBody(req);
      if (Array.isArray(body.grupos_integrados)) DB.config.grupos_integrados = body.grupos_integrados;
      salvar(); return json(res, DB.config);
    }
  }

  // ── Períodos ──────────────────────────────────────────────────────────────
  if (pathname === '/api/periodos') {
    if (method === 'GET') {
      const ps = [...(DB.config.periodos || [])].sort((a, b) => {
        const [ma,ya] = a.split('/').map(Number);
        const [mb,yb] = b.split('/').map(Number);
        return (yb*100+mb) - (ya*100+ma);
      });
      return json(res, ps);
    }
    if (method === 'POST') {
      body = await readBody(req);
      const valor = (body.valor || '').trim();
      if (!/^\d{2}\/\d{4}$/.test(valor)) return json(res, { error:'Formato inválido. Use MM/AAAA' }, 400);
      if (!DB.config.periodos) DB.config.periodos = [];
      if (!DB.config.periodos.includes(valor)) { DB.config.periodos.push(valor); salvar(); }
      return json(res, { success:true });
    }
  }

  if ((params = match('/api/periodos/:valor', pathname)) && method === 'DELETE') {
    const valor = decodeURIComponent(params.valor);
    if (DB.config.periodos) { DB.config.periodos = DB.config.periodos.filter(p => p !== valor); salvar(); }
    return json(res, { success:true });
  }

  // Servir arquivos estáticos do frontend
  if (!pathname.startsWith('/api')) {
    const filePath = pathname === '/'
      ? path.join(PUBLIC, 'index.html')
      : path.join(PUBLIC, pathname);
    return serveStatic(res, filePath);
  }

  json(res, { error:'Rota não encontrada' }, 404);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n🚀 SERVIDOR CENTRALIZADO RODANDO');
  console.log('📍 Endereço: http://localhost:' + PORT);
  console.log('📡 API:      http://localhost:' + PORT + '/api');
  console.log('\nAguardando conexões dos apps desktop...\n');
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error('\n❌ Porta ' + PORT + ' já está em uso. Feche o outro servidor e tente novamente.');
  else console.error('\n❌ Erro:', e.message);
});
