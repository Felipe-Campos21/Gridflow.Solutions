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
// Clara IA — Gemini
// ------------------------------------------------------------------
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

const CLARA_SYSTEM = `Você é a Clara, assistente inteligente do GridFlow — sistema de gestão de atividades contábeis para escritórios de contabilidade.
Sua missão: ajudar usuários a usar o GridFlow, tirar dúvidas e orientar passo a passo com simpatia e clareza.
Responda SEMPRE em português brasileiro. Seja simpática, clara e objetiva.

REGRA IMPORTANTE: Responda SEMPRE em JSON válido com esta estrutura exata (sem texto fora do JSON):
{
  "resposta": "sua resposta aqui (pode usar quebras de linha com \\n)",
  "highlight": "#seletor-css (opcional — apenas quando quiser destacar um elemento na tela)",
  "tab": "nome-da-aba (opcional — apenas quando precisar levar o usuário para outra aba)"
}

ABAS DISPONÍVEIS (use no campo "tab"):
- dashboard → Checklist (aba principal)
- atividades → Gerenciador de Atividades
- configurar → Configurar atividades por empresa
- empresas → Cadastro de empresas
- colaboradores → Gerenciamento da equipe
- relatorio → Relatório de anotações
- status → Status Geral

SELETORES PARA HIGHLIGHT (use no campo "highlight"):
- Botão de período: #btn-periodo
- Aba Checklist: .nav-item[data-tab="dashboard"]
- Aba Atividades: .nav-item[data-tab="atividades"]
- Aba Configurar: .nav-item[data-tab="configurar"]
- Aba Empresas: .nav-item[data-tab="empresas"]
- Aba Colaboradores: .nav-item[data-tab="colaboradores"]
- Aba Relatório: .nav-item[data-tab="relatorio"]
- Aba Status: .nav-item[data-tab="status"]
- Avatar/troca de usuário: #user-switch
- Busca de empresas: #emp-search

FUNCIONALIDADES DO GRIDFLOW:

CHECKLIST (dashboard):
- Aba principal. Selecione o período clicando no botão 📅 no topo.
- Na lista à esquerda, selecione a empresa cliente para ver as atividades dela.
- Atividades são organizadas por grupos: Conciliação, Fiscal x Contabilidade, etc.
- Clique em qualquer atividade para abrir o modal e registrar o status (Feito, Pendente, Aguardando, Em Andamento, Não se Aplica).
- Pode adicionar uma observação/nota ao registrar.
- "Configurar grupos integrados": define quais grupos, ao registrar na matriz, são automaticamente replicados nas filiais.
- "Resetar": apaga todos os registros da empresa no período atual.
- Empresas com filiais: ao selecionar a matriz, as atividades de todos os grupos integrados são replicadas automaticamente.

ATIVIDADES (atividades):
- Lista todas as atividades disponíveis, organizadas por grupo.
- Botão "Nova Atividade" (canto superior direito) para criar novas atividades.
- Ícone lápis (✏️) para editar nome ou grupo de uma atividade.
- Atividades podem ser ativadas/desativadas.

CONFIGURAR (configurar):
- Selecione uma empresa para ver e configurar quais atividades ela deve realizar.
- Toggle on/off para cada atividade — atividades desligadas não aparecem no checklist daquela empresa.

EMPRESAS (empresas):
- Lista todas as empresas cadastradas.
- Busca por nome, CNPJ, código ou município.
- Botão "Nova Empresa" para cadastrar um novo cliente.
- Campos: Nome, Código, CNPJ, Município, Regime (Simples Nacional, Lucro Presumido, Lucro Real, MEI).
- Pode definir uma empresa como Matriz e vincular Filiais a ela.
- Pode marcar empresa como ativa ou inativa.

COLABORADORES (colaboradores):
- Lista todos os membros da equipe do escritório.
- Botão "Novo Colaborador" para cadastrar.
- Campos: Nome, Email, Senha, Perfil (Admin ou Colaborador).
- Admin: acesso total ao sistema, vê todas as empresas.
- Colaborador: vê apenas as empresas vinculadas a ele.
- Seção "Empresas Vinculadas": define quais empresas cada colaborador gerencia.
- Foto de perfil: no modal de edição, clique na área da foto para trocar.

RELATÓRIO (relatorio):
- Mostra todas as anotações registradas nos checklists.
- Exibe empresa, período, data e texto da anotação.
- Pode editar (✏️) ou excluir (🗑️) cada anotação.
- Campo de busca filtra por empresa ou texto.

STATUS GERAL (status):
- Visão geral de andamento de todas as empresas.
- Mostra atividades concluídas, pendentes ou não iniciadas.
- Filtre por colaborador ou regime tributário.

TROCA DE USUÁRIO:
- Clique no nome/avatar no canto inferior esquerdo da barra lateral.
- Escolha seu perfil na lista.
- Botão "Sair da conta" para logout.

PERÍODO:
- O período ativo aparece no botão 📅 no topo da tela.
- Clique no botão para abrir o seletor de período.
- Períodos são meses/anos (ex: Janeiro/2025).
- É possível criar novos períodos e gerenciar anos.`;

function geminiFetch(messages) {
    return new Promise((resolve, reject) => {
        if (!GEMINI_KEY) { resolve(null); return; }
        const body = JSON.stringify({
            systemInstruction: { parts: [{ text: CLARA_SYSTEM }] },
            contents: messages,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024, responseMimeType: 'application/json' }
        });
        const req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: '/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_KEY,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
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
                                                 : 'colaboradores?select=id,nome,funcao,foto,ativo,email,admin_conta&order=nome.asc';
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

                                   const colEmpresasMatch = pathname.match(/^\/api\/colaboradores\/(\d+)\/empresas$/);
    if (colEmpresasMatch) {
          const colId = colEmpresasMatch[1];
          if (method === 'GET') {
                  const ceR = await sbFetch('colaborador_empresas?colaborador_id=eq.' + colId + '&select=empresa_id');
                  const empIds = (ceR.body || []).map(ce => ce.empresa_id);
                  if (!empIds.length) return sendJson(res, 200, []);
                  const q = contaId
                        ? 'empresas?id=in.(' + empIds.join(',') + ')&conta_id=eq.' + contaId + '&ativo=eq.1&order=nome.asc&select=id,nome,codigo_interno,cnpj'
                        : 'empresas?id=in.(' + empIds.join(',') + ')&ativo=eq.1&order=nome.asc&select=id,nome,codigo_interno,cnpj';
                  const empR = await sbFetch(q);
                  return sendJson(res, 200, empR.body || []);
          }
          if (method === 'POST') {
                  const body = await readBody(req);
                  const { empresa_id } = body;
                  if (!empresa_id) return sendJson(res, 400, { erro: 'empresa_id obrigatório' });
                  const existing = await sbFetch('colaborador_empresas?colaborador_id=eq.' + colId + '&empresa_id=eq.' + empresa_id);
                  if (existing.body && existing.body.length > 0) return sendJson(res, 200, { ok: true });
                  await sbFetch('colaborador_empresas', { method: 'POST', body: { colaborador_id: parseInt(colId), empresa_id: parseInt(empresa_id) }, prefer: 'return=representation' });
                  return sendJson(res, 201, { ok: true });
          }
    }

    const colEmpresaItemMatch = pathname.match(/^\/api\/colaboradores\/(\d+)\/empresas\/(\d+)$/);
    if (colEmpresaItemMatch) {
          const colId = colEmpresaItemMatch[1];
          const empId = colEmpresaItemMatch[2];
          if (method === 'DELETE') {
                  await sbFetch('colaborador_empresas?colaborador_id=eq.' + colId + '&empresa_id=eq.' + empId, { method: 'DELETE' });
                  return sendJson(res, 200, { ok: true });
          }
    }

                                   const colaboradorMatch = pathname.match(/^\/api\/colaboradores\/(\d+)$/);
    if (colaboradorMatch) {
          const id = colaboradorMatch[1];
          if (method === 'GET') {
                  const r = await sbFetch('colaboradores?id=eq.' + id + '&select=id,nome,email,funcao,foto,admin_conta,conta_id,ativo');
                  if (!r.body || !r.body[0]) return sendJson(res, 404, { erro: 'Não encontrado' });
                  const col = r.body[0];
                  const ceR = await sbFetch('colaborador_empresas?colaborador_id=eq.' + id + '&select=empresa_id');
                  const empIds = (ceR.body || []).map(ce => ce.empresa_id);
                  let empresas = [];
                  if (empIds.length) {
                        const empR = await sbFetch('empresas?id=in.(' + empIds.join(',') + ')&ativo=eq.1&order=nome.asc');
                        empresas = empR.body || [];
                  }
                  return sendJson(res, 200, { ...col, admin: col.admin_conta, empresas });
          }
          if (method === 'PUT' || method === 'PATCH') {
                  const body = await readBody(req);
                  if (body.senha) { body.senha_hash = hashSenha(body.senha); delete body.senha; }
                  if (body.admin !== undefined && body.admin_conta === undefined) {
                        body.admin_conta = body.admin ? 1 : 0; delete body.admin;
                  }
                  const r = await sbFetch('colaboradores?id=eq.' + id, { method: 'PATCH', body, prefer: 'return=minimal' });
                  if (r.status >= 400) return sendJson(res, 400, { erro: (r.body && r.body.message) || 'Erro ao salvar colaborador' });
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
                                   if (pathname === '/api/empresas' && method === 'GET') {
                                         const search = parsed.query.search;
                                         let q = contaId ? 'empresas?conta_id=eq.' + contaId + '&ativo=eq.1' : 'empresas?ativo=eq.1';
                                         if (search) {
                                               const pat = encodeURIComponent('%' + search.trim() + '%');
                                               q += '&or=(nome.ilike.' + pat + ',cnpj.ilike.' + pat + ',codigo_interno.ilike.' + pat + ')&limit=20';
                                         }
                                         q += '&order=nome.asc';
                                         const r = await sbFetch(q);
                                         return sendJson(res, 200, r.body || []);
                                   }

                                   if (pathname === '/api/empresas/todas' && method === 'GET') {
                                         const q = contaId
                                           ? 'empresas?conta_id=eq.' + contaId + '&ativo=eq.1&order=nome.asc'
                                                 : 'empresas?ativo=eq.1&order=nome.asc';
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
          if (method === 'GET') {
                  const r = await sbFetch('empresas?id=eq.' + id + '&select=*');
                  if (!r.body || !r.body[0]) return sendJson(res, 404, { erro: 'Não encontrado' });
                  return sendJson(res, 200, r.body[0]);
          }
          if (method === 'PUT' || method === 'PATCH') {
                  const body = await readBody(req);
                  await sbFetch('empresas?id=eq.' + id, { method: 'PATCH', body });
                  return sendJson(res, 200, { ok: true });
          }
          if (method === 'DELETE') {
                  await sbFetch('empresas?id=eq.' + id, { method: 'PATCH', body: { ativo: 0 } });
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
                                   // EMPRESAS — rotas compostas
                                   // ================================================================
                                   const filiaisM = pathname.match(/^\/api\/empresas\/(\d+)\/filiais$/);
    if (filiaisM && method === 'GET') {
          const r = await sbFetch('empresas?matriz_id=eq.' + filiaisM[1] + '&ativo=eq.1&order=nome.asc');
          return sendJson(res, 200, r.body || []);
    }

                                   const empAtivListM = pathname.match(/^\/api\/empresas\/(\d+)\/atividades$/);
    if (empAtivListM) {
          const eId = empAtivListM[1];
          if (method === 'GET') {
                  const cidQ = contaId ? '&conta_id=eq.' + contaId : '';
                  const [ativsR, easR] = await Promise.all([
                        sbFetch('atividades?ativo=eq.1' + cidQ + '&order=grupo.asc,nome.asc'),
                        sbFetch('empresa_atividades?empresa_id=eq.' + eId)
                  ]);
                  const eaMap = {};
                  (easR.body || []).forEach(ea => { eaMap[ea.atividade_id] = ea.habilitada; });
                  const lista = (ativsR.body || []).map(a => ({
                        atividade_id: a.id, codigo: a.codigo || '', nome: a.nome,
                        descricao: a.descricao || '', grupo: a.grupo || 'Geral', ativo: a.ativo,
                        habilitada: eaMap[a.id] !== undefined ? eaMap[a.id] : 1
                  }));
                  return sendJson(res, 200, lista);
          }
    }

                                   const empAtivTogM = pathname.match(/^\/api\/empresas\/(\d+)\/atividades\/(\d+)$/);
    if (empAtivTogM && method === 'PUT') {
          const body = await readBody(req);
          const eId = parseInt(empAtivTogM[1]), aId = parseInt(empAtivTogM[2]);
          const hab = body.habilitada ? 1 : 0;
          await sbFetch('empresa_atividades?empresa_id=eq.' + eId + '&atividade_id=eq.' + aId,
                { method: 'PATCH', body: { habilitada: hab }, prefer: 'return=minimal' });
          const chk = await sbFetch('empresa_atividades?empresa_id=eq.' + eId + '&atividade_id=eq.' + aId + '&select=empresa_id');
          if (!chk.body || !chk.body[0]) {
                await sbFetch('empresa_atividades', { method: 'POST', body: { empresa_id: eId, atividade_id: aId, habilitada: hab }, prefer: 'return=minimal' });
          }
          return sendJson(res, 200, { ok: true });
    }

                                   const grpIntM = pathname.match(/^\/api\/empresas\/(\d+)\/grupos-integrados$/);
    if (grpIntM) {
          const empId = grpIntM[1];
          if (method === 'GET') {
                  const r = await sbFetch('config?id=eq.1&select=grupos_por_empresa');
                  const gpe = (r.body && r.body[0] && r.body[0].grupos_por_empresa) || {};
                  return sendJson(res, 200, gpe[empId] || []);
          }
          if (method === 'PUT') {
                  const body = await readBody(req);
                  const r = await sbFetch('config?id=eq.1&select=grupos_por_empresa');
                  const gpe = (r.body && r.body[0] && r.body[0].grupos_por_empresa) || {};
                  gpe[empId] = Array.isArray(body.grupos) ? body.grupos : [];
                  await sbFetch('config?id=eq.1', { method: 'PATCH', body: { grupos_por_empresa: gpe } });
                  return sendJson(res, 200, gpe[empId]);
          }
    }

                                   // ================================================================
                                   // HISTÓRICO — reset e delete individual
                                   // ================================================================
                                   if (pathname === '/api/historico/reset' && method === 'DELETE') {
                                         const body = await readBody(req);
                                         const empId = body.empresa_id, per = body.periodo || '';
                                         if (body.grupos && body.grupos.length) {
                                               const cidQ = contaId ? '&conta_id=eq.' + contaId : '';
                                               const ativsR = await sbFetch('atividades?grupo=in.(' + body.grupos.map(g => '"' + g + '"').join(',') + ')' + cidQ + '&select=id');
                                               const ids = (ativsR.body || []).map(a => a.id);
                                               if (ids.length) await sbFetch('historico?empresa_id=eq.' + empId + '&periodo=eq.' + encodeURIComponent(per) + '&atividade_id=in.(' + ids.join(',') + ')', { method: 'DELETE' });
                                         } else {
                                               await sbFetch('historico?empresa_id=eq.' + empId + '&periodo=eq.' + encodeURIComponent(per), { method: 'DELETE' });
                                         }
                                         return sendJson(res, 200, { ok: true });
                                   }

                                   const histDelM = pathname.match(/^\/api\/historico\/(\d+)$/);
    if (histDelM && method === 'DELETE') {
          await sbFetch('historico?id=eq.' + histDelM[1], { method: 'DELETE' });
          return sendJson(res, 200, { ok: true });
    }

                                   // ================================================================
                                   // PERÍODOS
                                   // ================================================================
                                   if (pathname === '/api/periodos' && method === 'GET') {
                                         const ano = new Date().getFullYear();
                                         const ps = [];
                                         for (let m = 12; m >= 1; m--) ps.push(String(m).padStart(2, '0') + '/' + ano);
                                         return sendJson(res, 200, ps);
                                   }

                                   // ================================================================
                                   // NOTAS
                                   // ================================================================
                                   if (pathname === '/api/notas') {
                                         const agora = () => { const d = new Date(); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
                                         if (method === 'GET') {
                                               if (parsed.query.empresa_id) {
                                                     const r = await sbFetch('notas?empresa_id=eq.' + parsed.query.empresa_id + '&periodo=eq.' + encodeURIComponent(parsed.query.periodo || ''));
                                                     return sendJson(res, 200, r.body || []);
                                               }
                                               const cidQ = contaId ? '&conta_id=eq.' + contaId : '';
                                               const r = await sbFetch('notas?select=*,empresas(nome)&texto=neq.' + encodeURIComponent('') + cidQ + '&order=atualizado_em.desc');
                                               const notas = (r.body || []).map(n => { const { empresas, ...rest } = n; return { ...rest, empresa_nome: empresas?.nome || null }; });
                                               return sendJson(res, 200, notas);
                                         }
                                         if (method === 'POST') {
                                               const body = await readBody(req);
                                               const eId = parseInt(body.empresa_id), per = body.periodo || '';
                                               const chk = await sbFetch('notas?empresa_id=eq.' + eId + '&periodo=eq.' + encodeURIComponent(per) + '&select=id');
                                               if (chk.body && chk.body[0]) {
                                                     await sbFetch('notas?id=eq.' + chk.body[0].id, { method: 'PATCH', body: { texto: body.texto || '', usuario: body.usuario || '', atualizado_em: agora() } });
                                               } else {
                                                     const nb = { empresa_id: eId, periodo: per, texto: body.texto || '', usuario: body.usuario || '', criado_em: agora() };
                                                     if (contaId) nb.conta_id = contaId;
                                                     await sbFetch('notas', { method: 'POST', body: nb, prefer: 'return=minimal' });
                                               }
                                               return sendJson(res, 200, { ok: true });
                                         }
                                         if (method === 'PUT') {
                                               const body = await readBody(req);
                                               const agr = agora();
                                               await sbFetch('notas?id=eq.' + parseInt(body.id), { method: 'PATCH', body: { texto: body.texto, usuario: body.usuario, atualizado_em: agr } });
                                               return sendJson(res, 200, { ok: true });
                                         }
                                         if (method === 'DELETE') {
                                               await sbFetch('notas?id=eq.' + parseInt(parsed.query.id), { method: 'DELETE' });
                                               return sendJson(res, 200, { ok: true });
                                         }
                                   }

                                   // ================================================================
                                   // CONFIG
                                   // ================================================================
                                   if (pathname === '/api/config') {
                                         if (method === 'GET') {
                                               const r = await sbFetch('config?id=eq.1&select=*');
                                               return sendJson(res, 200, (r.body && r.body[0]) || { grupos_integrados: [], grupos_por_empresa: {} });
                                         }
                                         if (method === 'PUT') {
                                               const body = await readBody(req);
                                               const updates = {};
                                               if (Array.isArray(body.grupos_integrados)) updates.grupos_integrados = body.grupos_integrados;
                                               await sbFetch('config?id=eq.1', { method: 'PATCH', body: updates });
                                               const r = await sbFetch('config?id=eq.1&select=*');
                                               return sendJson(res, 200, (r.body && r.body[0]) || {});
                                         }
                                   }

                                   // ================================================================
                                   // STATUS GERAL
                                   // ================================================================
                                   if (pathname === '/api/status/geral' && method === 'GET') {
                                         const periodo = parsed.query.periodo || '';
                                         const cidQ = contaId ? '&conta_id=eq.' + contaId : '';
                                         const [colsR, empR, ativsR, easR, histR, cesR] = await Promise.all([
                                               sbFetch('colaboradores?ativo=eq.1' + cidQ + '&select=id,nome,funcao,foto,admin_conta'),
                                               sbFetch('empresas?ativo=eq.1' + cidQ + '&select=*'),
                                               sbFetch('atividades?ativo=eq.1' + cidQ + '&select=*'),
                                               sbFetch('empresa_atividades?select=*'),
                                               sbFetch('historico?periodo=eq.' + encodeURIComponent(periodo) + (contaId ? '&conta_id=eq.' + contaId : '') + '&select=*'),
                                               sbFetch('colaborador_empresas?select=*')
                                         ]);
                                         const cols = colsR.body || [], emps = empR.body || [], ativs = ativsR.body || [];
                                         const eas = easR.body || [], hist = histR.body || [], ces = cesR.body || [];
                                         function calcEmpresas(empresas) {
                                               return empresas.map(emp => {
                                                     const eaMap = {};
                                                     eas.filter(ea => ea.empresa_id === emp.id).forEach(ea => { eaMap[ea.atividade_id] = ea.habilitada; });
                                                     const atvsHab = ativs.filter(a => eaMap[a.id] !== 0);
                                                     const eHist = hist.filter(h => h.empresa_id === emp.id);
                                                     const okIds = new Set(eHist.filter(h => h.status === 'OK').map(h => h.atividade_id));
                                                     const naIds = new Set(eHist.filter(h => h.status === 'Não Aplicável').map(h => h.atividade_id));
                                                     const total = atvsHab.length, concluidas = new Set([...okIds, ...naIds]).size;
                                                     const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
                                                     const pendentes_lista = atvsHab.filter(a => !okIds.has(a.id) && !naIds.has(a.id)).map(a => ({ id: a.id, nome: a.nome, grupo: a.grupo || 'Geral' }));
                                                     return { empresa: { id: emp.id, nome: emp.nome, codigo_interno: emp.codigo_interno || '', regime_tributario: emp.regime_tributario || '' }, total, ok: okIds.size, nao_aplicavel: naIds.size, concluidas, pct, pendentes: total - concluidas, pendentes_lista };
                                               });
                                         }
                                         const porColaborador = cols.map(col => {
                                               const empIds = ces.filter(ce => ce.colaborador_id === col.id).map(ce => ce.empresa_id);
                                               const colEmps = empIds.length ? emps.filter(e => empIds.includes(e.id)) : emps;
                                               const empDetalhe = calcEmpresas(colEmps).sort((a, b) => a.empresa.nome.localeCompare(b.empresa.nome));
                                               const totalAtv = empDetalhe.reduce((s, e) => s + e.total, 0);
                                               const concluidasT = empDetalhe.reduce((s, e) => s + e.concluidas, 0);
                                               const pct = totalAtv > 0 ? Math.round((concluidasT / totalAtv) * 100) : 0;
                                               return { colaborador: { id: col.id, nome: col.nome, funcao: col.funcao || '', admin: !!col.admin_conta, foto: col.foto || null }, empresas: empDetalhe, total_empresas: colEmps.length, total_atividades: totalAtv, concluidas: concluidasT, pct };
                                         }).filter(r => r.total_empresas > 0).sort((a, b) => b.pct - a.pct);
                                         const geralEmpresas = calcEmpresas(emps).sort((a, b) => a.empresa.nome.localeCompare(b.empresa.nome));
                                         return sendJson(res, 200, { colaboradores: porColaborador, geral: geralEmpresas });
                                   }

                                   if (pathname === '/api/status' && method === 'GET') {
                                         const nomeCol = parsed.query.colaborador, periodo = parsed.query.periodo || '';
                                         if (!nomeCol) return sendJson(res, 200, []);
                                         const cidQ = contaId ? '&conta_id=eq.' + contaId : '';
                                         const colR = await sbFetch('colaboradores?nome=ilike.' + encodeURIComponent(nomeCol.trim()) + cidQ + '&ativo=eq.1&select=id,nome&limit=1');
                                         if (!colR.body || !colR.body[0]) return sendJson(res, 200, []);
                                         const col = colR.body[0];
                                         const cesR = await sbFetch('colaborador_empresas?colaborador_id=eq.' + col.id + '&select=empresa_id');
                                         const empIds = (cesR.body || []).map(ce => ce.empresa_id);
                                         const empQ = empIds.length ? 'empresas?id=in.(' + empIds.join(',') + ')&ativo=eq.1&order=nome.asc' : ('empresas?ativo=eq.1' + cidQ + '&order=nome.asc');
                                         const [empR, ativsR, easR, histR] = await Promise.all([
                                               sbFetch(empQ),
                                               sbFetch('atividades?ativo=eq.1' + cidQ + '&select=*'),
                                               sbFetch('empresa_atividades?select=*'),
                                               sbFetch('historico?periodo=eq.' + encodeURIComponent(periodo) + (contaId ? '&conta_id=eq.' + contaId : '') + '&select=*')
                                         ]);
                                         const emps = empR.body || [], ativs = ativsR.body || [], eas = easR.body || [], hist = histR.body || [];
                                         const resultado = emps.map(emp => {
                                               const eaMap = {};
                                               eas.filter(ea => ea.empresa_id === emp.id).forEach(ea => { eaMap[ea.atividade_id] = ea.habilitada; });
                                               const atvsHab = ativs.filter(a => eaMap[a.id] !== 0);
                                               const eHist = hist.filter(h => h.empresa_id === emp.id);
                                               const okIds = new Set(eHist.filter(h => h.status === 'OK').map(h => h.atividade_id));
                                               const naIds = new Set(eHist.filter(h => h.status === 'Não Aplicável').map(h => h.atividade_id));
                                               const total = atvsHab.length, concluidas = new Set([...okIds, ...naIds]).size;
                                               const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
                                               const pendentes_lista = atvsHab.filter(a => !okIds.has(a.id) && !naIds.has(a.id)).map(a => ({ id: a.id, nome: a.nome, grupo: a.grupo || 'Geral' }));
                                               return { empresa: { id: emp.id, nome: emp.nome, codigo_interno: emp.codigo_interno || '' }, total, ok: okIds.size, nao_aplicavel: naIds.size, concluidas, pct, pendentes: total - concluidas, pendentes_lista };
                                         });
                                         return sendJson(res, 200, resultado.sort((a, b) => a.empresa.nome.localeCompare(b.empresa.nome)));
                                   }

                                   // ================================================================
                                   // CLARA IA
                                   // ================================================================
                                   if (pathname === '/api/clara' && method === 'POST') {
                                         if (!GEMINI_KEY) return sendJson(res, 503, { resposta: 'A chave da API Gemini não está configurada. Peça ao administrador para adicionar GEMINI_API_KEY nas variáveis de ambiente do Render.' });
                                         const body = await readBody(req);
                                         const messages = (body.messages || []).slice(-20).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
                                         if (!messages.length) return sendJson(res, 400, { resposta: 'Nenhuma mensagem enviada.' });
                                         try {
                                               const r = await geminiFetch(messages);
                                               const text = r?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                                               let parsed;
                                               try {
                                                     const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                                                     parsed = JSON.parse(cleaned);
                                               } catch { parsed = { resposta: text || 'Não consegui processar sua mensagem. Tente novamente.' }; }
                                               return sendJson(res, 200, parsed);
                                         } catch (e) { return sendJson(res, 500, { resposta: 'Erro ao contatar a IA. Tente novamente.' }); }
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
