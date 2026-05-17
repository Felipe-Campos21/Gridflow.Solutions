// Redireciona se já há usuário salvo
const saved = localStorage.getItem('gridflow_user');
if (saved) {
  window.location.replace('index.html');
}

const API = CONFIG.API_URL;

function showError(msg, elId = 'login-error') {
  document.getElementById(elId).textContent = msg;
}
function clearError(elId = 'login-error') {
  document.getElementById(elId).textContent = '';
}

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
  if (e.key === 'Enter') document.getElementById('criar-nome').focus();
});

document.getElementById('criar-nome').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('criar-nome-empresa').focus();
});

document.getElementById('criar-nome-empresa').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-criar-salvar').click();
});
