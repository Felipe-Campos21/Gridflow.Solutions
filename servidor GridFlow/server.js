// Servidor GridFlow v3 — Supabase Backend
// Sem dependencias externas alem do Node.js nativo
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT   = process.env.PORT || 5000;
const PUBLIC = path.join(__dirname, 'public');

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function sbFetch(endpoint, options) {
  options = options || {};
  return new Promise(function(resolve, reject) {
    const fullUrl  = SUPABASE_URL + '/rest/v1/' + endpoint;
    const parsed   = new URL(fullUrl);
    const isHttps  = parsed.protocol === 'https:';
    const lib      = isHttps ? https : http;
    const reqOpts  = {
      hostname : parsed.hostname,
      port     : parsed.port || (isHttps ? 443 : 80),
      path     : parsed.pathname + parsed.search,
      method   : options.method || 'GET',
      headers  : {
        'apikey'        : SUPABASE_KEY,
        'Authorization' : 'Bearer ' + SUPABASE_KEY,
        'Content-Type'  : 'application/json',
        'Prefer'        : options.prefer || 'return=representation'
      }
    };
    const req = lib.request(reqOpts, function(res) {
      let data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null }); }
        catch(e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js'  : 'application/javascript',
  '.css' : 'text/css',
  '.json': 'application/json',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.svg' : 'image/svg+xml',
  '.ico' : 'image/x-icon'
};

function send(res, status, data) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type'                 : 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin'  : '*',
    'Access-Control-Allow-Methods' : 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers' : 'Content-Type, Authorization'
  });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, function(err, data) {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise(function(resolve) {
    let body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try { resolve(JSON.parse(body)); }
      catch(e) { resolve({}); }
    });
  });
}

const server = http.createServer(async function(req, res) {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method   = req.method.toUpperCase();

  if (method === 'OPTIONS') { send(res, 204, {}); return; }

  // GET /api/health
  if (pathname === '/api/health' && method === 'GET') {
    send(res, 200, { ok: true, backend: 'supabase', ts: Date.now() });
    return;
  }

  // GET /api/empresas/todas
  if (pathname === '/api/empresas/todas' && method === 'GET') {
    const r = await sbFetch('empresas?select=*&order=nome.asc');
    send(res, 200, r.data || []);
    return;
  }

  // /api/empresas
  if (pathname === '/api/empresas') {
    if (method === 'GET') {
      const comMov = parsed.query.com_movimento;
      let q = 'empresas?select=*&order=nome.asc';
      if (comMov !== undefined) q += '&com_movimento=eq.' + comMov;
      const r = await sbFetch(q);
      send(res, 200, r.data || []);
      return;
    }
    if (method === 'POST') {
      const body = await readBody(req);
      const r = await sbFetch('empresas', { method: 'POST', body: body });
      send(res, 201, r.data);
      return;
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = await readBody(req);
      const id = body.id || parsed.query.id;
      const r = await sbFetch('empresas?id=eq.' + id, { method: 'PATCH', body: body });
      send(res, 200, r.data);
      return;
    }
    if (method === 'DELETE') {
      const id = parsed.query.id;
      await sbFetch('empresas?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
      send(res, 200, { ok: true });
      return;
    }
  }

  // /api/atividades
  if (pathname === '/api/atividades') {
    if (method === 'GET') {
      const empresaId = parsed.query.empresa_id;
      let q = 'atividades?select=*&order=nome.asc';
      if (empresaId) {
        const ea = await sbFetch('empresa_atividades?select=atividade_id&empresa_id=eq.' + empresaId);
        const ids = (ea.data || []).map(function(x) { return x.atividade_id; });
        if (ids.length === 0) { send(res, 200, []); return; }
        q = 'atividades?select=*&id=in.(' + ids.join(',') + ')&order=nome.asc';
      }
      const r = await sbFetch(q);
      send(res, 200, r.data || []);
      return;
    }
    if (method === 'POST') {
      const body = await readBody(req);
      const r = await sbFetch('atividades', { method: 'POST', body: body });
      send(res, 201, r.data);
      return;
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = await readBody(req);
      const id = body.id || parsed.query.id;
      const r = await sbFetch('atividades?id=eq.' + id, { method: 'PATCH', body: body });
      send(res, 200, r.data);
      return;
    }
    if (method === 'DELETE') {
      const id = parsed.query.id;
      await sbFetch('empresa_atividades?atividade_id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
      await sbFetch('atividades?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
      send(res, 200, { ok: true });
      return;
    }
  }

  // GET /api/colaboradores/buscar
  if (pathname === '/api/colaboradores/buscar' && method === 'GET') {
    const q = (parsed.query.q || '').toLowerCase();
    const r = await sbFetch('colaboradores?select=*&nome=ilike.*' + encodeURIComponent(q) + '*&order=nome.asc');
    send(res, 200, r.data || []);
    return;
  }

  // /api/colaboradores
  if (pathname === '/api/colaboradores') {
    if (method === 'GET') {
      const r = await sbFetch('colaboradores?select=*&order=nome.asc');
      send(res, 200, r.data || []);
      return;
    }
    if (method === 'POST') {
      const body = await readBody(req);
      const r = await sbFetch('colaboradores', { method: 'POST', body: body });
      send(res, 201, r.data);
      return;
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = await readBody(req);
      const id = body.id || parsed.query.id;
      const r = await sbFetch('colaboradores?id=eq.' + id, { method: 'PATCH', body: body });
      send(res, 200, r.data);
      return;
    }
    if (method === 'DELETE') {
      const id = parsed.query.id;
      await sbFetch('colaborador_empresas?colaborador_id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
      await sbFetch('colaboradores?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
      send(res, 200, { ok: true });
      return;
    }
  }

  // /api/notas
  if (pathname === '/api/notas') {
    if (method === 'GET') {
      const empresaId = parsed.query.empresa_id;
      let q = 'notas?select=*&order=criado_em.desc';
      if (empresaId) q += '&empresa_id=eq.' + empresaId;
      const r = await sbFetch(q);
      send(res, 200, r.data || []);
      return;
    }
    if (method === 'POST') {
      const body = await readBody(req);
      body.criado_em = body.criado_em || new Date().toISOString();
      const r = await sbFetch('notas', { method: 'POST', body: body });
      send(res, 201, r.data);
      return;
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = await readBody(req);
      const id = body.id || parsed.query.id;
      const r = await sbFetch('notas?id=eq.' + id, { method: 'PATCH', body: body });
      send(res, 200, r.data);
      return;
    }
    if (method === 'DELETE') {
      const id = parsed.query.id;
      await sbFetch('notas?id=eq.' + id, { method: 'DELETE', prefer: 'return=minimal' });
      send(res, 200, { ok: true });
      return;
    }
  }

  // /api/historico
  if (pathname === '/api/historico') {
    if (method === 'GET') {
      const empresaId = parsed.query.empresa_id;
      let q = 'historico?select=*&order=criado_em.desc&limit=200';
      if (empresaId) q += '&empresa_id=eq.' + empresaId;
      const r = await sbFetch(q);
      send(res, 200, r.data || []);
      return;
    }
    if (method === 'POST') {
      const body = await readBody(req);
      body.criado_em = body.criado_em || new Date().toISOString();
      const r = await sbFetch('historico', { method: 'POST', body: body });
      send(res, 201, r.data);
      return;
    }
  }

  // DELETE /api/historico/reset
  if (pathname === '/api/historico/reset' && method === 'DELETE') {
    const empresaId = parsed.query.empresa_id;
    let q = 'historico?id=gt.0';
    if (empresaId) q = 'historico?empresa_id=eq.' + empresaId;
    await sbFetch(q, { method: 'DELETE', prefer: 'return=minimal' });
    send(res, 200, { ok: true });
    return;
  }

  // GET /api/status
  if (pathname === '/api/status' && method === 'GET') {
    const empresaId = parsed.query.empresa_id;
    if (!empresaId) { send(res, 400, { error: 'empresa_id required' }); return; }
    const results = await Promise.all([
      sbFetch('empresa_atividades?select=*&empresa_id=eq.' + empresaId),
      sbFetch('historico?select=*&empresa_id=eq.' + empresaId + '&order=criado_em.desc&limit=100')
    ]);
    send(res, 200, { atividades: results[0].data || [], historico: results[1].data || [] });
    return;
  }

  // GET /api/status/geral
  if (pathname === '/api/status/geral' && method === 'GET') {
    const results = await Promise.all([
      sbFetch('empresas?select=id,nome,com_movimento&order=nome.asc'),
      sbFetch('historico?select=empresa_id,criado_em&order=criado_em.desc&limit=1000')
    ]);
    send(res, 200, { empresas: results[0].data || [], historico: results[1].data || [] });
    return;
  }

  // /api/config
  if (pathname === '/api/config') {
    if (method === 'GET') {
      const r = await sbFetch('configuracao?select=*&limit=1');
      send(res, 200, (r.data && r.data[0]) || {});
      return;
    }
    if (method === 'PUT' || method === 'PATCH') {
      const body = await readBody(req);
      body.id = body.id || 1;
      const r = await sbFetch('configuracao?id=eq.' + body.id, { method: 'PATCH', body: body });
      send(res, 200, r.data);
      return;
    }
  }

  // GET /api/periodos
  if (pathname === '/api/periodos' && method === 'GET') {
    const year   = new Date().getFullYear();
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const periodos = months.map(function(m, i) {
      return { id: i + 1, nome: m + '/' + year, mes: i + 1, ano: year };
    });
    send(res, 200, periodos);
    return;
  }

  // GET /api/backup
  if (pathname === '/api/backup' && method === 'GET') {
    const tables = ['empresas','atividades','empresa_atividades','colaboradores','colaborador_empresas','notas','historico','configuracao'];
    const results = await Promise.all(tables.map(function(t) { return sbFetch(t + '?select=*'); }));
    const backup = { exportado_em: new Date().toISOString(), versao: '3.0' };
    tables.forEach(function(t, i) { backup[t] = results[i].data || []; });
    res.writeHead(200, {
      'Content-Type'        : 'application/json; charset=utf-8',
      'Content-Disposition' : 'attachment; filename="gridflow-backup-' + new Date().toISOString().split('T')[0] + '.json"',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(backup, null, 2));
    return;
  }

  // POST /api/backup/restaurar — desabilitado
  if (pathname === '/api/backup/restaurar' && method === 'POST') {
    send(res, 403, { error: 'Restauracao desabilitada. Use o painel do Supabase.' });
    return;
  }

  // Static files
  if (!pathname.startsWith('/api')) {
    const filePath = path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(filePath)) {
      sendFile(res, filePath);
    } else {
      sendFile(res, path.join(PUBLIC, 'index.html'));
    }
    return;
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, function() {
  console.log('GridFlow servidor rodando na porta ' + PORT);
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('ATENCAO: SUPABASE_URL e SUPABASE_KEY nao configurados!');
  } else {
    console.log('Supabase: ' + SUPABASE_URL.substring(0, 40) + '...');
  }
});
