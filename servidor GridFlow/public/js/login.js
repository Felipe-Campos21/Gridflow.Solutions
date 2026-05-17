// Redireciona se já há usuário salvo
const saved = localStorage.getItem('gridflow_user');
if (saved) {
  window.location.replace('index.html');
}

const API = CONFIG.API_URL;

// Domínios genéricos (mesmo do backend)
const DOMINIOS_GENERICOS = new Set([
  'gmail.com','googlemail.com','hotmail.com','hotmail.com.br',
  'outlook.com','outlook.com.br','live.com','live.com.br',
  'yahoo.com','yahoo.com.br','icloud.com','me.com','mac.com',
  'uol.com.br','bol.com.br','terra.com.br','ig.com.br',
  'r7.com','oi.com.br','protonmail.com','proton.me',
  'yandex.com','aol.com','msn.com'
]);

// Classificar email (mesmo do backend)
function classificarEmail(email) {
  const dominio = (email.split('@')[1] || '').toLowerCase();
  const username = (email.split('@')[0] || '').toLowerCase();
  if (!dominio) return { tipo: null, dominio: null, empresa_id: null };

  if (!DOMINIOS_GENERICOS.has(dominio)) {
    // Dominio proprio → corporativo pelo dominio
    return { tipo: 'corporativo', dominio, empresa_id: null };
  }

  // Dominio generico (gmail etc.) — verificar padrao nome.empresa@gmail.com
  const dotIdx = username.lastIndexOf('.');
  if (dotIdx > 0) {
    const empresaId = username.substring(dotIdx + 1);
    if (empresaId.length >= 3) {
      return { tipo: 'corporativo_username', dominio, empresa_id: empresaId };
    }
  }

  return { tipo: 'pessoal', dominio, empresa_id: null };
}

// Extrair nome do usuário do email corporativo
function extrairNomeDoEmail(email) {
  const username = email.split('@')[0];
  // Substitui pontos por espaços e capitaliza
  return username.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function showError(msg, elId = 'login-error') {
  document.getElementById(elId).textContent = msg;
}
function clearError(elId = 'login-error') {
  document.getElementById(elId).textContent = '';
}

// ── Monitorar mudanças no email do formulário de criação ──────────────────────
document.getElementById('criar-email').addEventListener('change', () => {
  const email = document.getElementById('criar-email').value.trim();
  if (!email) return;
  
  const emailInfo = classificarEmail(email);
  const nomeField = document.getElementById('criar-nome');
  const empresaField = document.getElementById('criar-nome-empresa');
  const nomeLinha = nomeField.closest('.login-input-wrap');
  const empresaLinha = empresaField.closest('.login-input-wrap');
  
  if (emailInfo.tipo === 'corporativo' || emailInfo.tipo === 'corporativo_username') {
    // Corporativo: extrair automaticamente
    const nomePessoa = extrairNomeDoEmail(email);
    const nomeEmpresa = emailInfo.tipo === 'corporativo_username' 
      ? emailInfo.empresa_id 
      : emailInfo.dominio;
    
    nomeField.value = nomePessoa;
    empresaField.value = nomeEmpresa;
    
    // Desabilitar campos para não editar
    nomeField.disabled = true;
    empresaField.disabled = true;
    
    // Adicionar visual de "auto-preenchido"
    nomeLinha.style.opacity = '0.7';
    empresaLinha.style.opacity = '0.7';
    
    // Mostrar dica
    clearError('criar-error');
  } else {
    // Pessoal: permitir edição
    nomeField.value = '';
    empresaField.value = '';
    nomeField.disabled = false;
    empresaField.disabled = false;
    
    nomeLinha.style.opacity = '1';
    empresaLinha.style.opacity = '1';
  }
});

// ── Login com Email + Senha ────────────────────────────────────────────────────
document.getElementById('btn-entrar').addEventListener('click', async () => {
  clearError();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value.trim();
  
  if (!email) { showError('Informe seu email'); return; }
  if (!senha) { showError('Informe sua senha'); return; }
  
  try {
    const r = await fetch(API + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    
    if (!r.ok) {
      const err = await r.json();
      showError(err.erro || 'Erro ao fazer login');
      return;
    }
    
    const data = await r.json();
    if (data.ok && data.colaborador && data.conta) {
      // Salvar dados do usuário e conta
      localStorage.setItem('gridflow_user', JSON.stringify({
        id: data.colaborador.id,
        nome: data.colaborador.nome,
        email: data.colaborador.email,
        funcao: data.colaborador.funcao,
        admin: data.colaborador.admin,
        conta_id: data.conta.id,
        conta_tipo: data.conta.tipo,
        nome_empresa: data.conta.nome_empresa
      }));
      
      // Se é conta pessoal, salvar colaboradores da conta
      if (data.conta.tipo === 'pessoal' && data.colaboradores_conta) {
        localStorage.setItem('gridflow_colaboradores_conta', JSON.stringify(data.colaboradores_conta));
      }
      
      // Se é conta corporativa, salvar empresas e atividades
      if (data.conta.tipo === 'corporativo') {
        if (data.empresas) localStorage.setItem('gridflow_empresas', JSON.stringify(data.empresas));
        if (data.atividades) localStorage.setItem('gridflow_atividades', JSON.stringify(data.atividades));
        if (data.historico) localStorage.setItem('gridflow_historico', JSON.stringify(data.historico));
      }
      
      window.location.replace('index.html');
    }
  } catch {
    showError('Erro ao conectar ao servidor');
  }
});

document.getElementById('login-email').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-senha').focus();
});

document.getElementById('login-senha').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-entrar').click();
});

// ── Criar nova conta (Email + Senha + Nome + Nome Empresa) ────────────────────
document.getElementById('btn-criar-toggle').addEventListener('click', () => {
  document.getElementById('form-login').style.display = 'none';
  document.getElementById('form-criar').style.display = 'flex';
  document.getElementById('criar-email').focus();
});

document.getElementById('btn-criar-cancelar').addEventListener('click', () => {
  document.getElementById('form-criar').style.display = 'none';
  document.getElementById('form-login').style.display = 'flex';
  clearError('criar-error');
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
  
  // Resetar campos de criação
  document.getElementById('criar-email').value = '';
  document.getElementById('criar-senha').value = '';
  document.getElementById('criar-nome').value = '';
  document.getElementById('criar-nome-empresa').value = '';
  document.getElementById('criar-nome').disabled = false;
  document.getElementById('criar-nome-empresa').disabled = false;
  document.getElementById('criar-nome').closest('.login-input-wrap').style.opacity = '1';
  document.getElementById('criar-nome-empresa').closest('.login-input-wrap').style.opacity = '1';
});

document.getElementById('btn-criar-salvar').addEventListener('click', async () => {
  clearError('criar-error');
  const email = document.getElementById('criar-email').value.trim();
  const senha = document.getElementById('criar-senha').value.trim();
  const nome = document.getElementById('criar-nome').value.trim();
  const nome_empresa = document.getElementById('criar-nome-empresa').value.trim();
  
  if (!email) { showError('Informe seu email', 'criar-error'); return; }
  if (!senha) { showError('Informe uma senha', 'criar-error'); return; }
  if (senha.length < 6) { showError('Senha deve ter pelo menos 6 caracteres', 'criar-error'); return; }
  if (!nome) { showError('Informe seu nome', 'criar-error'); return; }
  if (!nome_empresa) { showError('Informe o nome da empresa', 'criar-error'); return; }
  
  try {
    const r = await fetch(API + '/api/auth/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha, nome, nome_empresa })
    });
    
    if (!r.ok) {
      const err = await r.json();
      showError(err.erro || 'Erro ao criar conta', 'criar-error');
      return;
    }
    
    const data = await r.json();
    if (data.ok && data.colaborador && data.conta_id) {
      // Mostrar mensagem de sucesso
      showError('Conta criada com sucesso! Fazendo login...', 'criar-error');
      
      // Chamar login automaticamente
      setTimeout(() => {
        document.getElementById('login-email').value = email;
        document.getElementById('login-senha').value = senha;
        document.getElementById('btn-entrar').click();
      }, 1000);
    }
  } catch {
    showError('Erro ao conectar ao servidor', 'criar-error');
  }
});

document.getElementById('criar-email').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('criar-senha').focus();
});

document.getElementById('criar-senha').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const emailInfo = classificarEmail(document.getElementById('criar-email').value.trim());
    if (emailInfo.tipo === 'corporativo' || emailInfo.tipo === 'corporativo_username') {
      // Corporativo: pular para criar
      document.getElementById('btn-criar-salvar').click();
    } else {
      // Pessoal: ir para nome
      document.getElementById('criar-nome').focus();
    }
  }
});

document.getElementById('criar-nome').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('criar-nome-empresa').focus();
});

document.getElementById('criar-nome-empresa').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-criar-salvar').click();
});
