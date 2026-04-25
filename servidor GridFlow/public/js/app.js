// GridFlow Web - Aplicação Principal

class GridFlowApp {
  constructor() {
    this.usuario = null;
    this.colaborador = null;
    this.periodo = null;
    this.empresaSelecionada = null;
    this.historicoAtual = {};
    this.minhasEmpresas = [];
    this.searchTimeout = null;
    this.refreshInterval = null;
    this.currentTab = 'dashboard';
    this.editandoColId = null;
    this.empresaConfigurar = null;
  }

  async init() {
    this.configurarEventos();
    await this.carregarPeriodos();
    await this.verificarConexao();
    await this.carregarColaboradores();
    this.iniciarAutoRefresh();
    await this.renderizarConteudo();
  }

  async verificarConexao() {
    try {
      await this.api('/api/health');
      document.getElementById('status-dot').classList.add('online');
      document.getElementById('status-dot').classList.remove('offline');
    } catch {
      document.getElementById('status-dot').classList.add('offline');
      document.getElementById('status-dot').classList.remove('online');
    }
  }

  async api(endpoint, options = {}) {
    const url = CONFIG.API_URL + endpoint;
    const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    return res.json();
  }

  // ── Colaboradores (seleção de usuário) ───────────────────────────────────
  async carregarColaboradores() {
    try {
      const cols = await this.api('/api/colaboradores');
      this.renderUserList(cols);
    } catch (e) { console.error(e); }
  }

  renderUserList(cols) {
    const container = document.getElementById('user-list');
    container.innerHTML = cols.filter(c => c.ativo).map(col => `
      <div class="user-list-item" data-id="${col.id}" data-nome="${col.nome}">
        <div class="user-avatar">${col.nome.charAt(0)}</div>
        <div>
          <div style="font-weight:600">${col.nome}</div>
          <div style="font-size:0.75rem;color:#718096">${col.funcao || 'Usuário'}</div>
        </div>
      </div>`).join('');
    container.querySelectorAll('.user-list-item').forEach(item =>
      item.addEventListener('click', () => this.selecionarUsuario(item)));
  }

  async selecionarUsuario(item) {
    this.usuario = item.dataset.nome;
    this.colaborador = { id: parseInt(item.dataset.id), nome: item.dataset.nome };
    document.getElementById('current-user').textContent = this.usuario;
    document.getElementById('user-avatar').textContent = this.usuario.charAt(0);
    this.closeUserModal();
    await this.carregarMinhasEmpresas();
    if (this.minhasEmpresas.length > 0) await this.selecionarEmpresa(this.minhasEmpresas[0]);
    await this.renderizarConteudo();
  }

  async carregarMinhasEmpresas() {
    try {
      const col = await this.api(`/api/colaboradores/${this.colaborador.id}`);
      this.colaborador = col;
      this.minhasEmpresas = col.empresas || [];
    } catch { this.minhasEmpresas = []; }
  }

  openUserModal() { document.getElementById('user-modal').classList.add('show'); }
  closeUserModal() { document.getElementById('user-modal').classList.remove('show'); }

  // ── Períodos ──────────────────────────────────────────────────────────────
  async carregarPeriodos() {
    this.periodo = this.obterPeriodoAtual();
    this.renderPeriodoDropdown(this.gerarPeriodos());
  }

  gerarPeriodos() {
    const periodos = [];
    const agora = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      periodos.push(`${mes}/${d.getFullYear()}`);
    }
    return periodos;
  }

  obterPeriodoAtual() {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  renderPeriodoDropdown(periodos) {
    const dropdown = document.getElementById('periodo-dropdown');
    dropdown.innerHTML = periodos.map(p => `
      <div class="dropdown-item ${p === this.periodo ? 'active' : ''}" data-value="${p}">${p}</div>`).join('');
    document.getElementById('periodo-display').textContent = this.periodo;
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        this.periodo = item.dataset.value;
        document.getElementById('periodo-display').textContent = this.periodo;
        dropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        dropdown.classList.remove('show');
        this.atualizarConteudo();
      });
    });
  }

  // ── Navegação ─────────────────────────────────────────────────────────────
  configurarEventos() {
    document.getElementById('sidebar-toggle').addEventListener('click', () =>
      document.getElementById('app-sidebar').classList.toggle('collapsed'));
    document.getElementById('user-switch').addEventListener('click', () => this.openUserModal());
    document.getElementById('btn-periodo').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('periodo-dropdown').classList.toggle('show');
    });
    document.addEventListener('click', () =>
      document.getElementById('periodo-dropdown').classList.remove('show'));
    document.querySelectorAll('.nav-item').forEach(item =>
      item.addEventListener('click', () => { if (item.dataset.tab) this.mudarTab(item.dataset.tab); }));
  }

  mudarTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.tab === tab));
    const titles = { dashboard:'Checklist', atividades:'Gerenciador de Atividades',
      configurar:'Configurar Empresa', empresas:'Gerenciador de Empresas',
      colaboradores:'Colaboradores', status:'Status Geral' };
    document.getElementById('topbar-title').textContent = titles[tab] || tab;
    this.renderizarConteudo();
  }

  async renderizarConteudo() {
    const content = document.getElementById('app-content');
    switch (this.currentTab) {
      case 'dashboard':
        content.innerHTML = await this.renderDashboard();
        this.configurarEventosDashboard();
        break;
      case 'atividades':
        content.innerHTML = await this.renderAtividades();
        this.configurarEventosAtividades();
        break;
      case 'empresas':
        content.innerHTML = await this.renderEmpresas();
        break;
      case 'colaboradores':
        content.innerHTML = await this.renderColaboradores();
        this.configurarEventosColaboradores();
        break;
      case 'configurar':
        content.innerHTML = this.renderConfigurar();
        this.configurarEventosConfigurar();
        break;
      case 'status':
        content.innerHTML = '<div class="loading">Carregando...</div>';
        content.innerHTML = await this.renderStatus();
        break;
    }
  }

  async atualizarConteudo() { await this.renderizarConteudo(); }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async renderDashboard() {
    return `
      <div class="dashboard-grid">
        <div class="col-left">
          <div class="card">
            <h3 style="margin:0 0 10px">🔍 Buscar Empresa</h3>
            <div class="search-box" style="position:relative">
              <span class="search-icon">🔍</span>
              <input type="text" id="db-search-input" placeholder="Nome, CNPJ ou código...">
              <div class="search-results" id="db-search-results"></div>
            </div>
          </div>
          ${this.minhasEmpresas.length ? `
          <div class="card">
            <h3>⭐ Minhas Empresas</h3>
            <div id="db-minhas-empresas">
              ${this.minhasEmpresas.map(e => `
                <div class="minha-empresa-item" data-id="${e.id}">
                  <div class="minha-empresa-nome">${e.nome}</div>
                  <div class="minha-empresa-cod">${e.codigo_interno || e.cnpj || ''}</div>
                </div>`).join('')}
            </div>
          </div>` : ''}
          <div class="card" id="db-empresa-card">
            <h3>🏢 Empresa Selecionada</h3>
            <div id="db-empresa-info">
              <div class="empresa-info-empty">${this.minhasEmpresas.length ? 'Clique em uma das suas empresas' : 'Busque e selecione uma empresa'}</div>
            </div>
          </div>
          <div class="card" id="db-notas-card" style="display:none">
            <h3 style="margin:0 0 10px;font-size:0.92rem">📝 Anotações — <span style="color:#3498db">${this.periodo}</span></h3>
            <textarea id="db-nota-texto" rows="4" placeholder="Registre aqui pendências, observações ou lembretes..."></textarea>
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
              <button class="btn btn-primary btn-sm" id="db-nota-salvar">💾 Salvar</button>
              <span id="db-nota-status" style="font-size:0.75rem;color:#718096"></span>
            </div>
          </div>
        </div>
        <div class="col-right">
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
              <h3 style="margin:0">✅ Atividades</h3>
              <span style="font-size:0.78rem;font-weight:600;color:#3498db;background:#ebf8ff;padding:3px 10px;border-radius:20px">📅 ${this.periodo}</span>
            </div>
            <div id="db-atividades-container">
              <div class="atividades-vazio">Selecione uma empresa para ver as atividades</div>
            </div>
          </div>
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <h3 style="margin:0">📋 Histórico — <span style="color:#3498db">${this.periodo}</span></h3>
              <span class="sync-info">Auto-atualiza a cada 5s</span>
            </div>
            <div id="db-historico-lista">
              <div class="historico-vazio">Nenhum registro neste período</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  configurarEventosDashboard() {
    const input = document.getElementById('db-search-input');
    if (input) {
      input.addEventListener('input', () => {
        clearTimeout(this.searchTimeout);
        const q = input.value.trim();
        if (q.length < 2) { document.getElementById('db-search-results').classList.remove('show'); return; }
        this.searchTimeout = setTimeout(() => this.buscarEmpresas(q), 300);
      });
    }
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-box')) document.getElementById('db-search-results')?.classList.remove('show');
    });
    document.querySelectorAll('.minha-empresa-item').forEach(el => {
      el.addEventListener('click', async () => {
        document.querySelectorAll('.minha-empresa-item').forEach(i => i.classList.remove('ativa'));
        el.classList.add('ativa');
        await this.selecionarEmpresa(this.minhasEmpresas.find(e => e.id == el.dataset.id));
      });
    });
    document.getElementById('db-nota-salvar')?.addEventListener('click', () => this.salvarNota());
  }

  async buscarEmpresas(q) {
    try {
      const lista = await this.api(`/api/empresas?search=${encodeURIComponent(q)}`);
      const results = document.getElementById('db-search-results');
      if (!lista.length) {
        results.innerHTML = '<div class="search-result-item"><div class="result-nome">Nenhuma empresa encontrada</div></div>';
      } else {
        results.innerHTML = lista.map(e => `
          <div class="search-result-item" data-id="${e.id}">
            <div class="result-nome">${e.nome}</div>
            <div class="result-info">${e.cnpj || ''} ${e.codigo_interno ? '• ' + e.codigo_interno : ''}</div>
          </div>`).join('');
        results.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', async () => {
            await this.selecionarEmpresa(lista.find(e => e.id == item.dataset.id));
            results.classList.remove('show');
            document.getElementById('db-search-input').value = '';
          });
        });
      }
      results.classList.add('show');
    } catch (e) { console.error(e); }
  }

  async selecionarEmpresa(empresa) {
    this.empresaSelecionada = empresa;
    document.getElementById('db-empresa-info').innerHTML = `
      <div class="empresa-nome">${empresa.nome}</div>
      <div class="empresa-badges">
        ${empresa.cnpj ? `<span class="badge badge-blue">${empresa.cnpj}</span>` : ''}
        ${empresa.codigo_interno ? `<span class="badge badge-green">${empresa.codigo_interno}</span>` : ''}
      </div>`;
    document.getElementById('db-notas-card').style.display = 'block';
    await Promise.all([this.carregarAtividades(), this.carregarHistorico(), this.carregarNota()]);
  }

  async carregarAtividades() {
    if (!this.empresaSelecionada) return;
    try {
      const empresaId = this.empresaSelecionada.id;
      const [atividades, historico] = await Promise.all([
        this.api(`/api/empresas/${empresaId}/atividades`),
        this.api(`/api/historico?empresa_id=${empresaId}&periodo=${encodeURIComponent(this.periodo)}`)
      ]);

      this.historicoAtual = {};
      historico.forEach(h => { this.historicoAtual[h.atividade_id] = h; });

      const okIds = new Set(historico.filter(h => h.status === 'OK').map(h => h.atividade_id));
      const naIds = new Set(historico.filter(h => h.status === 'Não Aplicável').map(h => h.atividade_id));

      const habilitadas = atividades.filter(a => a.habilitada);
      const grupos = {};
      habilitadas.forEach(a => { (grupos[a.grupo || 'Geral'] = grupos[a.grupo || 'Geral'] || []).push(a); });

      const container = document.getElementById('db-atividades-container');
      if (!habilitadas.length) {
        container.innerHTML = '<div class="atividades-vazio">Nenhuma atividade habilitada</div>';
        return;
      }

      container.innerHTML = Object.entries(grupos).map(([grupo, atvsGrupo]) => `
        <div style="margin-bottom:16px">
          <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#718096;margin-bottom:6px;letter-spacing:0.05em">${grupo}</div>
          <div class="atividades-grid">
            ${atvsGrupo.map(a => `
              <button class="atividade-btn ${okIds.has(a.atividade_id) ? 'concluida' : naIds.has(a.atividade_id) ? 'na' : ''}"
                      data-id="${a.atividade_id}" data-status="${okIds.has(a.atividade_id) ? 'OK' : naIds.has(a.atividade_id) ? 'NA' : ''}">
                <span class="btn-codigo">${a.codigo || ''}</span>${a.nome}
              </button>`).join('')}
          </div>
        </div>`).join('');

      container.querySelectorAll('.atividade-btn').forEach(btn =>
        btn.addEventListener('click', () => this.toggleAtividade(btn)));
    } catch (e) { console.error(e); }
  }

  async toggleAtividade(btn) {
    if (!this.usuario) { alert('Selecione um usuário primeiro (canto inferior esquerdo)'); return; }
    const atividadeId = parseInt(btn.dataset.id);
    const status = btn.dataset.status;
    const empresaId = this.empresaSelecionada.id;

    try {
      if (status === 'OK') {
        const h = this.historicoAtual[atividadeId];
        if (h) await this.api(`/api/historico/${h.id}`, { method: 'DELETE' });
        btn.classList.remove('concluida', 'na');
        btn.dataset.status = '';
        delete this.historicoAtual[atividadeId];
      } else {
        const h = await this.api('/api/historico', {
          method: 'POST',
          body: JSON.stringify({ empresa_id: empresaId, atividade_id: atividadeId,
            periodo: this.periodo, usuario: this.usuario, status: 'OK', observacao: '' })
        });
        btn.classList.add('concluida');
        btn.classList.remove('na');
        btn.dataset.status = 'OK';
        this.historicoAtual[atividadeId] = h;
      }
      await this.carregarHistorico();
    } catch (e) { console.error(e); }
  }

  async carregarHistorico() {
    if (!this.empresaSelecionada) return;
    try {
      const historico = await this.api(`/api/historico?empresa_id=${this.empresaSelecionada.id}&periodo=${encodeURIComponent(this.periodo)}`);
      const container = document.getElementById('db-historico-lista');
      if (!historico.length) {
        container.innerHTML = '<div class="historico-vazio">Nenhum registro neste período</div>';
        return;
      }
      container.innerHTML = `<div class="historico-lista">${historico.map(h => `
        <div class="historico-item">
          <div class="hi-data">${h.data}</div>
          <div class="hi-atividade">${h.atividade_codigo ? h.atividade_codigo + ' - ' : ''}${h.atividade_nome}</div>
          <div class="hi-usuario">${h.usuario}</div>
        </div>`).join('')}</div>`;
    } catch (e) { console.error(e); }
  }

  async carregarNota() {
    if (!this.empresaSelecionada) return;
    try {
      const notas = await this.api(`/api/notas?empresa_id=${this.empresaSelecionada.id}&periodo=${encodeURIComponent(this.periodo)}`);
      document.getElementById('db-nota-texto').value = (notas && notas.length) ? (notas[0].texto || '') : '';
    } catch (e) { console.error(e); }
  }

  async salvarNota() {
    if (!this.empresaSelecionada || !this.usuario) return;
    try {
      await this.api('/api/notas', { method: 'POST', body: JSON.stringify({
        empresa_id: this.empresaSelecionada.id, periodo: this.periodo,
        usuario: this.usuario, texto: document.getElementById('db-nota-texto').value
      })});
      const st = document.getElementById('db-nota-status');
      st.textContent = 'Salvo!';
      setTimeout(() => st.textContent = '', 2000);
    } catch (e) { console.error(e); }
  }

  iniciarAutoRefresh() {
    this.refreshInterval = setInterval(async () => {
      await this.verificarConexao();
      if (this.currentTab === 'dashboard' && this.empresaSelecionada) {
        await Promise.all([this.carregarHistorico(), this.carregarAtividades()]);
      }
    }, 5000);
  }

  // ── Atividades ────────────────────────────────────────────────────────────
  async renderAtividades() {
    try {
      const atividades = await this.api('/api/atividades');
      const grupos = [...new Set(atividades.map(a => a.grupo || 'Geral'))].sort();
      return `
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <h3 style="margin:0">Gerenciador de Atividades</h3>
            <button class="btn btn-primary" id="btn-nova-atividade">+ Nova Atividade</button>
          </div>
          <div id="form-atividade" style="display:none;background:#f7fafc;border-radius:8px;padding:16px;margin-bottom:16px">
            <h4 style="margin:0 0 12px">Nova Atividade</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
              <input id="atv-nome" type="text" placeholder="Nome da atividade *" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px">
              <input id="atv-grupo" type="text" placeholder="Grupo (ex: Fiscal, RH...)" list="grupos-list" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px">
              <datalist id="grupos-list">${grupos.map(g => `<option value="${g}">`).join('')}</datalist>
            </div>
            <input id="atv-descricao" type="text" placeholder="Descrição (opcional)" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;box-sizing:border-box;margin-bottom:10px">
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary" id="btn-salvar-atv">Salvar</button>
              <button class="btn" id="btn-cancelar-atv">Cancelar</button>
            </div>
          </div>
          <table class="data-table">
            <thead><tr><th>Nome</th><th>Grupo</th><th>Descrição</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${atividades.map(a => `
                <tr>
                  <td>${a.nome}</td>
                  <td><span class="grupo-tag">${a.grupo || 'Geral'}</span></td>
                  <td>${a.descricao || '-'}</td>
                  <td>${a.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
                  <td>
                    <button class="btn btn-sm btn-ativar-atv" data-id="${a.id}" data-ativo="${a.ativo}">
                      ${a.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch (e) { return `<div class="loading">Erro ao carregar atividades</div>`; }
  }

  configurarEventosAtividades() {
    document.getElementById('btn-nova-atividade')?.addEventListener('click', () => {
      document.getElementById('form-atividade').style.display = 'block';
    });
    document.getElementById('btn-cancelar-atv')?.addEventListener('click', () => {
      document.getElementById('form-atividade').style.display = 'none';
    });
    document.getElementById('btn-salvar-atv')?.addEventListener('click', async () => {
      const nome = document.getElementById('atv-nome').value.trim();
      const grupo = document.getElementById('atv-grupo').value.trim() || 'Geral';
      const descricao = document.getElementById('atv-descricao').value.trim();
      if (!nome) { alert('Nome é obrigatório'); return; }
      try {
        await this.api('/api/atividades', { method: 'POST', body: JSON.stringify({ nome, grupo, descricao }) });
        await this.mudarTab('atividades');
      } catch (e) { alert('Erro ao salvar: ' + e.message); }
    });
    document.querySelectorAll('.btn-ativar-atv').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const ativo = btn.dataset.ativo === '1' || btn.dataset.ativo === 'true';
        try {
          await this.api(`/api/atividades/${id}`, { method: 'PUT', body: JSON.stringify({ ativo: !ativo }) });
          await this.mudarTab('atividades');
        } catch (e) { alert('Erro: ' + e.message); }
      });
    });
  }

  // ── Empresas ──────────────────────────────────────────────────────────────
  async renderEmpresas() {
    try {
      const empresas = await this.api('/api/empresas/todas');
      return `
        <div class="card">
          <h3>Gerenciador de Empresas (${empresas.length})</h3>
          <table class="data-table">
            <thead><tr><th>Nome</th><th>CNPJ</th><th>Código</th><th>Status</th></tr></thead>
            <tbody>
              ${empresas.map(e => `
                <tr>
                  <td>${e.nome}</td>
                  <td>${e.cnpj || '-'}</td>
                  <td>${e.codigo_interno || '-'}</td>
                  <td>${e.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch { return `<div class="loading">Erro ao carregar empresas</div>`; }
  }

  // ── Colaboradores (CRUD) ───────────────────────────────────────────────────
  async renderColaboradores() {
    try {
      const cols = await this.api('/api/colaboradores');
      return `
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <h3 style="margin:0">Colaboradores</h3>
            <button class="btn btn-primary" id="btn-novo-col">+ Novo Colaborador</button>
          </div>
          <div id="form-col" style="display:none;background:#f7fafc;border-radius:8px;padding:16px;margin-bottom:16px">
            <h4 id="form-col-titulo" style="margin:0 0 12px">Novo Colaborador</h4>
            <input type="hidden" id="col-id">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
              <input id="col-nome" type="text" placeholder="Nome completo *" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px">
              <input id="col-funcao" type="text" placeholder="Função (ex: Contador)" style="padding:8px;border:1px solid #e2e8f0;border-radius:6px">
            </div>
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;cursor:pointer">
              <input id="col-admin" type="checkbox"> Administrador
            </label>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary" id="btn-salvar-col">Salvar</button>
              <button class="btn" id="btn-cancelar-col">Cancelar</button>
            </div>
          </div>
          <table class="data-table">
            <thead><tr><th>Nome</th><th>Função</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${cols.map(c => `
                <tr>
                  <td><div style="display:flex;align-items:center;gap:8px">
                    <div class="user-avatar" style="width:28px;height:28px;font-size:0.75rem">${c.nome.charAt(0)}</div>${c.nome}
                  </div></td>
                  <td>${c.funcao || '-'}</td>
                  <td>${c.admin ? '👑 Admin' : 'Usuário'}</td>
                  <td>${c.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
                  <td style="display:flex;gap:6px">
                    <button class="btn btn-sm btn-editar-col" data-id="${c.id}" data-nome="${c.nome}" data-funcao="${c.funcao || ''}" data-admin="${c.admin}">Editar</button>
                    <button class="btn btn-sm btn-toggle-col" data-id="${c.id}" data-ativo="${c.ativo}">${c.ativo ? 'Desativar' : 'Ativar'}</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch { return `<div class="loading">Erro ao carregar colaboradores</div>`; }
  }

  configurarEventosColaboradores() {
    document.getElementById('btn-novo-col')?.addEventListener('click', () => {
      document.getElementById('col-id').value = '';
      document.getElementById('col-nome').value = '';
      document.getElementById('col-funcao').value = '';
      document.getElementById('col-admin').checked = false;
      document.getElementById('form-col-titulo').textContent = 'Novo Colaborador';
      document.getElementById('form-col').style.display = 'block';
    });
    document.getElementById('btn-cancelar-col')?.addEventListener('click', () => {
      document.getElementById('form-col').style.display = 'none';
    });
    document.getElementById('btn-salvar-col')?.addEventListener('click', async () => {
      const id = document.getElementById('col-id').value;
      const nome = document.getElementById('col-nome').value.trim();
      const funcao = document.getElementById('col-funcao').value.trim();
      const admin = document.getElementById('col-admin').checked;
      if (!nome) { alert('Nome é obrigatório'); return; }
      try {
        if (id) {
          await this.api(`/api/colaboradores/${id}`, { method: 'PUT', body: JSON.stringify({ nome, funcao, admin }) });
        } else {
          await this.api('/api/colaboradores', { method: 'POST', body: JSON.stringify({ nome, funcao, admin }) });
        }
        await this.carregarColaboradores();
        await this.mudarTab('colaboradores');
      } catch (e) { alert('Erro ao salvar: ' + e.message); }
    });
    document.querySelectorAll('.btn-editar-col').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('col-id').value = btn.dataset.id;
        document.getElementById('col-nome').value = btn.dataset.nome;
        document.getElementById('col-funcao').value = btn.dataset.funcao;
        document.getElementById('col-admin').checked = btn.dataset.admin === '1' || btn.dataset.admin === 'true';
        document.getElementById('form-col-titulo').textContent = 'Editar Colaborador';
        document.getElementById('form-col').style.display = 'block';
        document.getElementById('form-col').scrollIntoView({ behavior: 'smooth' });
      });
    });
    document.querySelectorAll('.btn-toggle-col').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ativo = btn.dataset.ativo === '1' || btn.dataset.ativo === 'true';
        try {
          await this.api(`/api/colaboradores/${btn.dataset.id}`, { method: 'PUT', body: JSON.stringify({ ativo: !ativo }) });
          await this.carregarColaboradores();
          await this.mudarTab('colaboradores');
        } catch (e) { alert('Erro: ' + e.message); }
      });
    });
  }

  // ── Configurar ────────────────────────────────────────────────────────────
  renderConfigurar() {
    const empresa = this.empresaConfigurar || this.empresaSelecionada;
    return `
      <div class="card">
        <h3 style="margin:0 0 12px">Configurar Empresa</h3>
        <div style="position:relative;margin-bottom:16px">
          <input type="text" id="cfg-search" placeholder="🔍  Buscar empresa pelo nome..." style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.95rem;box-sizing:border-box">
          <div id="cfg-search-results" class="search-results" style="position:absolute;top:100%;left:0;right:0;z-index:100"></div>
        </div>
        <div id="cfg-conteudo">
          ${empresa ? '<div class="loading">Carregando atividades...</div>' : '<div style="color:#718096;text-align:center;padding:40px">Busque e selecione uma empresa acima</div>'}
        </div>
      </div>`;
  }

  configurarEventosConfigurar() {
    const input = document.getElementById('cfg-search');
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      const q = input.value.trim();
      if (q.length < 2) { document.getElementById('cfg-search-results').classList.remove('show'); return; }
      t = setTimeout(() => this.buscarEmpresaConfigurar(q), 300);
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#cfg-search') && !e.target.closest('#cfg-search-results'))
        document.getElementById('cfg-search-results')?.classList.remove('show');
    });
    const empresa = this.empresaConfigurar || this.empresaSelecionada;
    if (empresa) this.carregarConfigurarEmpresa(empresa.id);
  }

  async buscarEmpresaConfigurar(q) {
    try {
      const lista = await this.api(`/api/empresas?search=${encodeURIComponent(q)}`);
      const results = document.getElementById('cfg-search-results');
      if (!lista.length) {
        results.innerHTML = '<div class="search-result-item">Nenhuma empresa encontrada</div>';
      } else {
        results.innerHTML = lista.map(e => `
          <div class="search-result-item" data-id="${e.id}">
            <div class="result-nome">${e.nome}</div>
            <div class="result-info">${e.codigo_interno || ''}</div>
          </div>`).join('');
        results.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', async () => {
            const emp = lista.find(e => e.id == item.dataset.id);
            this.empresaConfigurar = emp;
            document.getElementById('cfg-search').value = emp.nome;
            results.classList.remove('show');
            await this.carregarConfigurarEmpresa(emp.id);
          });
        });
      }
      results.classList.add('show');
    } catch (e) { console.error(e); }
  }

  async carregarConfigurarEmpresa(empresaId) {
    const container = document.getElementById('cfg-conteudo');
    try {
      const atividades = await this.api(`/api/empresas/${empresaId}/atividades`);
      const grupos = {};
      atividades.forEach(a => { (grupos[a.grupo || 'Geral'] = grupos[a.grupo || 'Geral'] || []).push(a); });

      container.innerHTML = `
        <h4 style="margin:0 0 12px">${this.empresaConfigurar?.nome || this.empresaSelecionada?.nome || ''}</h4>
        <p style="color:#718096;margin-bottom:16px;font-size:0.85rem">Habilite ou desabilite atividades para esta empresa</p>
        ${Object.entries(grupos).map(([grupo, atvsGrupo]) => `
          <div style="margin-bottom:20px">
            <div style="font-weight:700;text-transform:uppercase;font-size:0.75rem;color:#718096;margin-bottom:8px;letter-spacing:0.05em">${grupo}</div>
            ${atvsGrupo.map(a => `
              <div class="configurar-atividade-row">
                <div class="cfg-atv-info">
                  <div class="cfg-atv-nome">${a.nome}</div>
                  <div class="cfg-atv-grupo">${a.grupo || 'Geral'}</div>
                </div>
                <label class="toggle-ativo">
                  <input type="checkbox" class="cfg-toggle" ${a.habilitada ? 'checked' : ''} data-empresa="${empresaId}" data-atv="${a.atividade_id}">
                  <span class="toggle-slider"></span>
                </label>
              </div>`).join('')}
          </div>`).join('')}`;

      container.querySelectorAll('.cfg-toggle').forEach(toggle => {
        toggle.addEventListener('change', async () => {
          try {
            await this.api(`/api/empresas/${toggle.dataset.empresa}/atividades/${toggle.dataset.atv}`, {
              method: 'PUT', body: JSON.stringify({ habilitada: toggle.checked })
            });
          } catch (e) { toggle.checked = !toggle.checked; alert('Erro ao salvar'); }
        });
      });
    } catch (e) { container.innerHTML = '<div class="loading">Erro ao carregar</div>'; }
  }

  // ── Status Geral ──────────────────────────────────────────────────────────
  async renderStatus() {
    try {
      const data = await this.api(`/api/status/geral?periodo=${encodeURIComponent(this.periodo)}`);
      const { colaboradores, geral } = data;

      const totalEmpresas = geral.length;
      const totalAtv = geral.reduce((s, e) => s + e.total, 0);
      const totalConc = geral.reduce((s, e) => s + e.concluidas, 0);
      const pctGeral = totalAtv > 0 ? Math.round((totalConc / totalAtv) * 100) : 0;

      return `
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card">
            <h3 style="margin:0 0 16px">📊 Resumo — ${this.periodo}</h3>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
              ${[
                ['🏢', totalEmpresas, 'Empresas', '#3498db'],
                ['✅', totalConc, 'Concluídas', '#27ae60'],
                ['⏳', totalAtv - totalConc, 'Pendentes', '#e67e22'],
                ['📈', pctGeral + '%', 'Progresso', '#9b59b6']
              ].map(([icon, val, lbl, cor]) => `
                <div style="text-align:center;padding:16px;background:#f7fafc;border-radius:8px">
                  <div style="font-size:1.5rem">${icon}</div>
                  <div style="font-size:1.8rem;font-weight:700;color:${cor}">${val}</div>
                  <div style="font-size:0.78rem;color:#718096">${lbl}</div>
                </div>`).join('')}
            </div>
          </div>

          ${colaboradores.map(col => `
            <div class="card">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="user-avatar">${col.colaborador.nome.charAt(0)}</div>
                  <div>
                    <div style="font-weight:700">${col.colaborador.nome}</div>
                    <div style="font-size:0.78rem;color:#718096">${col.colaborador.funcao || 'Usuário'} · ${col.total_empresas} empresa${col.total_empresas !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:1.5rem;font-weight:700;color:${col.pct >= 80 ? '#27ae60' : col.pct >= 50 ? '#e67e22' : '#e74c3c'}">${col.pct}%</div>
                  <div style="font-size:0.75rem;color:#718096">${col.concluidas}/${col.total_atividades}</div>
                </div>
              </div>
              <div style="background:#e2e8f0;border-radius:99px;height:8px;margin-bottom:12px">
                <div style="background:${col.pct >= 80 ? '#27ae60' : col.pct >= 50 ? '#e67e22' : '#e74c3c'};width:${col.pct}%;height:8px;border-radius:99px;transition:width 0.3s"></div>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${col.empresas.map(e => `
                  <div style="background:${e.pct === 100 ? '#f0fff4' : '#fff5f5'};border:1px solid ${e.pct === 100 ? '#9ae6b4' : '#feb2b2'};border-radius:6px;padding:4px 10px;font-size:0.78rem">
                    ${e.empresa.nome} <strong>${e.pct}%</strong>
                  </div>`).join('')}
              </div>
            </div>`).join('')}

          <div class="card">
            <h3 style="margin:0 0 12px">🏢 Todas as Empresas</h3>
            ${geral.map(e => `
              <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f0f0f0">
                <div style="flex:1;font-size:0.85rem">${e.empresa.nome}</div>
                <div style="width:120px;background:#e2e8f0;border-radius:99px;height:6px">
                  <div style="background:${e.pct === 100 ? '#27ae60' : e.pct >= 50 ? '#e67e22' : '#e74c3c'};width:${e.pct}%;height:6px;border-radius:99px"></div>
                </div>
                <div style="font-size:0.82rem;font-weight:600;width:40px;text-align:right">${e.pct}%</div>
              </div>`).join('')}
          </div>
        </div>`;
    } catch (e) { return `<div class="loading">Erro ao carregar status: ${e.message}</div>`; }
  }
}

const App = new GridFlowApp();
document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
