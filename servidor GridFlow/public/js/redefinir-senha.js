// GridFlow — Redefinir senha (callback do link mágico do Supabase Auth)

const API = CONFIG.API_URL;
const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

function mostrarEstado(id) {
  ['form-carregando', 'form-nova-senha', 'form-sucesso', 'form-invalido'].forEach(f => {
    document.getElementById(f).style.display = (f === id) ? 'flex' : 'none';
  });
}

function temErroNoFragmento() {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  return params.has('error') || params.has('error_code');
}

if (temErroNoFragmento()) {
  mostrarEstado('form-invalido');
} else {
  let resolvido = false;

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      resolvido = true;
      mostrarEstado('form-nova-senha');
    }
  });

  // Se o link já foi consumido antes (sessão de recovery expirada sem erro explícito no fragmento)
  setTimeout(() => {
    if (!resolvido) mostrarEstado('form-invalido');
  }, 2500);
}

function showError(msg) {
  document.getElementById('nova-senha-error').textContent = msg;
}
function clearError() {
  document.getElementById('nova-senha-error').textContent = '';
}

document.getElementById('btn-confirmar-nova-senha').addEventListener('click', async () => {
  clearError();
  const senha1 = document.getElementById('nova-senha-1').value.trim();
  const senha2 = document.getElementById('nova-senha-2').value.trim();

  if (!senha1) { showError('Informe a nova senha'); return; }
  if (senha1.length < 6) { showError('A senha deve ter pelo menos 6 caracteres'); return; }
  if (senha1 !== senha2) { showError('As senhas não coincidem'); return; }

  const btn = document.getElementById('btn-confirmar-nova-senha');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password: senha1 });
    if (updateError) {
      showError('Não foi possível redefinir a senha. Solicite um novo link.');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData && sessionData.session && sessionData.session.access_token;
    if (!accessToken) {
      showError('Sessão expirada. Solicite um novo link.');
      return;
    }

    const r = await fetch(API + '/api/auth/sincronizar-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken, nova_senha: senha1 })
    });

    if (!r.ok) {
      const err = await r.json();
      showError(err.erro || 'Erro ao redefinir senha');
      return;
    }

    mostrarEstado('form-sucesso');
  } catch {
    showError('Erro ao conectar ao servidor');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Redefinir senha';
  }
});

document.getElementById('nova-senha-2').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-confirmar-nova-senha').click();
});
