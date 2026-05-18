// Servidor GridFlow v5 - Sistema de Autenticação Multi-Tenant
// Suporte: emails corporativos (dominio proprio), pseudo-corporativos (nome.empresa@gmail.com) e pessoais
// Sem dependencias externas alem do Node.js nativo
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 5000;
const PUBLIC = path.join(__dirname, 'public');

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// ------------------------------------------------------------------
// Helper: chamar Supabase REST API
// ------------------------------------------------------------------
function sbFetch(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
          const fullUrl = new URL(SUPABASE_URL + '/rest/v1/' + endpoint);
          const body = options.body ? JSON.stringify(options.body) : null;
          const req = https.request({
                  hostname: fullUrl.hostname,
                  path: fullUrl.pathname + (fullUrl.search || ''),
                  method: options.method || 'GET',
                  headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': 'Bearer ' + SUPABASE_KEY,
                            'Content-Type': 'application/json',
                            'Prefer': options.prefer || (options.method === 'POST' ? 'return=representation' : 'return=minimal'),
                            ...(options.headers || {})
                  }
          }, res => {
                  let data = '';
                  res.on('data', c => data += c);
                  res.on('end', () => {
                            try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
                            catch (e) { resolve({ status: res.statusCode, body: data }); }
                  });
          });
          req.on('error', reject);
          if (body) req.write(body);
          req.end();
    });
}

// ------------------------------------------------------------------
// Helper: hash de senha (SHA-256)
// ------------------------------------------------------------------
function hashSenha(senha) {
    return crypto.createHash('sha256').update(senha + 'gridflow_salt_2024').digest('hex');
}

// ------------------------------------------------------------------
// Dominios genericos (nao podem ser conta corporativa por dominio)
// ------------------------------------------------------------------
const DOMINIOS_GENERICOS = new Set([
    'gmail.com','googlemail.com','hotmail.com','hotmail.com.br',
    'outlook.com','outlook.com.br','live.com','live.com.br',
    'yahoo.com','yahoo.com.br','icloud.com','me.com','mac.com',
    'uol.com.br','bol.com.br','terra.com.br','ig.com.br',
    'r7.com','oi.com.br','protonmail.com','proton.me',
    'yandex.com','aol.com','msn.com'
  ]);

function classificarEmail(email) {
    const dominio = (email.split('@')[1] || '').toLowerCase();
    const username = (email.split('@')[0] || '').toLowerCase();
    if (!dominio) return { tipo: null, dominio: null, empresa_id: null };

  if (!DOMINIOS_GENERICOS.has(dominio)) {
        return { tipo: 'corporativo', dominio, empresa_id: null };
  }

  const dotIdx = username.lastIndexOf('.');
    if (dotIdx > 0) {
          const empresaId = username.substring(dotIdx + 1);
          if (empresaId.length >= 3) {
                  return { tipo: 'corporativo_username', dominio, empresa_id: empresaId, dominio_empresa: empresaId + '@' + dominio };
          }
    }

  return { tipo: 'pessoal', dominio, empresa_id: null };
}

// ------------------------------------------------------------------
// Helpers HTTP
// ------------------------------------------------------------------
function readBody(req) {
    return new Promise((resolve, reject) => {
          let data = '';
          req.on('data', c => data += c);
          req.on('end', () => {
                  try { resolve(JSON.parse(data || '{}')); }
                  catch { resolve({}); }
          });
          req.on('error', reject);
    });
}

function sendJson(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, X-Conta-ID, X-Colaborador-ID',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    });
    res.end(body);
}

function serveFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
          if (err) { res.writeHead(404); res.end('Not found'); return; }
          const ext = path.extname(filePath).toLowerCase();
          const types = {
                  '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
                  '.ico':'image/x-icon', '.svg':'image/svg+xml'
          };
          res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
          res.end(data);
    });
}

// ------------------------------------------------------------------
// Servidor principal
// ------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
          res.writeHead(204, {
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Headers': 'Content-Type, X-Conta-ID, X-Colaborador-ID',
                  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
          });
          res.end(); return;
    }

                                   const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const method = req.method;
    const contaId = req.headers['x-conta-id'] ? parseInt(req.headers['x-conta-id']) : null;

                                   // ================================================================
                                   // AUTH: Registrar nova conta
                                   // ================================================================
                                   if (pathname === '/api/auth/registrar' && method === 'POST') {
                                         const body = await readBody(req);
                                         const { email, senha, nome, nome_empresa } = body;

      if (!email || !senha || !nome || !nome_empresa)
              return sendJson(res, 400, { erro: 'Campos obrigatórios: email, senha, nome, nome_empresa' });
                                         if (senha.length < 6)
                                                 return sendJson(res, 400, { erro: 'Senha deve ter pelo menos 6 caracteres' });

      const emailLower = email.toLowerCase().trim();
                                         const email_info = classificarEmail(emailLower);
                                         const {tipo, dominio, empresa_id, dominio_empresa} = email_info;
                                         if (!tipo) return sendJson(res, 400, { erro: 'Email inválido' });

      const emailCheck = await sbFetch('colaboradores?email=eq.' + encodeURIComponent(emailLower) + '&select=id');
                                         if (emailCheck.body && emailCheck.body.length > 0)
                                                 return sendJson(res, 409, { erro: 'Este email já está cadastrado' });

      let contaIdNova;

      if (tipo === 'corporativo' || tipo === 'corporativo_username') {
              const chaveAgrupamento = tipo === 'corporativo_username' ? dominio_empresa : dominio;

                                           const dominioCheck = await sbFetch('contas?dominio=eq.' + encodeURIComponent(chaveAgrupamento) + '&select=id');
              if (dominioCheck.body && dominioCheck.body.length > 0) {
                        contaIdNova = dominioCheck.body[0].id;
              } else {
                        const nomeEmpresaFinal = (nome_empresa && nome_empresa.trim()) ? nome_empresa : (empresa_id || dominio);
                        const novaConta = await sbFetch('contas', {
                                    method:'POST',
                                    body:{ tipo:'corporativo', dominio:chaveAgrupamento, nome_empresa:nomeEmpresaFinal, plano:'gratuito' },
                                    prefer:'return=representation'
                        });
                        if (!novaConta.body || !novaConta.body[0])
                                    return sendJson(res, 500, { erro:'Erro ao criar conta corporativa' });
                        contaIdNova = novaConta.body[0].id;
              }
      } else {
              const novaConta = await sbFetch('contas', {
                        method:'POST',
                        body:{ tipo:'pessoal', email_dono:emailLower, nome_empresa, plano:'gratuito' },
                        prefer:'return=representation'
              });
              if (!novaConta.body || !novaConta.body[0])
                        return sendJson(res, 500, { erro:'Erro ao criar conta' });
              contaIdNova = novaConta.body[0].id;
      }

      const novoColab = await sbFetch('colaboradores', {
              method: 'POST',
              body: {
                        nome, email: emailLower,
                        senha_hash: hashSenha(senha),
                        conta_id: contaIdNova,
                        admin_conta: 1, ativo: 1,
                        funcao: 'Administrador'
              },
              prefer: 'return=representation'
      });

      if (!novoColab.body || !novoColab.body[0])
              return sendJson(res, 500, { erro: 'Erro ao criar colaborador' });

      const colab = novoColab.body[0];
                                         return sendJson(res, 201, {
                                                 ok: true,
                                                 mensagem: 'Conta criada com sucesso!',
                                                 tipo_conta: tipo,
                                                 conta_id: contaIdNova,
                                                 colaborador: { id: colab.id, nome: colab.nome, email: colab.email, admin: colab.admin_conta }
                                         });
                                   }

                                   // ================================================================
                                   // AUTH: Login
                                   // ================================================================
                                   if (pathname === '/api/auth/login' && method === 'POST') {
                                         const body = await readBody(req);
                                         const { email, senha } = body;

      if (!email || !senha)
              return sendJson(res, 400, { erro: 'Email e senha são obrigatórios' });

      const emailLower = email.toLowerCase().trim();
                                         const senhaHash = hashSenha(senha);

      const result = await sbFetch(
              'colaboradores?email=eq.' + encodeURIComponent(emailLower) +
              '&senha_hash=eq.' + encodeURIComponent(senhaHash) +
              '&ativo=eq.1&select=id,nome,email,funcao,foto,conta_id,admin_conta'
            );

      if (!result.body || result.body.length === 0)
              return sendJson(res, 401, { erro: 'Email ou senha inválidos' });

      const colab = result.body[0];
                                         const contaResult = await sbFetch('contas?id=eq.' + colab.conta_id + '&select=id,tipo,nome_empresa,plano,dominio');
                                         const conta = contaResult.body && contaResult.body[0];

      let empresas = [];
                                         let atividades = [];
                                         let historico = [];
                                         let colaboradoresDaConta = [];

      if (conta && conta.tipo === 'corporativo') {
              // Para conta corporativa, carrega empresas, atividades, histórico e colaboradores da mesma conta
                                           const empresasResult = await sbFetch('empresas?conta_id=eq.' + colab.conta_id + '&order=razao_social.asc&select=id,razao_social');
              empresas = empresasResult.body || [];

                                           const atividadesResult = await sbFetch('atividades?conta_id=eq.' + colab.conta_id + '&order=nome.asc&select=id,nome');
              atividades = atividadesResult.body || [];

                                           const historicoResult = await sbFetch('historico?conta_id=eq.' + colab.conta_id + '&order=data.desc&limit=50&select=id,data,evento');
              historico = historicoResult.body || [];

                                           const colabsResult = await sbFetch(
                                                     'colaboradores?conta_id=eq.' + colab.conta_id + '&ativo=eq.1&select=id,nome,email,funcao,foto,admin_conta'
                                                   );
              colaboradoresDaConta = colabsResult.body || [];
      } else if (conta && conta.tipo === 'pessoal') {
              // Para conta pessoal, lista colaboradores da mesma conta
                                           const colabsResult = await sbFetch(
                                                     'colaboradores?conta_id=eq.' + colab.conta_id + '&ativo=eq.1&select=id,nome,email,funcao,foto,admin_conta'
                                                   );
              colaboradoresDaConta = colabsResult.body || [];
      }

      return sendJson(res, 200, {
              ok: true,
              colaborador: {
                        id: colab.id, nome: colab.nome, email: colab.email,
                        funcao: colab.funcao, foto: colab.foto, admin: colab.admin_conta
              },
              conta: {
                        id: conta.id, tipo: conta.tipo, nome_empresa: conta.nome_empresa,
                        plano: conta.plano
              },
              empresas: empresas,
              atividades: atividades,
              historico: historico,
              colaboradores_conta: colaboradoresDaConta
      });
                                   }

                                   // ================================================================
                                   // AUTH: Selecionar perfil (conta pessoal)
                                   // ================================================================
                                   if (pathname === '/api/auth/selecionar-perfil' && method === 'POST') {
                                         const body = await readBody(req);
                                         const { conta_id, colaborador_id } = body;
                                         const result = await sbFetch(
                                                 'colaboradores?id=eq.' + colaborador_id + '&conta_id=eq.' + conta_id + '&ativo=eq.1&select=id,nome,funcao,foto,admin_conta'
                                               );
                                         if (!result.body || result.body.length === 0)
                                                 return sendJson(res, 404, { erro: 'Colaborador não encontrado' });
                                         return sendJson(res, 200, { ok: true, colaborador: result.body[0] });
                                   }

                                   // ================================================================
                                   // AUTH: Convidar colaborador para conta pessoal
                                   // ================================================================
                                   if (pathname === '/api/auth/convidar-colaborador' && method === 'POST') {
                                         const body = await readBody(req);
                                         const {email, nome, senha, funcao} = body;

      if (!email || !nome || !senha) return sendJson(res, 400, { erro:'email, nome e senha sao obrigatorios' });
                                         if (senha.length < 6) return sendJson(res, 400, { erro:'Senha deve ter pelo menos 6 caracteres' });

      if (!contaId) return sendJson(res, 400, { erro:'X-Conta-ID necessario' });
                                         const contaCheck = await sbFetch('contas?id=eq.' + contaId + "&tipo=eq.pessoal&select=id,email_dono,nome_empresa");
                                         if (!contaCheck.body || contaCheck.body.length === 0) return sendJson(res, 403, { erro:'Apenas contas pessoais podem convidar colaboradores por aqui' });

      const emailLower = email.toLowerCase().trim();
                                         const emailCheck = await sbFetch('colaboradores?email=eq.' + encodeURIComponent(emailLower) + '&conta_id=eq.' + contaId);
                                         if (emailCheck.body && emailCheck.body.length > 0) return sendJson(res, 409, { erro:'Este colaborador ja esta na sua conta' });

      const senhaHash = hashSenha(senha);
                                         const novoColab = await sbFetch('colaboradores', {
                                                 method:'POST',
                                                 body:{ nome, email:emailLower, senha_hash:senhaHash, conta_id:contaId, admin_conta:0, ativo:1, funcao:funcao||'Colaborador' },
                                                 prefer:'return=representation'
                                         });
                                         if (!novoColab.body || !novoColab.body[0]) return sendJson(res, 500, { erro:'Erro ao criar colaborador' });
                                         return sendJson(res, 201, { ok:true, colaborador:{ id:novoColab.body[0].id, nome, email:emailLower, funcao:funcao||'Colaborador' } });
                                   }

                                   // ================================================================
                                   // COLABORADORES
                                   // ================================================================
                                   if (pathname === '/api/colaboradores' && method === 'GET') {
                                         const q = contaId
                                           ? 'colaboradores?conta_id=eq.' + contaId + '&select=id,nome,funcao,foto,ativo,email,admin_conta&order=nome.asc'
                                                 : 'colaboradores?select=id,nome,funcao,foto,ativo&order=nome.asc';
                                         const r = await sbFetch(q);
                                         return sendJson(res, 200, r.body || []);
                                   }

                                   if (pathname === '/api/colaboradores' && method === 'POST') {
                                         const body = await readBody(req);
                                         if (contaId) body.conta_id = contaId;
                                         body.ativo = 1;
                                         if (body.senha) { body.senha_hash = hashSenha(body.senha); delete body.senha; }
                                         const r = await sbFetch('colaboradores', { method: 'POST', body, prefer: 'return=representation' });
                                         return sendJson(res, 201, r.body && r.body[0] ? r.body[0] : {});
                                   }

                                   const colaboradorMatch = pathname.match(/^\/api\/colaboradores\/(\d+)$/);
    if (colaboradorMatch) {
          const id = colaboradorMatch[1];
          if (method === 'PUT' || method === 'PATCH') {
                  const body = await readBody(req);
                  if (body.senha) { body.senha_hash = hashSenha(body.senha); delete body.senha; }
                  await sbFetch('colaboradores?id=eq.' + id, { method: 'PATCH', body });
                  return sendJson(res, 200, { ok: true });
          }
          if (method === 'DELETE') {
                  await sbFetch('colaboradores?id=eq.' + id, { method: 'PATCH', body: { ativo: 0 } });
                  return sendJson(res, 200, { ok: true });
          }
    }

                                   // ================================================================
                                   // EMPRESAS
                                   // ================================================================
                                   if (pathname === '/api/empresas/todas' && method === 'GET') {
                                         const q = contaId
                                           ? 'empresas?conta_id=eq.' + contaId + '&order=razao_social.asc'
                                                 : 'empresas?order=razao_social.asc';
                                         const r = await sbFetch(q);
                                         return sendJson(res, 200, r.body || []);
                                   }

                                   if (pathname === '/api/empresas' && method === 'POST') {
                                         const body = await readBody(req);
                                         if (contaId) body.conta_id = contaId;
                                         const r = await sbFetch('empresas', { method: 'POST', body, prefer: 'return=representation' });
                                         return sendJson(res, 201, r.body && r.body[0] ? r.body[0] : {});
                                   }

                                   const empresaMatch = pathname.match(/^\/api\/empresas\/(\d+)$/);
    if (empresaMatch) {
          const id = empresaMatch[1];
          if (method === 'PUT' || method === 'PATCH') {
                  const body = await readBody(req);
                  await sbFetch('empresas?id=eq.' + id, { method: 'PATCH', body });
                  return sendJson(res, 200, { ok: true });
          }
          if (method === 'DELETE') {
                  await sbFetch('empresas?id=eq.' + id, { method: 'DELETE' });
                  return sendJson(res, 200, { ok: true });
          }
    }

                                   // ================================================================
                                   // ATIVIDADES
                                   // ================================================================
                                   if (pathname === '/api/atividades' && method === 'GET') {
                                         const q = contaId
                                           ? 'atividades?conta_id=eq.' + contaId + '&order=nome.asc'
                                                 : 'atividades?order=nome.asc';
                                         const r = await sbFetch(q);
                                         return sendJson(res, 200, r.body || []);
                                   }

                                   if (pathname === '/api/atividades' && method === 'POST') {
                                         const body = await readBody(req);
                                         if (contaId) body.conta_id = contaId;
                                         const r = await sbFetch('atividades', { method: 'POST', body, prefer: 'return=representation' });
                                         return sendJson(res, 201, r.body && r.body[0] ? r.body[0] : {});
                                   }

                                   const atividadeMatch = pathname.match(/^\/api\/atividades\/(\d+)$/);
    if (atividadeMatch) {
          const id = atividadeMatch[1];
          if (method === 'PUT' || method === 'PATCH') {
                  const body = await readBody(req);
                  await sbFetch('atividades?id=eq.' + id, { method: 'PATCH', body });
                  return sendJson(res, 200, { ok: true });
          }
          if (method === 'DELETE') {
                  await sbFetch('atividades?id=eq.' + id, { method: 'DELETE' });
                  return sendJson(res, 200, { ok: true });
          }
    }

                                   // ================================================================
                                   // EMPRESA-ATIVIDADES (checklist)
                                   // ================================================================
                                   if (pathname === '/api/empresa-atividades' && method === 'GET') {
                                         const { empresa_id } = parsed.query;
                                         if (!empresa_id) return sendJson(res, 400, { erro: 'empresa_id obrigatorio' });
                                         const r = await sbFetch('empresa_atividades?empresa_id=eq.' + empresa_id + '&order=ano.desc,mes.desc');
                                         return sendJson(res, 200, r.body || []);
                                   }

                                   if (pathname === '/api/empresa-atividades' && method === 'POST') {
                                         const body = await readBody(req);
                                         const r = await sbFetch('empresa_atividades', { method: 'POST', body, prefer: 'return=representation' });
                                         return sendJson(res, 201, r.body && r.body[0] ? r.body[0] : {});
                                   }

                                   const empAtivMatch = pathname.match(/^\/api\/empresa-atividades\/(\d+)$/);
    if (empAtivMatch) {
          const id = empAtivMatch[1];
          if (method === 'PUT' || method === 'PATCH') {
                  const body = await readBody(req);
                  await sbFetch('empresa_atividades?id=eq.' + id, { method: 'PATCH', body });
                  return sendJson(res, 200, { ok: true });
          }
          if (method === 'DELETE') {
                  await sbFetch('empresa_atividades?id=eq.' + id, { method: 'DELETE' });
                  return sendJson(res, 200, { ok: true });
          }
    }

                                   // ================================================================
                                   // HISTÓRICO
                                   // ================================================================
                                   if (pathname === '/api/historico' && method === 'GET') {
                                         const { empresa_id } = parsed.query;
                                         const q = empresa_id
                                           ? 'historico?empresa_id=eq.' + empresa_id + '&order=data.desc&limit=100'
                                                 : (contaId ? 'historico?conta_id=eq.' + contaId + '&order=data.desc&limit=100' : 'historico?order=data.desc&limit=100');
                                         const r = await sbFetch(q);
                                         return sendJson(res, 200, r.body || []);
                                   }

                                   if (pathname === '/api/historico' && method === 'POST') {
                                         const body = await readBody(req);
                                         if (contaId) body.conta_id = contaId;
                                         const r = await sbFetch('historico', { method: 'POST', body, prefer: 'return=representation' });
                                         return sendJson(res, 201, r.body && r.body[0] ? r.body[0] : {});
                                   }

                                   // ================================================================
                                   // Arquivo estático / 404
                                   // ================================================================
                                   const arquivo = path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(arquivo)) return serveFile(res, arquivo);
    return sendJson(res, 404, { erro: 'Endpoint não encontrado' });
});

const PORT_FINAL = process.env.PORT || PORT;
server.listen(PORT_FINAL, () => {
    console.log(`✅ Servidor GridFlow rodando em porta ${PORT_FINAL}`);
});
