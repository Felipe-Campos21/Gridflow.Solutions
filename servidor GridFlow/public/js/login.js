// Redireciona se já há usuário salvo
const saved = localStorage.getItem('gridflow_user');
if (saved) {
  window.location.replace('index.html');
}

const API = CONFIG.API_URL;
let _colaboradores = [];

async function fetchColaboradores() {
  try {
    const r = await fetch(API + '/api/colaboradores');
    _colaboradores = (await r.json()).filter(c => c.ativo);
  } catch { _colaboradores = []; }
}

function renderDropdown(lista) {
  const drop = document.getElementById('login-dropdown');
  if (!lista.length) { drop.classList.remove('show'); return; }
  drop.innerHTML = lista.map(c => {
    const ini = c.nome.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    return `<div class="login-dropdown-item" data-id="${c.id}" data-nome="${c.nome}">
      <div class="login-drop-avatar">${ini}</div>
      <div class="login-drop-info">
        <span class="login-drop-nome">${c.nome}</span>
        <span class="login-drop-cargo">${c.funcao || 'Usuário'}</span>
      </div>
    </div>`;
  }).join('');
  drop.classList.add('show');

  drop.querySelectorAll('.login-dropdown-item').forEach(item => {
    item.addEventListener('click', () => fazerLogin(parseInt(item.dataset.id), item.dataset.nome));
  });
}

function fazerLogin(id, nome) {
  localStorage.setItem('gridflow_user', JSON.stringify({ id, nome }));
  window.location.replace('index.html');
}

function showError(msg, elId = 'login-error') {
  document.getElementById(elId).textContent = msg;
}
function clearError(elId = 'login-error') {
  document.getElementById(elId).textContent = '';
}

// ── Busca enquanto digita ────────────────────────────────────────────────────
const input = document.getElementById('login-input');
input.addEventListener('input', () => {
  clearError();
  const q = input.value.trim().toLowerCase();
  if (!q) { document.getElementById('login-dropdown').classList.remove('show'); return; }
  const found = _colaboradores.filter(c => c.nome.toLowerCase().includes(q));
  renderDropdown(found);
});

// ── Fechar dropdown ao clicar fora ──────────────────────────────────────────
document.addEventListener('click', e => {
  if (!e.target.closest('.login-input-wrap'))
    document.getElementById('login-dropdown').classList.remove('show');
});

// ── Botão Entrar ────────────────────────────────────────────────────────────
document.getElementById('btn-entrar').addEventListener('click', () => {
  clearError();
  const q = input.value.trim().toLowerCase();
  if (!q) { showError('Digite seu nome de usuário'); return; }
  const found = _colaboradores.filter(c => c.nome.toLowerCase().includes(q));
  if (found.length === 1) {
    fazerLogin(found[0].id, found[0].nome);
  } else if (found.length > 1) {
    renderDropdown(found);
    showError('Selecione um usuário da lista');
  } else {
    showError('Usuário não encontrado');
  }
});

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-entrar').click();
});

// ── Criar usuário ────────────────────────────────────────────────────────────
document.getElementById('btn-criar-toggle').addEventListener('click', () => {
  document.getElementById('form-login').style.display = 'none';
  document.getElementById('form-criar').style.display  = 'flex';
  document.getElementById('criar-nome').focus();
});

document.getElementById('btn-criar-cancelar').addEventListener('click', () => {
  document.getElementById('form-criar').style.display = 'none';
  document.getElementById('form-login').style.display = 'flex';
  document.getElementById('criar-error').textContent  = '';
});

document.getElementById('btn-criar-salvar').addEventListener('click', async () => {
  clearError('criar-error');
  const nome  = document.getElementById('criar-nome').value.trim();
  const cargo = document.getElementById('criar-cargo').value.trim();
  if (!nome) { showError('Informe o nome', 'criar-error'); return; }
  try {
    const r = await fetch(API + '/api/colaboradores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, funcao: cargo })
    });
    if (!r.ok) throw new Error();
    const col = await r.json();
    fazerLogin(col.id, col.nome);
  } catch {
    showError('Erro ao criar usuário', 'criar-error');
  }
});

// ── Iniciar ──────────────────────────────────────────────────────────────────
fetchColaboradores().then(() => {
  if (_colaboradores.length > 0) input.focus();
});
