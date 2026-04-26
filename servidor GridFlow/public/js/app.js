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
    this.filiais = [];
    this._historicoFiliais = {};
    this._gruposIntegrados = [];
    this._atividadesEmpresa = [];
    this._statusView = 'colaboradores';
    this._statusSearch = '';
    this._statusRegime = '';
    this._statusData = null;
    this._statusColabDetalhe = null;
  }

  async init() {
    // Verificar login salvo — redireciona para login.html se não houver
    const savedUser = localStorage.getItem('gridflow_user');
    if (!savedUser) {
      window.location.replace('login.html');
      return;
    }
    const user = JSON.parse(savedUser);
    this.usuario    = user.nome;
    this.colaborador = { id: user.id, nome: user.nome };
    document.getElementById('current-user').textContent = user.nome;
    // Avatar provisório com inicial — será substituído com foto ao carregar colaboradores
    document.getElementById('user-avatar').textContent = user.nome.charAt(0).toUpperCase();

    this.configurarEventos();
    await this.carregarPeriodos();
    await this.verificarConexao();
    await this.carregarColaboradores(); // renderUserList() atualiza o avatar com a foto real
    this.iniciarAutoRefresh();
    await this.carregarMinhasEmpresas();
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

  _atualizarAvatarSidebar(nome, foto) {
    const av = document.getElementById('user-avatar');
    if (!av) return;
    if (foto) {
      av.innerHTML = `<img src="${foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      av.innerHTML = '';
      av.textContent = nome.charAt(0).toUpperCase();
    }
  }

  renderUserList(cols) {
    // Atualiza avatar da sidebar para o usuário atual
    const meCol = cols.find(c => c.id === this.colaborador?.id);
    if (meCol) this._atualizarAvatarSidebar(meCol.nome, meCol.foto || '');

    const container = document.getElementById('user-list');
    container.innerHTML = cols.filter(c => c.ativo).map(col => `
      <div class="user-list-item" data-id="${col.id}" data-nome="${col.nome}" data-foto="${col.foto || ''}">
        <div class="user-avatar">
          ${col.foto
            ? `<img src="${col.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : col.nome.charAt(0).toUpperCase()}
        </div>
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
    this._atualizarAvatarSidebar(item.dataset.nome, item.dataset.foto || '');
    this.closeUserModal();
    await this.carregarMinhasEmpresas();
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
  logout() {
    localStorage.removeItem('gridflow_user');
    window.location.replace('login.html');
  }

  // ── Períodos ──────────────────────────────────────────────────────────────
  async carregarPeriodos() {
    try {
      const periodos = await this.api('/api/periodos');
      this._periodos = periodos.length ? periodos : this._gerarPeriodosLocais();
    } catch {
      this._periodos = this._gerarPeriodosLocais();
    }
    // Restaurar último período usado (se ainda válido) ou usar mês atual
    const savedPeriodo = localStorage.getItem('gridflow_periodo');
    if (savedPeriodo && this._periodos.includes(savedPeriodo)) {
      this.periodo = savedPeriodo;
    } else {
      this.periodo = this.obterPeriodoAtual();
      localStorage.setItem('gridflow_periodo', this.periodo);
    }
    this.renderPeriodoDropdown(this._periodos);
  }

  _gerarPeriodosLocais() {
    const ano = new Date().getFullYear();
    const ps = [];
    for (let m = 12; m >= 1; m--) ps.push(String(m).padStart(2, '0') + '/' + ano);
    return ps;
  }

  obterPeriodoAtual() {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  renderPeriodoDropdown(periodos) {
    const dropdown = document.getElementById('periodo-dropdown');
    const anoAtual = new Date().getFullYear();
    dropdown.innerHTML = `
      <div style="padding:6px 12px 4px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#a0aec0">
        ${anoAtual}
      </div>
      <div style="max-height:280px;overflow-y:auto">
        ${periodos.map(p => `
          <div class="dropdown-item ${p === this.periodo ? 'active' : ''}"
               style="display:flex;align-items:center;gap:8px;cursor:pointer"
               data-value="${p}">
            <span style="flex:1">${p}</span>
            ${p === this.periodo ? '<span style="width:7px;height:7px;border-radius:50%;background:#3498db;flex-shrink:0"></span>' : ''}
          </div>`).join('')}
      </div>`;

    document.getElementById('periodo-display').textContent = this.periodo;

    dropdown.querySelectorAll('.dropdown-item[data-value]').forEach(item => {
      item.addEventListener('click', () => {
        this.periodo = item.dataset.value;
        localStorage.setItem('gridflow_periodo', this.periodo);
        document.getElementById('periodo-display').textContent = this.periodo;
        dropdown.classList.remove('show');
        this.renderPeriodoDropdown(this._periodos);
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
    document.addEventListener('click', e => {
      if (!e.target.closest('#periodo-dropdown') && !e.target.closest('#btn-periodo'))
        document.getElementById('periodo-dropdown').classList.remove('show');
    });
    document.querySelectorAll('.nav-item').forEach(item =>
      item.addEventListener('click', () => { if (item.dataset.tab) this.mudarTab(item.dataset.tab); }));

    document.getElementById('btn-backup')?.addEventListener('click', () => this._fazerBackup());
  }

  _fazerBackup() {
    const url = CONFIG.API_URL + '/api/backup';
    const a = document.createElement('a');
    a.href = url;
    const data = new Date().toISOString().slice(0, 10);
    a.download = `gridflow-backup-${data}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  mudarTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.tab === tab));
    const titles = { dashboard:'Checklist', atividades:'Gerenciador de Atividades',
      configurar:'Configurar Empresa', empresas:'Gerenciador de Empresas',
      colaboradores:'Colaboradores', status:'Status Geral', relatorio:'Relatório de Anotações' };
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
        this.configurarEventosEmpresas();
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
        this._statusSearch = '';
        content.innerHTML = this._renderStatusShell();
        this._configurarEventosStatus();
        await this._carregarStatus();
        break;
      case 'relatorio':
        content.innerHTML = this._renderRelatorioShell();
        this._configurarEventosRelatorio();
        await this._carregarRelatorio();
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
        <div class="col-right" id="db-col-right">
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:320px;gap:14px;color:#a0aec0;text-align:center;padding:40px 20px">
            <div style="font-size:3rem;line-height:1">🏢</div>
            <div style="font-size:1rem;font-weight:700;color:#4a5568">Nenhuma empresa selecionada</div>
            <div style="font-size:0.85rem;color:#a0aec0;max-width:260px;line-height:1.5">
              Escolha uma empresa na lista ao lado para visualizar e preencher as atividades do período.
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
    try { this.filiais = await this.api(`/api/empresas/${empresa.id}/filiais`); }
    catch { this.filiais = []; }

    const infoEl = document.getElementById('db-empresa-info');
    const notasEl = document.getElementById('db-notas-card');
    if (infoEl) infoEl.innerHTML = `
      <div class="empresa-nome">${empresa.nome}</div>
      <div class="empresa-badges">
        ${empresa.cnpj ? `<span class="badge badge-blue">${empresa.cnpj}</span>` : ''}
        ${empresa.codigo_interno ? `<span class="badge badge-green">${empresa.codigo_interno}</span>` : ''}
      </div>`;
    if (notasEl) notasEl.style.display = 'block';

    const colRight = document.getElementById('db-col-right');
    if (!colRight) return;

    if (this.filiais.length > 0) {
      try { this._gruposIntegrados = await this.api(`/api/empresas/${empresa.id}/grupos-integrados`); }
      catch { this._gruposIntegrados = []; }

      // Layout: atividades da matriz em cima + filiais + histórico
      colRight.innerHTML = `
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <h3 style="margin:0">✅ Atividades</h3>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:0.78rem;font-weight:600;color:#3498db;background:#ebf8ff;padding:3px 10px;border-radius:20px">📅 ${this.periodo}</span>
              <button id="btn-resetar-checklist" style="font-size:0.75rem;padding:3px 10px;background:#fff5f5;border:1px solid #fed7d7;border-radius:20px;color:#c53030;cursor:pointer;font-weight:600">🔄 Resetar</button>
            </div>
          </div>
          <div id="db-atividades-container"><div class="loading"></div></div>
        </div>
        <div id="db-filiais-section"><div class="loading">Carregando filiais...</div></div>
        <div class="card" style="margin-top:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="margin:0">📋 Histórico — <span style="color:#3498db">${this.periodo}</span></h3>
            <span class="sync-info">Auto-atualiza a cada 5s</span>
          </div>
          <div id="db-historico-lista"><div class="historico-vazio">Nenhum registro neste período</div></div>
        </div>`;

      // Carrega atividades da matriz + filiais + histórico em paralelo
      const [filialHtml] = await Promise.all([
        this.renderFiliais(empresa),
        this.carregarAtividades(),
        this.carregarHistorico()
      ]);

      const filiaisEl = document.getElementById('db-filiais-section');
      if (filiaisEl) {
        filiaisEl.innerHTML = filialHtml;
        this.configurarEventosFiliais(empresa.id);
      }
    } else {
      this._gruposIntegrados = [];
      colRight.innerHTML = this._renderColRightNormal();
      await Promise.all([this.carregarAtividades(), this.carregarHistorico()]);
    }
    await this.carregarNota();
    this._configurarBtnReset();
  }

  _configurarBtnReset() {
    const btn = document.getElementById('btn-resetar-checklist');
    if (!btn || !this.empresaSelecionada) return;
    btn.addEventListener('click', () => this._abrirModalReset());
  }

  _abrirModalReset() {
    const empresa = this.empresaSelecionada;
    if (!empresa) return;
    document.getElementById('reset-empresa-nome').textContent = empresa.nome;
    document.getElementById('reset-periodo-nome').textContent = this.periodo;
    document.getElementById('reset-grupos-area').style.display = 'none';

    const modal = document.getElementById('modal-reset');
    modal.classList.add('show');

    const btnTudo = document.getElementById('btn-reset-tudo');
    const btnGrupoToggle = document.getElementById('btn-reset-grupo-toggle');
    const btnGruposConfirmar = document.getElementById('btn-reset-grupos-confirmar');
    const closeBtn = document.getElementById('btn-modal-reset-close');

    const close = () => modal.classList.remove('show');
    closeBtn.onclick = close;
    modal.onclick = e => { if (e.target === modal) close(); };

    btnTudo.onclick = async () => {
      if (!confirm(`Resetar TODAS as atividades de ${empresa.nome} no período ${this.periodo}? Esta ação não pode ser desfeita.`)) return;
      try {
        await this.api('/api/historico/reset', {
          method: 'DELETE',
          body: JSON.stringify({ empresa_id: empresa.id, periodo: this.periodo })
        });
        close();
        await Promise.all([this.carregarAtividades(), this.carregarHistorico()]);
      } catch (e) { alert('Erro ao resetar: ' + e.message); }
    };

    btnGrupoToggle.onclick = () => {
      const area = document.getElementById('reset-grupos-area');
      if (area.style.display === 'none') {
        const grupos = [...new Set((this._atividadesEmpresa || []).filter(a => a.habilitada).map(a => a.grupo || 'Geral'))];
        const lista = document.getElementById('reset-grupos-lista');
        lista.innerHTML = grupos.map(g => `
          <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer">
            <input type="checkbox" value="${g}" style="width:15px;height:15px;cursor:pointer">
            <span style="font-size:0.85rem;font-weight:600;color:#2d3748">${g}</span>
          </label>`).join('');
        area.style.display = 'block';
      } else {
        area.style.display = 'none';
      }
    };

    btnGruposConfirmar.onclick = async () => {
      const checks = document.querySelectorAll('#reset-grupos-lista input[type=checkbox]:checked');
      const grupos = [...checks].map(c => c.value);
      if (!grupos.length) { alert('Selecione ao menos um grupo.'); return; }
      if (!confirm(`Resetar os grupos [${grupos.join(', ')}] de ${empresa.nome} no período ${this.periodo}?`)) return;
      try {
        await this.api('/api/historico/reset', {
          method: 'DELETE',
          body: JSON.stringify({ empresa_id: empresa.id, periodo: this.periodo, grupos })
        });
        close();
        await Promise.all([this.carregarAtividades(), this.carregarHistorico()]);
      } catch (e) { alert('Erro ao resetar grupos: ' + e.message); }
    };
  }

  _renderColRightNormal() {
    return `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <h3 style="margin:0">✅ Atividades</h3>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:0.78rem;font-weight:600;color:#3498db;background:#ebf8ff;padding:3px 10px;border-radius:20px">📅 ${this.periodo}</span>
            <button id="btn-resetar-checklist" style="font-size:0.75rem;padding:3px 10px;background:#fff5f5;border:1px solid #fed7d7;border-radius:20px;color:#c53030;cursor:pointer;font-weight:600">🔄 Resetar</button>
          </div>
        </div>
        <div id="db-atividades-container"><div class="loading"></div></div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <h3 style="margin:0">📋 Histórico — <span style="color:#3498db">${this.periodo}</span></h3>
          <span class="sync-info">Auto-atualiza a cada 5s</span>
        </div>
        <div id="db-historico-lista"><div class="historico-vazio">Nenhum registro neste período</div></div>
      </div>`;
  }

  async carregarAtividades() {
    if (!this.empresaSelecionada) return;
    const container = document.getElementById('db-atividades-container');
    if (!container) return;
    try {
      const empresaId = this.empresaSelecionada.id;
      const [atividades, historico] = await Promise.all([
        this.api(`/api/empresas/${empresaId}/atividades`),
        this.api(`/api/historico?empresa_id=${empresaId}&periodo=${encodeURIComponent(this.periodo)}`)
      ]);

      this._atividadesEmpresa = atividades;
      this.historicoAtual = {};
      historico.forEach(h => { this.historicoAtual[h.atividade_id] = h; });

      const okIds = new Set(historico.filter(h => h.status === 'OK').map(h => h.atividade_id));
      const naIds = new Set(historico.filter(h => h.status === 'Não Aplicável').map(h => h.atividade_id));

      const habilitadas = atividades.filter(a => a.habilitada);
      const grupos = {};
      habilitadas.forEach(a => { (grupos[a.grupo || 'Geral'] = grupos[a.grupo || 'Geral'] || []).push(a); });

      if (!habilitadas.length) {
        container.innerHTML = '<div class="atividades-vazio">Nenhuma atividade habilitada</div>';
        return;
      }

      container.innerHTML = Object.entries(grupos).map(([grupo, atvsGrupo]) => {
        const integrado = this._gruposIntegrados?.includes(grupo);
        return `
          <div style="margin-bottom:16px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:#718096;letter-spacing:0.05em">${grupo}</div>
              ${integrado ? '<span style="background:#f0fff4;color:#276749;padding:1px 8px;border-radius:10px;font-size:0.7rem;font-weight:600;border:1px solid #9ae6b4">🔗 Integrado</span>' : ''}
            </div>
            <div class="atividades-grid">
              ${atvsGrupo.map(a => `
                <button class="atividade-btn ${okIds.has(a.atividade_id) ? 'concluida' : naIds.has(a.atividade_id) ? 'na' : ''}"
                  data-id="${a.atividade_id}"
                  data-nome="${a.nome.replace(/"/g,'&quot;')}"
                  data-grupo="${a.grupo || 'Geral'}"
                  data-status="${okIds.has(a.atividade_id) ? 'OK' : naIds.has(a.atividade_id) ? 'NA' : ''}">
                  <span class="btn-codigo">${a.codigo || ''}</span>${a.nome}
                </button>`).join('')}
            </div>
          </div>`;
      }).join('');

      container.querySelectorAll('.atividade-btn').forEach(btn =>
        btn.addEventListener('click', () => this.abrirModalAtividade(btn, empresaId)));
    } catch (e) { console.error(e); }
  }

  abrirModalAtividade(btn, empresaId) {
    if (!this.usuario) { alert('Selecione um usuário primeiro (canto inferior esquerdo)'); return; }
    const atividadeId = parseInt(btn.dataset.id);
    const status = btn.dataset.status;
    const nomeAtv = btn.dataset.nome || btn.textContent.trim();
    const grupo   = btn.dataset.grupo || '';

    const empresa = this.filiais?.find(f => f.id === empresaId) || this.empresaSelecionada;
    document.getElementById('modal-atv-nome').textContent = nomeAtv;
    document.getElementById('modal-atv-empresa').textContent = empresa?.nome || '';
    document.getElementById('modal-atv-periodo').textContent = this.periodo;

    const h = this._getHistorico(atividadeId, empresaId);
    document.getElementById('modal-atv-obs').value = h?.observacao || '';

    const btns = document.getElementById('modal-atv-btns');
    btns.innerHTML = '';

    const mk = (html, styles, onClick) => {
      const b = document.createElement('button');
      b.innerHTML = html;
      b.style.cssText = `padding:10px 14px;border-radius:6px;cursor:pointer;font-size:0.85rem;font-weight:600;border:none;display:flex;align-items:center;gap:5px;${styles}`;
      b.addEventListener('click', onClick);
      return b;
    };

    btns.appendChild(mk('Cancelar', 'background:#edf2f7;color:#4a5568;', () =>
      document.getElementById('modal-atividade').classList.remove('show')));

    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    btns.appendChild(spacer);

    if (status === 'OK') {
      btns.appendChild(mk('↩ Cancelar OK', 'background:#fefcbf;color:#744210;border:1px solid #f6e05e;', () =>
        this.confirmarAtividade(atividadeId, empresaId, null, btn, grupo)));
    } else if (status === 'NA') {
      btns.appendChild(mk('↩ Cancelar N/A', 'background:#fefcbf;color:#744210;border:1px solid #f6e05e;', () =>
        this.confirmarAtividade(atividadeId, empresaId, null, btn, grupo)));
    }

    btns.appendChild(mk('<span style="color:#000;font-weight:900;font-size:1rem">✕</span> Não Aplicável',
      'background:#e74c3c;color:white;',
      () => this.confirmarAtividade(atividadeId, empresaId, 'Não Aplicável', btn, grupo)));

    btns.appendChild(mk('✓ Registrar OK', 'background:#27ae60;color:white;',
      () => this.confirmarAtividade(atividadeId, empresaId, 'OK', btn, grupo)));

    document.getElementById('btn-modal-atv-close').onclick =
      () => document.getElementById('modal-atividade').classList.remove('show');
    document.getElementById('modal-atividade').classList.add('show');
    document.getElementById('modal-atv-obs').focus();
  }

  async confirmarAtividade(atividadeId, empresaId, novoStatus, btn, grupo) {
    const obs = document.getElementById('modal-atv-obs').value.trim();
    document.getElementById('modal-atividade').classList.remove('show');

    const isMatriz = empresaId === this.empresaSelecionada?.id;
    const h = this._getHistorico(atividadeId, empresaId);

    try {
      if (h) {
        await this.api(`/api/historico/${h.id}`, { method: 'DELETE' });
        this._setHistorico(atividadeId, empresaId, null);
        btn.classList.remove('concluida', 'na');
        btn.dataset.status = '';
      }

      if (novoStatus === null) {
        if (isMatriz) await this.carregarHistorico();
        return;
      }

      const novo = await this.api('/api/historico', {
        method: 'POST',
        body: JSON.stringify({ empresa_id: empresaId, atividade_id: atividadeId,
          periodo: this.periodo, usuario: this.usuario, status: novoStatus, observacao: obs })
      });
      this._setHistorico(atividadeId, empresaId, novo);

      btn.classList.toggle('concluida', novoStatus === 'OK');
      btn.classList.toggle('na', novoStatus === 'Não Aplicável');
      btn.dataset.status = novoStatus === 'OK' ? 'OK' : 'NA';

      // Propagar para filiais se grupo integrado e é a empresa matriz
      if (isMatriz && this.filiais?.length > 0 && grupo && this._gruposIntegrados?.includes(grupo)) {
        await this._propagarGrupoIntegrado(atividadeId, novoStatus, obs);
      }

      if (isMatriz) await this.carregarHistorico();
      else this._atualizarProgressoFilial(btn, empresaId);

    } catch (e) { console.error(e); alert('Erro ao registrar: ' + e.message); }
  }

  _getHistorico(atividadeId, empresaId) {
    if (empresaId === this.empresaSelecionada?.id) return this.historicoAtual[atividadeId];
    return (this._historicoFiliais[empresaId] || {})[atividadeId];
  }

  _setHistorico(atividadeId, empresaId, h) {
    if (empresaId === this.empresaSelecionada?.id) {
      if (h) this.historicoAtual[atividadeId] = h;
      else delete this.historicoAtual[atividadeId];
    } else {
      if (!this._historicoFiliais[empresaId]) this._historicoFiliais[empresaId] = {};
      if (h) this._historicoFiliais[empresaId][atividadeId] = h;
      else delete this._historicoFiliais[empresaId][atividadeId];
    }
  }

  async _propagarGrupoIntegrado(atividadeId, status, obs) {
    for (const filial of this.filiais) {
      try {
        const hf = this._getHistorico(atividadeId, filial.id);
        if (hf) {
          await this.api(`/api/historico/${hf.id}`, { method: 'DELETE' });
          this._setHistorico(atividadeId, filial.id, null);
        }
        if (status) {
          const novo = await this.api('/api/historico', {
            method: 'POST',
            body: JSON.stringify({ empresa_id: filial.id, atividade_id: atividadeId,
              periodo: this.periodo, usuario: this.usuario, status, observacao: obs })
          });
          this._setHistorico(atividadeId, filial.id, novo);
          const filialBtn = document.querySelector(
            `.filial-atv-btn[data-id="${atividadeId}"][data-empresa-id="${filial.id}"]`);
          if (filialBtn) {
            filialBtn.classList.toggle('concluida', status === 'OK');
            filialBtn.classList.toggle('na', status === 'Não Aplicável');
            filialBtn.dataset.status = status === 'OK' ? 'OK' : 'NA';
            this._atualizarProgressoFilial(filialBtn, filial.id);
          }
        }
      } catch (ef) { console.error('Erro propagando filial:', ef); }
    }
  }

  _atualizarProgressoFilial(btn, empresaId) {
    const bloco = btn.closest('.filial-bloco');
    if (!bloco) return;
    const hist = this._historicoFiliais[empresaId] || {};
    const habilitadas = (this._atividadesEmpresa || []).filter(a => a.habilitada);
    const total = habilitadas.length;
    const ok = Object.values(hist).filter(h => h.status === 'OK' || h.status === 'Não Aplicável').length;
    const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
    const badge = bloco.querySelector('.filial-pct-badge');
    if (badge) {
      const cor = pct === 100 ? '#27ae60' : pct >= 50 ? '#e67e22' : '#e74c3c';
      badge.textContent = `${pct}% (${ok}/${total})`;
      badge.style.color = cor;
      badge.style.background = pct === 100 ? '#f0fff4' : '#fff5f5';
      badge.style.borderColor = pct === 100 ? '#9ae6b4' : '#fed7d7';
    }
  }

  // ── Filiais ────────────────────────────────────────────────────────────────
  async renderFiliais(empresa) {
    try {
      const [atividades, ...historicoFiliais] = await Promise.all([
        this.api(`/api/empresas/${empresa.id}/atividades`),
        ...this.filiais.map(f =>
          this.api(`/api/historico?empresa_id=${f.id}&periodo=${encodeURIComponent(this.periodo)}`).catch(() => []))
      ]);

      this._atividadesEmpresa = atividades;
      this._historicoFiliais = {};
      const habilitadas = atividades.filter(a => a.habilitada);
      const grupos = [...new Set(habilitadas.map(a => a.grupo || 'Geral'))].sort();

      const filiaisData = this.filiais.map((f, i) => {
        const hist = historicoFiliais[i] || [];
        this._historicoFiliais[f.id] = {};
        hist.forEach(h => { this._historicoFiliais[f.id][h.atividade_id] = h; });
        const ok = hist.filter(h => h.status === 'OK' || h.status === 'Não Aplicável').length;
        const total = habilitadas.length;
        const pct = total > 0 ? Math.round((ok / total) * 100) : 0;
        const okIds = new Set(hist.filter(h => h.status === 'OK').map(h => h.atividade_id));
        const naIds = new Set(hist.filter(h => h.status === 'Não Aplicável').map(h => h.atividade_id));
        return { ...f, ok, total, pct, okIds, naIds };
      });

      const gi = this._gruposIntegrados;
      return `
        <div class="card" style="padding:0;overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #f0f0f0">
            <div style="display:flex;align-items:center;gap:8px">
              <span>🏢</span>
              <span style="font-weight:700;text-transform:uppercase;font-size:0.78rem;color:#718096;letter-spacing:.05em">
                FILIAIS (${this.filiais.length})
              </span>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" id="btn-sincronizar-filiais">⟳ Sincronizar Filiais</button>
              <button class="btn btn-sm" id="btn-configurar-grupos">⚙ Configurar grupos</button>
            </div>
          </div>
          ${gi.length ? `
          <div style="padding:8px 20px;background:#f0fff4;border-bottom:1px solid #c6f6d5;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:0.75rem;font-weight:700;color:#276749">Grupos integrados</span>
            <span style="font-size:0.72rem;color:#718096">(registrados na matriz — valem para todas as filiais):</span>
            ${gi.map(g => `<span style="background:#ebf8ff;color:#2b6cb0;padding:2px 10px;border-radius:10px;font-size:0.74rem;font-weight:600">${g}</span>`).join('')}
          </div>` : ''}
          <div id="filiais-lista" style="max-height:calc(100vh - 240px);overflow-y:auto">
            ${filiaisData.map(f => {
              const cor = f.pct === 100 ? '#27ae60' : f.pct >= 50 ? '#e67e22' : '#e74c3c';
              return `
                <div class="filial-bloco" data-filial-id="${f.id}">
                  <div class="filial-header" style="display:flex;align-items:center;gap:10px;padding:12px 20px;cursor:pointer;border-bottom:1px solid #f0f0f0">
                    <span class="filial-arrow" style="color:#a0aec0;font-size:0.7rem;transition:transform .2s;flex-shrink:0">▶</span>
                    <div style="flex:1;min-width:0">
                      <span style="font-weight:600;font-size:0.85rem">${f.nome}</span>
                      ${f.codigo_interno ? `<span style="margin-left:8px;background:#edf2f7;color:#4a5568;padding:1px 7px;border-radius:4px;font-size:0.72rem;font-weight:700">${f.codigo_interno}</span>` : ''}
                    </div>
                    <span class="filial-pct-badge" style="background:${f.pct===100?'#f0fff4':'#fff5f5'};color:${cor};border:1px solid ${f.pct===100?'#9ae6b4':'#fed7d7'};padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:700;white-space:nowrap;flex-shrink:0">
                      ${f.pct}% (${f.ok}/${f.total})
                    </span>
                  </div>
                  <div class="filial-body" style="display:none;padding:14px 20px;background:#fafafa;border-bottom:1px solid #f0f0f0">
                    ${grupos.map(grupo => {
                      const atvsGrupo = habilitadas.filter(a => (a.grupo || 'Geral') === grupo);
                      return `
                        <div style="margin-bottom:14px">
                          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:#718096;margin-bottom:6px;letter-spacing:.05em">${grupo}</div>
                          <div class="atividades-grid">
                            ${atvsGrupo.map(a => `
                              <button class="atividade-btn filial-atv-btn ${f.okIds.has(a.atividade_id)?'concluida':f.naIds.has(a.atividade_id)?'na':''}"
                                data-id="${a.atividade_id}"
                                data-empresa-id="${f.id}"
                                data-nome="${a.nome.replace(/"/g,'&quot;')}"
                                data-grupo="${a.grupo||'Geral'}"
                                data-status="${f.okIds.has(a.atividade_id)?'OK':f.naIds.has(a.atividade_id)?'NA':''}">
                                <span class="btn-codigo">${a.codigo||''}</span>${a.nome}
                              </button>`).join('')}
                          </div>
                        </div>`;
                    }).join('')}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    } catch (e) { return `<div class="loading">Erro ao carregar filiais: ${e.message}</div>`; }
  }

  configurarEventosFiliais(matrizId) {
    document.querySelectorAll('.filial-header').forEach(header => {
      header.addEventListener('click', () => {
        const bloco = header.closest('.filial-bloco');
        const body  = bloco.querySelector('.filial-body');
        const arrow = header.querySelector('.filial-arrow');
        const open  = body.style.display !== 'none';
        body.style.display  = open ? 'none' : 'block';
        arrow.style.transform = open ? '' : 'rotate(90deg)';
      });
    });

    document.querySelectorAll('.filial-atv-btn').forEach(btn =>
      btn.addEventListener('click', () => this.abrirModalAtividade(btn, parseInt(btn.dataset.empresaId))));

    document.getElementById('btn-sincronizar-filiais')?.addEventListener('click', async () => {
      if (!this.usuario) { alert('Selecione um usuário primeiro'); return; }
      if (!confirm(`Sincronizar tudo da matriz para as ${this.filiais.length} filial(ais) no período ${this.periodo}?`)) return;
      try {
        const r = await this.api(`/api/empresas/${matrizId}/sincronizar`, {
          method: 'POST',
          body: JSON.stringify({ periodo: this.periodo, usuario: this.usuario })
        });
        alert(`${r.sincronizados} atividade(s) sincronizada(s)!`);
        await this.selecionarEmpresa(this.empresaSelecionada);
      } catch (e) { alert('Erro: ' + e.message); }
    });

    document.getElementById('btn-configurar-grupos')?.addEventListener('click', () =>
      this.abrirConfigurarGrupos(matrizId));
  }

  async abrirConfigurarGrupos(matrizId) {
    const grupos = [...new Set((this._atividadesEmpresa || []).filter(a => a.habilitada).map(a => a.grupo || 'Geral'))].sort();
    const lista = document.getElementById('modal-grupos-lista');
    lista.innerHTML = grupos.map(g => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">
        <div>
          <div style="font-weight:600;font-size:0.9rem">${g}</div>
          <div style="font-size:0.74rem;color:#718096">Ao marcar na matriz → marca nas filiais automaticamente</div>
        </div>
        <label class="toggle-ativo" style="margin:0">
          <input type="checkbox" class="grupo-toggle" data-grupo="${g}" ${this._gruposIntegrados.includes(g)?'checked':''}>
          <span class="toggle-slider"></span>
        </label>
      </div>`).join('');

    const salvarBtn = document.getElementById('btn-salvar-grupos');
    salvarBtn.onclick = async () => {
      const selecionados = [...document.querySelectorAll('.grupo-toggle:checked')].map(cb => cb.dataset.grupo);
      try {
        this._gruposIntegrados = await this.api(`/api/empresas/${matrizId}/grupos-integrados`, {
          method: 'PUT', body: JSON.stringify({ grupos: selecionados })
        });
        document.getElementById('modal-grupos').classList.remove('show');
        await this.selecionarEmpresa(this.empresaSelecionada);
      } catch (e) { alert('Erro: ' + e.message); }
    };

    document.getElementById('btn-modal-grupos-close').onclick =
      () => document.getElementById('modal-grupos').classList.remove('show');
    document.getElementById('modal-grupos').classList.add('show');
  }

  async carregarHistorico() {
    if (!this.empresaSelecionada) return;
    try {
      const historico = await this.api(`/api/historico?empresa_id=${this.empresaSelecionada.id}&periodo=${encodeURIComponent(this.periodo)}`);
      const container = document.getElementById('db-historico-lista');
      if (!container) return;

      // Atualiza o label "Atualizado HH:MM" no cabeçalho
      const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const syncEl = document.querySelector('.sync-info');
      if (syncEl) syncEl.textContent = `Atualizado ${agora}`;

      if (!historico.length) {
        container.innerHTML = '<div class="historico-vazio">Nenhum registro neste período</div>';
        return;
      }

      container.innerHTML = historico.map(h => {
        const isOK = h.status === 'OK';
        const badge = isOK
          ? `<span class="hi-badge hi-badge-ok">✅ OK</span>`
          : `<span class="hi-badge hi-badge-na">❌ N/A</span>`;
        const obs = h.observacao
          ? ` · <em class="hi-obs-inline">"${h.observacao}"</em>`
          : '';
        return `
          <div class="historico-item" data-hist-id="${h.id}" data-atv-id="${h.atividade_id}">
            <div class="hi-linha1">
              <span class="hi-atividade">${h.atividade_nome || '—'}</span>
              ${badge}
              <span class="hi-spacer"></span>
              <span class="hi-data">${h.data || ''}</span>
              <button class="hi-del" data-id="${h.id}" title="Remover registro">×</button>
            </div>
            <div class="hi-linha2">por <strong>${h.usuario}</strong>${obs}</div>
          </div>`;
      }).join('');

      // Bind botões de remover
      container.querySelectorAll('.hi-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          const histId  = parseInt(btn.dataset.id);
          const item    = btn.closest('.historico-item');
          const atvId   = parseInt(item?.dataset.atvId);
          try {
            await this.api(`/api/historico/${histId}`, { method: 'DELETE' });
            item?.remove();
            // Desmarca o botão de atividade correspondente
            const atvBtn = document.querySelector(`.atividade-btn[data-id="${atvId}"]`);
            if (atvBtn) {
              atvBtn.classList.remove('concluida', 'na');
              atvBtn.dataset.status = '';
              delete this.historicoAtual[atvId];
            }
            if (!container.querySelector('.historico-item'))
              container.innerHTML = '<div class="historico-vazio">Nenhum registro neste período</div>';
          } catch (e) { console.error(e); }
        });
      });

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
      this._todasAtividades = atividades.filter(a => a.ativo);
      const grupos = [...new Set(this._todasAtividades.map(a => a.grupo || 'Geral'))].sort();

      return `
        <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start">

          <!-- Lista agrupada -->
          <div class="card" style="padding:0;overflow:hidden">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #f0f0f0">
              <div style="display:flex;align-items:center;gap:8px">
                <span>📋</span>
                <span style="font-weight:700;text-transform:uppercase;font-size:0.75rem;color:#718096;letter-spacing:.05em">Atividades</span>
              </div>
              <button class="btn btn-primary" id="btn-nova-atv" style="font-size:0.82rem;padding:6px 14px">+ Nova</button>
            </div>
            <div id="atv-lista" style="max-height:calc(100vh - 200px);overflow-y:auto">
              ${grupos.map(grupo => {
                const atvsGrupo = this._todasAtividades.filter(a => (a.grupo || 'Geral') === grupo);
                return `
                  <div class="atv-grupo-bloco">
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;border-top:1px solid #e2e8f0">
                      <span style="font-weight:700;font-size:0.82rem;text-transform:uppercase;letter-spacing:.04em;color:#4a5568">
                        ${grupo} <span style="color:#a0aec0;font-weight:400">(${atvsGrupo.length})</span>
                      </span>
                      <button class="btn btn-sm btn-excluir-grupo" data-grupo="${grupo}"
                        style="background:#fff5f5;border-color:#fed7d7;color:#c53030;font-size:0.72rem;padding:3px 10px">
                        🗑 Excluir grupo
                      </button>
                    </div>
                    ${atvsGrupo.map(a => `
                      <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 20px;border-bottom:1px solid #f7f7f7">
                        <span style="font-size:0.88rem;color:#2d3748">${a.nome}</span>
                        <div style="display:flex;gap:5px">
                          <button class="btn btn-sm btn-editar-atv"
                            data-id="${a.id}" data-nome="${a.nome.replace(/"/g,'&quot;')}" data-grupo="${grupo}"
                            style="padding:4px 8px;background:#fefcbf;border-color:#f6e05e;color:#744210">✏️</button>
                          <button class="btn btn-sm btn-excluir-atv"
                            data-id="${a.id}" data-nome="${a.nome.replace(/"/g,'&quot;')}"
                            style="padding:4px 8px;background:#fff5f5;border-color:#fed7d7;color:#c53030">❌</button>
                        </div>
                      </div>`).join('')}
                  </div>`;
              }).join('')}
              ${grupos.length === 0 ? '<div style="padding:40px;text-align:center;color:#718096">Nenhuma atividade cadastrada</div>' : ''}
            </div>
          </div>

          <!-- Formulário -->
          <div class="card" style="position:sticky;top:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
              <span>➕</span>
              <span id="atv-form-titulo" style="font-weight:700;text-transform:uppercase;font-size:0.75rem;color:#718096;letter-spacing:.05em">Nova Atividade</span>
            </div>
            <input type="hidden" id="atv-id">

            <div style="margin-bottom:14px">
              <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Nome da atividade *</label>
              <input id="atv-nome" type="text" placeholder="Ex: Banco"
                style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.9rem">
            </div>

            <div style="margin-bottom:20px">
              <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Grupo</label>
              <input id="atv-grupo" type="text" placeholder="Ex: Conciliação" list="atv-grupos-list"
                style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.9rem">
              <datalist id="atv-grupos-list">
                ${grupos.map(g => `<option value="${g}">`).join('')}
              </datalist>
            </div>

            <div style="display:flex;gap:8px">
              <button class="btn btn-primary" id="btn-salvar-atv" style="flex:1;padding:10px">💾 Salvar</button>
              <button class="btn" id="btn-limpar-atv" style="padding:10px 16px">Limpar</button>
            </div>
          </div>
        </div>`;
    } catch { return `<div class="loading">Erro ao carregar atividades</div>`; }
  }

  configurarEventosAtividades() {
    const limparForm = () => {
      document.getElementById('atv-id').value = '';
      document.getElementById('atv-nome').value = '';
      document.getElementById('atv-grupo').value = '';
      document.getElementById('atv-form-titulo').textContent = 'Nova Atividade';
      document.getElementById('atv-nome').focus();
    };

    document.getElementById('btn-nova-atv')?.addEventListener('click', limparForm);
    document.getElementById('btn-limpar-atv')?.addEventListener('click', limparForm);

    // Salvar (criar ou editar)
    document.getElementById('btn-salvar-atv')?.addEventListener('click', async () => {
      const id = document.getElementById('atv-id').value;
      const nome = document.getElementById('atv-nome').value.trim();
      const grupo = document.getElementById('atv-grupo').value.trim() || 'Geral';
      if (!nome) { alert('Nome da atividade é obrigatório'); return; }
      try {
        if (id) {
          await this.api(`/api/atividades/${id}`, { method: 'PUT', body: JSON.stringify({ nome, grupo }) });
        } else {
          await this.api('/api/atividades', { method: 'POST', body: JSON.stringify({ nome, grupo }) });
        }
        await this.mudarTab('atividades');
      } catch (e) { alert('Erro ao salvar: ' + e.message); }
    });

    // Editar — preenche o formulário
    document.querySelectorAll('.btn-editar-atv').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('atv-id').value = btn.dataset.id;
        document.getElementById('atv-nome').value = btn.dataset.nome;
        document.getElementById('atv-grupo').value = btn.dataset.grupo;
        document.getElementById('atv-form-titulo').textContent = 'Editar Atividade';
        document.getElementById('atv-nome').focus();
      });
    });

    // Excluir atividade individual
    document.querySelectorAll('.btn-excluir-atv').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Excluir "${btn.dataset.nome}"?`)) return;
        try {
          await this.api(`/api/atividades/${btn.dataset.id}`, { method: 'PUT', body: JSON.stringify({ ativo: false }) });
          await this.mudarTab('atividades');
        } catch (e) { alert('Erro: ' + e.message); }
      });
    });

    // Excluir grupo inteiro
    document.querySelectorAll('.btn-excluir-grupo').forEach(btn => {
      btn.addEventListener('click', async () => {
        const grupo = btn.dataset.grupo;
        const atvsGrupo = this._todasAtividades.filter(a => (a.grupo || 'Geral') === grupo);
        if (!confirm(`Excluir o grupo "${grupo}" e suas ${atvsGrupo.length} atividade(s)?`)) return;
        try {
          await Promise.all(atvsGrupo.map(a =>
            this.api(`/api/atividades/${a.id}`, { method: 'PUT', body: JSON.stringify({ ativo: false }) })
          ));
          await this.mudarTab('atividades');
        } catch (e) { alert('Erro: ' + e.message); }
      });
    });
  }

  // ── Empresas ──────────────────────────────────────────────────────────────
  _REGIMES = ['Simples Nacional','Lucro Presumido','Lucro Real','MEI','Outro','Imune/Isento'];

  async renderEmpresas() {
    try {
      const empresas = await this.api('/api/empresas/todas');
      this._todasEmpresas = empresas;
      this._filtroMov = 'todos';
      this._filtroRegime = '';
      this._filtroSegmento = '';
      this._filtroTexto = '';
      const segmentos = [...new Set(empresas.map(e => e.segmento).filter(Boolean))].sort();

      return `
        <div class="card" style="padding:16px 20px;margin-bottom:12px">
          <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
            <div style="flex:1;position:relative">
              <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#a0aec0">🔍</span>
              <input id="emp-search" type="text" placeholder="Filtrar por nome, código, CNPJ, município..."
                style="width:100%;padding:9px 12px 9px 36px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.88rem">
            </div>
            <button class="btn btn-primary" id="btn-nova-empresa" style="white-space:nowrap;padding:9px 18px">+ Nova Empresa</button>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-size:0.8rem;color:#718096;font-weight:600">Filtros:</span>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm emp-filtro-mov" data-mov="todos"
                style="padding:4px 12px;font-size:0.78rem;background:#3498db;color:white;border-color:#3498db">Todos</button>
              <button class="btn btn-sm emp-filtro-mov" data-mov="com"
                style="padding:4px 12px;font-size:0.78rem">✅ Com movimento</button>
              <button class="btn btn-sm emp-filtro-mov" data-mov="sem"
                style="padding:4px 12px;font-size:0.78rem">○ Sem movimento</button>
            </div>
            <select id="emp-filtro-regime" style="padding:5px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.8rem">
              <option value="">Todos os Regimes</option>
              ${this._REGIMES.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
            <select id="emp-filtro-segmento" style="padding:5px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:0.8rem">
              <option value="">Todos os Segmentos</option>
              ${segmentos.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <button id="btn-limpar-filtros" class="btn btn-sm"
              style="padding:4px 12px;font-size:0.78rem;color:#718096">✕ Limpar filtros</button>
          </div>
        </div>

        <div id="emp-lista-wrapper" class="card" style="padding:0;overflow:hidden">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid #f0f0f0">
            <div style="display:flex;align-items:center;gap:8px">
              <span>🏢</span>
              <span style="font-weight:700;text-transform:uppercase;font-size:0.75rem;color:#718096;letter-spacing:.05em">Empresas Cadastradas</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <button id="btn-excluir-selecionadas" class="btn btn-sm"
                style="display:none;background:#fff5f5;border-color:#fed7d7;color:#c53030;font-size:0.78rem">
                🗑 Excluir selecionadas (<span id="count-sel">0</span>)
              </button>
              <span id="emp-count" style="font-size:0.8rem;color:#718096">-- de ${empresas.length}</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:36px 80px 1fr 155px 130px 145px 110px 75px;padding:8px 20px;background:#f8fafc;border-bottom:1px solid #f0f0f0">
            <div><input type="checkbox" id="emp-select-all" title="Selecionar todos"></div>
            ${['Código','Nome','CNPJ','Regime','Município','Movimento','Ações'].map(h =>
              `<span style="font-size:0.7rem;font-weight:700;text-transform:uppercase;color:#a0aec0">${h}</span>`).join('')}
          </div>
          <div id="emp-tbody" style="max-height:calc(100vh - 340px);overflow-y:auto"></div>
        </div>

        <div id="emp-form-wrapper" style="display:none">
          <div class="card" style="max-width:720px">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
              <button class="btn btn-sm" id="btn-voltar-emp">← Voltar</button>
              <span id="emp-form-titulo" style="font-weight:700;text-transform:uppercase;font-size:0.8rem;color:#718096;letter-spacing:.05em">Nova Empresa</span>
            </div>
            <input type="hidden" id="emp-id">

            <div style="margin-bottom:14px">
              <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Nome da Empresa *</label>
              <input id="emp-nome" type="text" placeholder="Ex: BRAVO DISTRIBUIDORA LTDA"
                style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.9rem">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
              <div>
                <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Código Interno</label>
                <input id="emp-codigo" type="text" placeholder="Ex: BRV001"
                  style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.9rem">
              </div>
              <div>
                <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">CNPJ</label>
                <input id="emp-cnpj" type="text" placeholder="00.000.000/0000-00"
                  style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.9rem">
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
              <div>
                <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">
                  Inscrição Estadual
                  <span id="ie-isento-badge" style="display:none;background:#fef3c7;color:#d97706;padding:1px 7px;border-radius:10px;font-size:0.72rem;font-weight:600;margin-left:6px">Isento</span>
                </label>
                <input id="emp-ie" type="text" placeholder="0 (Isento) ou número da IE..."
                  style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.9rem">
              </div>
              <div>
                <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Regime Tributário</label>
                <select id="emp-regime" style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.9rem">
                  <option value="">— Selecionar —</option>
                  ${this._REGIMES.map(r => `<option value="${r}">${r}</option>`).join('')}
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
              <div>
                <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Município</label>
                <input id="emp-municipio" type="text" placeholder="Ex: Cuiabá - MT"
                  style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.9rem">
              </div>
              <div>
                <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Segmento / Atividade</label>
                <input id="emp-segmento" type="text" placeholder="Ex: Comércio Varejista, Prest. de Serviços..."
                  style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.9rem">
              </div>
            </div>

            <div style="margin-bottom:14px">
              <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">E-mail</label>
              <input id="emp-email" type="email" placeholder="contato@empresa.com.br"
                style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.9rem">
            </div>

            <div style="margin-bottom:14px">
              <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">
                Empresa Matriz <span style="color:#718096;font-weight:400">(opcional — preencha se esta empresa é uma filial)</span>
              </label>
              <div style="position:relative">
                <input id="emp-matriz-search" type="text" placeholder="Buscar empresa matriz..."
                  style="width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.9rem">
                <div id="emp-matriz-results" class="search-results" style="position:absolute;top:100%;left:0;right:0;z-index:100"></div>
              </div>
              <div id="emp-matriz-sel" style="display:none;margin-top:6px;padding:8px 12px;background:#ebf8ff;border:1px solid #bee3f8;border-radius:6px;align-items:center;justify-content:space-between">
                <span id="emp-matriz-nome" style="font-size:0.85rem;color:#2b6cb0;font-weight:600"></span>
                <button id="btn-remover-matriz" style="background:none;border:none;color:#c53030;cursor:pointer;font-size:1.1rem;line-height:1">×</button>
              </div>
              <input type="hidden" id="emp-matriz-id">
            </div>

            <div style="margin-bottom:20px;display:flex;align-items:center;gap:10px">
              <label class="toggle-ativo">
                <input id="emp-com-movimento" type="checkbox">
                <span class="toggle-slider"></span>
              </label>
              <span style="font-size:0.88rem;color:#4a5568">Com movimento
                <span style="color:#718096;font-size:0.78rem">(empresa ativa com movimentações)</span></span>
            </div>

            <div style="display:flex;gap:10px">
              <button class="btn btn-primary" id="btn-salvar-empresa" style="padding:10px 24px">
                🏢 <span id="btn-emp-txt">Criar Empresa</span>
              </button>
              <button class="btn" id="btn-cancelar-empresa" style="padding:10px 24px">Cancelar</button>
            </div>
          </div>
        </div>`;
    } catch { return `<div class="loading">Erro ao carregar empresas</div>`; }
  }

  _renderEmpresaLinha(e) {
    return `
      <div class="emp-row" style="display:grid;grid-template-columns:36px 80px 1fr 155px 130px 145px 110px 75px;align-items:center;padding:11px 20px;border-bottom:1px solid #f7f7f7">
        <div><input type="checkbox" class="emp-check" data-id="${e.id}"></div>
        <div><span style="background:#edf2f7;color:#4a5568;padding:2px 8px;border-radius:4px;font-size:0.73rem;font-weight:700">${e.codigo_interno || '-'}</span></div>
        <div>
          <div style="font-weight:600;font-size:0.86rem">${e.nome}</div>
          <div style="font-size:0.72rem;color:#718096">${e.segmento || ''}</div>
        </div>
        <div style="font-size:0.8rem;color:#4a5568">${e.cnpj || '-'}</div>
        <div>${e.regime_tributario ? `<span style="background:#ebf8ff;color:#2b6cb0;padding:2px 8px;border-radius:12px;font-size:0.72rem;font-weight:600">${e.regime_tributario}</span>` : '-'}</div>
        <div style="font-size:0.8rem;color:#4a5568">${e.municipio || '-'}</div>
        <div style="font-size:0.8rem">${e.com_movimento ? '<span style="color:#27ae60">● Com mov.</span>' : '<span style="color:#a0aec0">○ Sem mov.</span>'}</div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-sm btn-editar-emp" data-id="${e.id}"
            style="padding:4px 8px;background:#fefcbf;border-color:#f6e05e;color:#744210" title="Editar">✏️</button>
          <button class="btn btn-sm btn-excluir-emp" data-id="${e.id}" data-nome="${e.nome.replace(/"/g,'')}"
            style="padding:4px 8px;background:#fff5f5;border-color:#fed7d7;color:#c53030" title="Excluir">❌</button>
        </div>
      </div>`;
  }

  _filtrarEmpresas() {
    const txt = this._filtroTexto.toLowerCase();
    return (this._todasEmpresas || []).filter(e => {
      if (!e.ativo) return false;
      if (txt && !`${e.nome} ${e.codigo_interno} ${e.cnpj} ${e.municipio}`.toLowerCase().includes(txt)) return false;
      if (this._filtroMov === 'com' && !e.com_movimento) return false;
      if (this._filtroMov === 'sem' && e.com_movimento) return false;
      if (this._filtroRegime && e.regime_tributario !== this._filtroRegime) return false;
      if (this._filtroSegmento && e.segmento !== this._filtroSegmento) return false;
      return true;
    });
  }

  _renderizarLista() {
    const lista = this._filtrarEmpresas();
    const tbody = document.getElementById('emp-tbody');
    const count = document.getElementById('emp-count');
    if (!tbody) return;
    tbody.innerHTML = lista.length
      ? lista.map(e => this._renderEmpresaLinha(e)).join('')
      : '<div style="padding:40px;text-align:center;color:#718096">Nenhuma empresa encontrada</div>';
    if (count) count.textContent = `${lista.length} de ${this._todasEmpresas.length}`;
    this._bindLinhaEventos();
  }

  _bindLinhaEventos() {
    document.querySelectorAll('.emp-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const sels = document.querySelectorAll('.emp-check:checked');
        const btn = document.getElementById('btn-excluir-selecionadas');
        const cnt = document.getElementById('count-sel');
        if (btn) btn.style.display = sels.length ? 'inline-flex' : 'none';
        if (cnt) cnt.textContent = sels.length;
      });
    });

    document.querySelectorAll('.btn-editar-emp').forEach(btn => {
      btn.addEventListener('click', () => {
        const emp = this._todasEmpresas.find(e => e.id == btn.dataset.id);
        if (!emp) return;
        this._preencherFormEmpresa(emp);
        this._mostrarFormEmpresa();
      });
    });

    document.querySelectorAll('.btn-excluir-emp').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Excluir "${btn.dataset.nome}"?`)) return;
        try {
          await this.api(`/api/empresas/${btn.dataset.id}`, { method: 'DELETE' });
          this._todasEmpresas = this._todasEmpresas.filter(e => e.id != btn.dataset.id);
          this._renderizarLista();
        } catch (e) { alert('Erro: ' + e.message); }
      });
    });
  }

  _mostrarFormEmpresa() {
    document.getElementById('emp-lista-wrapper').style.display = 'none';
    document.getElementById('emp-form-wrapper').style.display = 'block';
  }

  _mostrarListaEmpresas() {
    document.getElementById('emp-lista-wrapper').style.display = 'block';
    document.getElementById('emp-form-wrapper').style.display = 'none';
  }

  _preencherFormEmpresa(emp) {
    document.getElementById('emp-id').value = emp.id;
    document.getElementById('emp-nome').value = emp.nome || '';
    document.getElementById('emp-codigo').value = emp.codigo_interno || '';
    document.getElementById('emp-cnpj').value = emp.cnpj || '';
    document.getElementById('emp-ie').value = emp.inscricao_estadual || '';
    document.getElementById('emp-regime').value = emp.regime_tributario || '';
    document.getElementById('emp-municipio').value = emp.municipio || '';
    document.getElementById('emp-segmento').value = emp.segmento || '';
    document.getElementById('emp-email').value = emp.email || '';
    document.getElementById('emp-com-movimento').checked = !!emp.com_movimento;
    document.getElementById('emp-matriz-id').value = emp.matriz_id || '';
    document.getElementById('emp-form-titulo').textContent = 'Editar Empresa';
    // Aplicar máscara CNPJ ao pré-preencher
    const cnpjEl = document.getElementById('emp-cnpj');
    if (cnpjEl) cnpjEl.dispatchEvent(new Event('input'));
    // Badge isento
    const badge = document.getElementById('ie-isento-badge');
    if (badge) badge.style.display = emp.inscricao_estadual === '0' ? 'inline' : 'none';
    document.getElementById('btn-emp-txt').textContent = 'Salvar Alterações';

    const matrizSel = document.getElementById('emp-matriz-sel');
    if (emp.matriz_id) {
      const matriz = this._todasEmpresas.find(e => e.id === emp.matriz_id);
      if (matriz) {
        document.getElementById('emp-matriz-nome').textContent = matriz.nome;
        document.getElementById('emp-matriz-search').value = '';
        matrizSel.style.display = 'flex';
      }
    } else {
      matrizSel.style.display = 'none';
      document.getElementById('emp-matriz-search').value = '';
    }
  }

  _limparFormEmpresa() {
    document.getElementById('emp-id').value = '';
    document.getElementById('emp-nome').value = '';
    document.getElementById('emp-codigo').value = '';
    document.getElementById('emp-cnpj').value = '';
    document.getElementById('emp-ie').value = '';
    document.getElementById('emp-regime').value = '';
    document.getElementById('emp-municipio').value = '';
    document.getElementById('emp-segmento').value = '';
    document.getElementById('emp-email').value = '';
    document.getElementById('emp-com-movimento').checked = false;
    document.getElementById('emp-matriz-id').value = '';
    document.getElementById('emp-matriz-search').value = '';
    document.getElementById('emp-matriz-sel').style.display = 'none';
    document.getElementById('emp-form-titulo').textContent = 'Nova Empresa';
    document.getElementById('btn-emp-txt').textContent = 'Criar Empresa';
  }

  configurarEventosEmpresas() {
    this._renderizarLista();

    // Pesquisa
    let tSearch;
    document.getElementById('emp-search')?.addEventListener('input', e => {
      clearTimeout(tSearch);
      tSearch = setTimeout(() => { this._filtroTexto = e.target.value.trim(); this._renderizarLista(); }, 250);
    });

    // Filtros de movimento
    document.querySelectorAll('.emp-filtro-mov').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.emp-filtro-mov').forEach(b => {
          b.style.background = ''; b.style.color = ''; b.style.borderColor = '';
        });
        btn.style.background = '#3498db'; btn.style.color = 'white'; btn.style.borderColor = '#3498db';
        this._filtroMov = btn.dataset.mov;
        this._renderizarLista();
      });
    });

    document.getElementById('emp-filtro-regime')?.addEventListener('change', e => {
      this._filtroRegime = e.target.value; this._renderizarLista();
    });
    document.getElementById('emp-filtro-segmento')?.addEventListener('change', e => {
      this._filtroSegmento = e.target.value; this._renderizarLista();
    });

    // Limpar todos os filtros
    document.getElementById('btn-limpar-filtros')?.addEventListener('click', () => {
      this._filtroTexto = '';
      this._filtroMov = 'todos';
      this._filtroRegime = '';
      this._filtroSegmento = '';
      document.getElementById('emp-search').value = '';
      document.getElementById('emp-filtro-regime').value = '';
      document.getElementById('emp-filtro-segmento').value = '';
      document.querySelectorAll('.emp-filtro-mov').forEach(b => {
        b.style.background = ''; b.style.color = ''; b.style.borderColor = '';
      });
      const btnTodos = document.querySelector('.emp-filtro-mov[data-mov="todos"]');
      if (btnTodos) { btnTodos.style.background = '#3498db'; btnTodos.style.color = 'white'; btnTodos.style.borderColor = '#3498db'; }
      this._renderizarLista();
    });

    // Select all
    document.getElementById('emp-select-all')?.addEventListener('change', e => {
      document.querySelectorAll('.emp-check').forEach(cb => { cb.checked = e.target.checked; cb.dispatchEvent(new Event('change')); });
    });

    // Excluir selecionadas
    document.getElementById('btn-excluir-selecionadas')?.addEventListener('click', async () => {
      const ids = [...document.querySelectorAll('.emp-check:checked')].map(cb => cb.dataset.id);
      if (!confirm(`Excluir ${ids.length} empresa(s)?`)) return;
      try {
        await Promise.all(ids.map(id => this.api(`/api/empresas/${id}`, { method: 'DELETE' })));
        this._todasEmpresas = this._todasEmpresas.filter(e => !ids.includes(String(e.id)));
        document.getElementById('btn-excluir-selecionadas').style.display = 'none';
        this._renderizarLista();
      } catch (e) { alert('Erro: ' + e.message); }
    });

    // Nova empresa
    document.getElementById('btn-nova-empresa')?.addEventListener('click', () => {
      this._limparFormEmpresa(); this._mostrarFormEmpresa();
    });

    // Voltar / Cancelar
    ['btn-voltar-emp','btn-cancelar-empresa'].forEach(id =>
      document.getElementById(id)?.addEventListener('click', () => this._mostrarListaEmpresas()));

    // Busca de matriz
    let tMatriz;
    document.getElementById('emp-matriz-search')?.addEventListener('input', e => {
      clearTimeout(tMatriz);
      const q = e.target.value.trim();
      if (q.length < 2) { document.getElementById('emp-matriz-results').classList.remove('show'); return; }
      tMatriz = setTimeout(async () => {
        const lista = await this.api(`/api/empresas?search=${encodeURIComponent(q)}`);
        const results = document.getElementById('emp-matriz-results');
        results.innerHTML = lista.map(e => `
          <div class="search-result-item" data-id="${e.id}" data-nome="${e.nome.replace(/"/g,'')}">
            <div class="result-nome">${e.nome}</div>
            <div class="result-info">${e.codigo_interno || ''}</div>
          </div>`).join('') || '<div class="search-result-item">Nenhuma encontrada</div>';
        results.querySelectorAll('.search-result-item[data-id]').forEach(item => {
          item.addEventListener('click', () => {
            document.getElementById('emp-matriz-id').value = item.dataset.id;
            document.getElementById('emp-matriz-nome').textContent = item.dataset.nome;
            document.getElementById('emp-matriz-sel').style.display = 'flex';
            document.getElementById('emp-matriz-search').value = '';
            results.classList.remove('show');
          });
        });
        results.classList.add('show');
      }, 300);
    });

    // Máscara CNPJ: XX.XXX.XXX/XXXX-XX
    document.getElementById('emp-cnpj')?.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 14);
      if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
      else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
      else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
      else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,3})/, '$1.$2');
      e.target.value = v;
    });

    // Badge "Isento" quando IE = 0
    document.getElementById('emp-ie')?.addEventListener('input', e => {
      const badge = document.getElementById('ie-isento-badge');
      if (badge) badge.style.display = e.target.value.trim() === '0' ? 'inline' : 'none';
    });

    document.getElementById('btn-remover-matriz')?.addEventListener('click', () => {
      document.getElementById('emp-matriz-id').value = '';
      document.getElementById('emp-matriz-sel').style.display = 'none';
      document.getElementById('emp-matriz-search').value = '';
    });

    // Salvar empresa
    document.getElementById('btn-salvar-empresa')?.addEventListener('click', async () => {
      const id = document.getElementById('emp-id').value;
      const nome = document.getElementById('emp-nome').value.trim();
      if (!nome) { alert('Nome é obrigatório'); return; }
      const payload = {
        nome,
        codigo_interno: document.getElementById('emp-codigo').value.trim(),
        cnpj: document.getElementById('emp-cnpj').value.trim(),
        inscricao_estadual: document.getElementById('emp-ie').value.trim(),
        regime_tributario: document.getElementById('emp-regime').value,
        municipio: document.getElementById('emp-municipio').value.trim(),
        segmento: document.getElementById('emp-segmento').value.trim(),
        email: document.getElementById('emp-email').value.trim(),
        com_movimento: document.getElementById('emp-com-movimento').checked,
        matriz_id: document.getElementById('emp-matriz-id').value || null,
      };
      try {
        if (id) {
          const updated = await this.api(`/api/empresas/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
          const idx = this._todasEmpresas.findIndex(e => e.id == id);
          if (idx >= 0) this._todasEmpresas[idx] = { ...this._todasEmpresas[idx], ...updated };
        } else {
          const nova = await this.api('/api/empresas', { method: 'POST', body: JSON.stringify(payload) });
          this._todasEmpresas.unshift(nova);
        }
        this._mostrarListaEmpresas();
        this._renderizarLista();
      } catch (e) { alert('Erro ao salvar: ' + e.message); }
    });
  }

  // ── Colaboradores (CRUD completo) ─────────────────────────────────────────
  avatarColor(nome) {
    const cores = ['#4299e1','#48bb78','#ed8936','#9f7aea','#f56565','#38b2ac','#ed64a6','#667eea'];
    let h = 0;
    for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + h * 31;
    return cores[Math.abs(h) % cores.length];
  }

  async renderColaboradores() {
    try {
      const todos = await this.api('/api/colaboradores');
      const cols = todos.filter(c => c.ativo);
      this._colsFotoBase64 = '';
      this._removerFoto = false;
      return `
        <div style="display:flex;flex-direction:column;gap:16px">

          <!-- Lista de colaboradores -->
          <div class="card" style="padding:0;overflow:hidden">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f0f0f0">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:1.1rem">👥</span>
                <span style="font-weight:700;text-transform:uppercase;font-size:0.78rem;color:#718096;letter-spacing:.05em">Colaboradores</span>
              </div>
              <button class="btn btn-primary" id="btn-novo-col" style="font-size:0.82rem;padding:6px 14px">✦ Novo Colaborador</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 110px 100px;padding:8px 20px;border-bottom:1px solid #f0f0f0;background:#f8fafc">
              <span style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:#a0aec0">Colaborador</span>
              <span style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:#a0aec0">Perfil</span>
              <span style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:#a0aec0">Ações</span>
            </div>
            ${cols.map(c => `
              <div style="display:grid;grid-template-columns:1fr 110px 100px;align-items:center;padding:12px 20px;border-bottom:1px solid #f7f7f7;${!c.ativo ? 'opacity:.5' : ''}">
                <div style="display:flex;align-items:center;gap:12px">
                  <div style="width:42px;height:42px;border-radius:50%;background:${this.avatarColor(c.nome)};display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:1rem;overflow:hidden;flex-shrink:0">
                    ${c.foto ? `<img src="${c.foto}" style="width:100%;height:100%;object-fit:cover">` : c.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-weight:600;font-size:0.9rem">${c.nome}</div>
                    <div style="font-size:0.75rem;color:#718096">${c.funcao || 'Sem função'}</div>
                  </div>
                </div>
                <div>
                  ${c.admin
                    ? '<span style="background:#fef3c7;color:#d97706;padding:3px 10px;border-radius:20px;font-size:0.73rem;font-weight:600">⭐ Admin</span>'
                    : '<span style="background:#f0f0f0;color:#718096;padding:3px 10px;border-radius:20px;font-size:0.73rem">👤 Colaborador</span>'}
                </div>
                <div style="display:flex;gap:5px">
                  <button class="btn btn-sm btn-empresas-col" title="Gerenciar empresas"
                    data-id="${c.id}" data-nome="${c.nome}"
                    style="padding:5px 8px;background:#ebf8ff;border-color:#bee3f8;color:#2b6cb0">🏢</button>
                  <button class="btn btn-sm btn-editar-col" title="Editar"
                    data-id="${c.id}" data-nome="${c.nome}" data-funcao="${c.funcao||''}" data-admin="${c.admin}" data-foto="${c.foto||''}"
                    style="padding:5px 8px;background:#fefcbf;border-color:#f6e05e;color:#744210">✏️</button>
                  <button class="btn btn-sm btn-excluir-col" title="${c.ativo ? 'Desativar' : 'Ativar'}"
                    data-id="${c.id}" data-ativo="${c.ativo}"
                    style="padding:5px 8px;background:#fff5f5;border-color:#fed7d7;color:#c53030">❌</button>
                </div>
              </div>`).join('')}
          </div>

          <!-- Vincular empresa a todos — sempre visível -->
          <div class="card">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span>🔗</span>
              <span style="font-weight:700;text-transform:uppercase;font-size:0.78rem;color:#718096;letter-spacing:.05em">Vincular Empresa a Todos</span>
            </div>
            <p style="font-size:0.8rem;color:#718096;margin-bottom:12px">Adiciona uma empresa para todos os colaboradores ativos de uma vez.</p>
            <div style="position:relative">
              <input type="text" id="vincular-search" placeholder="🔍 Buscar empresa..."
                style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.88rem">
              <div id="vincular-results" class="search-results" style="position:absolute;top:100%;left:0;right:0;z-index:100"></div>
            </div>
          </div>
        </div>

        <!-- Painel formulário (oculto por padrão, abre ao clicar Novo/Editar) -->
        <div id="col-form-panel" style="display:none;position:fixed;top:0;right:0;bottom:0;width:380px;background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,0.12);z-index:500;overflow-y:auto;padding:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            <div style="display:flex;align-items:center;gap:8px">
              <span id="form-col-icone">➕</span>
              <span id="form-col-titulo" style="font-weight:700;font-size:0.92rem;color:#2d3748">Novo Colaborador</span>
            </div>
            <button id="btn-fechar-form-col" style="background:none;border:none;font-size:1.4rem;color:#a0aec0;cursor:pointer;line-height:1">×</button>
          </div>
          <input type="hidden" id="col-id">

          <div style="margin-bottom:12px">
            <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Nome completo *</label>
            <input id="col-nome" type="text" placeholder="Ex: João da Silva"
              style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.88rem;box-sizing:border-box">
          </div>

          <div style="margin-bottom:12px">
            <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Função / Cargo</label>
            <input id="col-funcao" type="text" placeholder="Ex: Assistente Financeiro"
              style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.88rem;box-sizing:border-box">
          </div>

          <div style="margin-bottom:14px;display:flex;align-items:center;gap:10px">
            <label class="toggle-ativo" style="margin:0">
              <input id="col-admin" type="checkbox">
              <span class="toggle-slider"></span>
            </label>
            <span style="font-size:0.85rem;color:#4a5568">Administrador
              <span style="color:#718096;font-size:0.76rem">(acesso total)</span></span>
          </div>

          <div style="margin-bottom:20px">
            <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:6px">
              Foto <span style="color:#718096;font-weight:400">(opcional — PNG ou JPG)</span>
            </label>
            <div style="display:flex;align-items:center;gap:12px">
              <div id="col-foto-preview"
                style="width:50px;height:50px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:1.3rem;overflow:hidden;flex-shrink:0;color:#718096">?</div>
              <div>
                <div style="display:flex;gap:6px;margin-bottom:4px">
                  <button class="btn btn-sm" id="btn-foto-sel" style="background:#f7fafc">🖼 Selecionar</button>
                  <button class="btn btn-sm" id="btn-foto-remover" style="background:#fff5f5;border-color:#fed7d7;color:#c53030;display:none">✕ Remover</button>
                </div>
                <div id="col-foto-nome" style="font-size:0.72rem;color:#718096">Quadrada recomendada</div>
              </div>
              <input type="file" id="col-foto-input" accept="image/png,image/jpeg" style="display:none">
            </div>
          </div>

          <div style="display:flex;gap:8px">
            <button class="btn btn-primary" id="btn-salvar-col" style="flex:1">💾 Salvar</button>
            <button class="btn" id="btn-limpar-col">Cancelar</button>
          </div>
        </div>

        <!-- Modal empresas do colaborador -->
        <div id="modal-empresas-col" class="modal">
          <div class="modal-content" style="max-width:480px">
            <div class="modal-header">
              <h2>🏢 Empresas — <span id="modal-col-nome" style="color:#3498db"></span></h2>
              <button class="modal-close" id="btn-fechar-modal-emp">×</button>
            </div>
            <div class="modal-body">
              <div style="position:relative;margin-bottom:16px">
                <input type="text" id="empresa-col-search" placeholder="🔍 Buscar empresa para adicionar..."
                  style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.88rem">
                <div id="empresa-col-results" class="search-results" style="position:absolute;top:100%;left:0;right:0;z-index:200"></div>
              </div>
              <div id="empresa-col-lista" style="max-height:300px;overflow-y:auto"></div>
            </div>
          </div>
        </div>`;
    } catch { return `<div class="loading">Erro ao carregar colaboradores</div>`; }
  }

  configurarEventosColaboradores() {
    this._colAtualId = null;

    const abrirPanel = () => { document.getElementById('col-form-panel').style.display = 'block'; };
    const fecharPanel = () => { document.getElementById('col-form-panel').style.display = 'none'; };

    const limparForm = () => {
      document.getElementById('col-id').value = '';
      document.getElementById('col-nome').value = '';
      document.getElementById('col-funcao').value = '';
      document.getElementById('col-admin').checked = false;
      document.getElementById('col-foto-preview').innerHTML = '?';
      document.getElementById('col-foto-preview').style.background = '#e2e8f0';
      document.getElementById('col-foto-nome').textContent = 'Quadrada recomendada';
      document.getElementById('btn-foto-remover').style.display = 'none';
      document.getElementById('form-col-titulo').textContent = 'Novo Colaborador';
      document.getElementById('form-col-icone').textContent = '➕';
      this._colsFotoBase64 = '';
      this._removerFoto = false;
    };

    document.getElementById('btn-novo-col')?.addEventListener('click', () => { limparForm(); abrirPanel(); document.getElementById('col-nome').focus(); });
    document.getElementById('btn-limpar-col')?.addEventListener('click', () => { limparForm(); fecharPanel(); });
    document.getElementById('btn-fechar-form-col')?.addEventListener('click', fecharPanel);

    // Upload de foto
    document.getElementById('btn-foto-sel')?.addEventListener('click', () =>
      document.getElementById('col-foto-input').click());
    document.getElementById('col-foto-input')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { alert('Foto muito grande (máx 10MB)'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        this._colsFotoBase64 = ev.target.result;
        this._removerFoto = false;
        document.getElementById('col-foto-preview').innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover">`;
        document.getElementById('col-foto-nome').textContent = file.name;
        document.getElementById('btn-foto-remover').style.display = 'inline-flex';
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btn-foto-remover')?.addEventListener('click', () => {
      this._colsFotoBase64 = '';
      this._removerFoto = true;
      document.getElementById('col-foto-preview').innerHTML = '?';
      document.getElementById('col-foto-preview').style.background = '#e2e8f0';
      document.getElementById('col-foto-nome').textContent = 'Sem foto';
      document.getElementById('btn-foto-remover').style.display = 'none';
      document.getElementById('col-foto-input').value = '';
    });

    // Salvar
    document.getElementById('btn-salvar-col')?.addEventListener('click', async () => {
      const id = document.getElementById('col-id').value;
      const nome = document.getElementById('col-nome').value.trim();
      const funcao = document.getElementById('col-funcao').value.trim();
      const admin = document.getElementById('col-admin').checked;
      if (!nome) { alert('Nome é obrigatório'); return; }
      try {
        const foto = this._removerFoto ? null : (this._colsFotoBase64 || undefined);
        const payload = { nome, funcao, admin, ...(foto !== undefined ? { foto } : {}) };
        if (id) {
          await this.api(`/api/colaboradores/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
          // Se editou o próprio perfil, atualiza avatar da sidebar imediatamente
          if (parseInt(id) === this.colaborador?.id) {
            const fotoAtual = foto !== undefined ? foto : this._colsFotoAtual;
            this._atualizarAvatarSidebar(nome, fotoAtual || '');
            document.getElementById('current-user').textContent = nome;
            this.usuario = nome;
          }
        } else {
          await this.api('/api/colaboradores', { method: 'POST', body: JSON.stringify(payload) });
        }
        fecharPanel();
        await this.carregarColaboradores();
        await this.mudarTab('colaboradores');
      } catch (e) { alert('Erro ao salvar: ' + e.message); }
    });

    // Editar
    document.querySelectorAll('.btn-editar-col').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('col-id').value = btn.dataset.id;
        document.getElementById('col-nome').value = btn.dataset.nome;
        document.getElementById('col-funcao').value = btn.dataset.funcao;
        document.getElementById('col-admin').checked = btn.dataset.admin === '1' || btn.dataset.admin === 'true';
        document.getElementById('form-col-titulo').textContent = 'Editar Colaborador';
        document.getElementById('form-col-icone').textContent = '✏️';
        this._colsFotoBase64 = '';
        this._colsFotoAtual = btn.dataset.foto || '';
        this._removerFoto = false;
        const preview = document.getElementById('col-foto-preview');
        if (btn.dataset.foto) {
          preview.innerHTML = `<img src="${btn.dataset.foto}" style="width:100%;height:100%;object-fit:cover">`;
          document.getElementById('btn-foto-remover').style.display = 'inline-flex';
          document.getElementById('col-foto-nome').textContent = 'Foto atual';
        } else {
          preview.innerHTML = btn.dataset.nome.charAt(0).toUpperCase();
          document.getElementById('btn-foto-remover').style.display = 'none';
          document.getElementById('col-foto-nome').textContent = 'Sem foto';
        }
        preview.style.background = this.avatarColor(btn.dataset.nome);
        abrirPanel();
        document.getElementById('col-nome').focus();
      });
    });

    // Excluir/Ativar
    document.querySelectorAll('.btn-excluir-col').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ativo = btn.dataset.ativo === '1' || btn.dataset.ativo === 'true';
        const acao = ativo ? 'Desativar' : 'Ativar';
        if (!confirm(`${acao} este colaborador?`)) return;
        try {
          await this.api(`/api/colaboradores/${btn.dataset.id}`, { method: 'PUT', body: JSON.stringify({ ativo: !ativo }) });
          await this.carregarColaboradores();
          await this.mudarTab('colaboradores');
        } catch (e) { alert('Erro: ' + e.message); }
      });
    });

    // Vincular empresa a todos
    let tVincular;
    document.getElementById('vincular-search')?.addEventListener('input', e => {
      clearTimeout(tVincular);
      const q = e.target.value.trim();
      if (q.length < 2) { document.getElementById('vincular-results').classList.remove('show'); return; }
      tVincular = setTimeout(() => this.buscarVincularTodos(q), 300);
    });

    // Gerenciar empresas do colaborador (modal)
    document.querySelectorAll('.btn-empresas-col').forEach(btn => {
      btn.addEventListener('click', () => this.abrirModalEmpresas(btn.dataset.id, btn.dataset.nome));
    });

    document.getElementById('btn-fechar-modal-emp')?.addEventListener('click', () =>
      document.getElementById('modal-empresas-col').classList.remove('show'));
  }

  async buscarVincularTodos(q) {
    try {
      const lista = await this.api(`/api/empresas?search=${encodeURIComponent(q)}`);
      const results = document.getElementById('vincular-results');
      results.innerHTML = lista.map(e => `
        <div class="search-result-item" data-id="${e.id}">
          <div class="result-nome">${e.nome}</div>
          <div class="result-info">${e.codigo_interno || ''}</div>
        </div>`).join('') || '<div class="search-result-item">Nenhuma encontrada</div>';
      results.querySelectorAll('.search-result-item[data-id]').forEach(item => {
        item.addEventListener('click', async () => {
          results.classList.remove('show');
          document.getElementById('vincular-search').value = '';
          if (!confirm(`Vincular "${item.querySelector('.result-nome').textContent}" para TODOS os colaboradores?`)) return;
          try {
            const cols = await this.api('/api/colaboradores');
            const ativos = cols.filter(c => c.ativo);
            await Promise.all(ativos.map(c =>
              this.api(`/api/colaboradores/${c.id}/empresas`, {
                method: 'POST', body: JSON.stringify({ empresa_id: parseInt(item.dataset.id) })
              }).catch(() => {})
            ));
            alert(`Empresa vinculada a ${ativos.length} colaborador(es)!`);
          } catch (e) { alert('Erro: ' + e.message); }
        });
      });
      results.classList.add('show');
    } catch (e) { console.error(e); }
  }

  async abrirModalEmpresas(colId, colNome) {
    this._colAtualId = colId;
    document.getElementById('modal-col-nome').textContent = colNome;
    document.getElementById('modal-empresas-col').classList.add('show');
    await this.carregarEmpresasColaborador(colId);

    let tEmp;
    const searchInput = document.getElementById('empresa-col-search');
    searchInput.value = '';
    searchInput.oninput = e => {
      clearTimeout(tEmp);
      const q = e.target.value.trim();
      if (q.length < 2) { document.getElementById('empresa-col-results').classList.remove('show'); return; }
      tEmp = setTimeout(() => this.buscarEmpresaParaCol(q, colId), 300);
    };
  }

  async carregarEmpresasColaborador(colId) {
    try {
      const empresas = await this.api(`/api/colaboradores/${colId}/empresas`);
      const lista = document.getElementById('empresa-col-lista');
      if (!empresas.length) {
        lista.innerHTML = '<div style="color:#718096;text-align:center;padding:20px;font-size:0.85rem">Nenhuma empresa vinculada</div>';
        return;
      }
      lista.innerHTML = empresas.map(e => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0">
          <div>
            <div style="font-size:0.88rem;font-weight:600">${e.nome}</div>
            <div style="font-size:0.75rem;color:#718096">${e.codigo_interno || e.cnpj || ''}</div>
          </div>
          <button class="btn btn-sm btn-remover-emp" data-colid="${colId}" data-empid="${e.id}"
            style="background:#fff5f5;border-color:#fed7d7;color:#c53030;font-size:0.75rem">Remover</button>
        </div>`).join('');
      lista.querySelectorAll('.btn-remover-emp').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await this.api(`/api/colaboradores/${btn.dataset.colid}/empresas/${btn.dataset.empid}`, { method: 'DELETE' });
            await this.carregarEmpresasColaborador(colId);
          } catch (e) { alert('Erro: ' + e.message); }
        });
      });
    } catch (e) { console.error(e); }
  }

  async buscarEmpresaParaCol(q, colId) {
    try {
      const lista = await this.api(`/api/empresas?search=${encodeURIComponent(q)}`);
      const results = document.getElementById('empresa-col-results');
      results.innerHTML = lista.map(e => `
        <div class="search-result-item" data-id="${e.id}">
          <div class="result-nome">${e.nome}</div>
          <div class="result-info">${e.codigo_interno || ''}</div>
        </div>`).join('') || '<div class="search-result-item">Nenhuma encontrada</div>';
      results.querySelectorAll('.search-result-item[data-id]').forEach(item => {
        item.addEventListener('click', async () => {
          results.classList.remove('show');
          document.getElementById('empresa-col-search').value = '';
          try {
            await this.api(`/api/colaboradores/${colId}/empresas`, {
              method: 'POST', body: JSON.stringify({ empresa_id: parseInt(item.dataset.id) })
            });
            await this.carregarEmpresasColaborador(colId);
          } catch (e) { alert('Erro: ' + e.message); }
        });
      });
      results.classList.add('show');
    } catch (e) { console.error(e); }
  }

  // ── Configurar ────────────────────────────────────────────────────────────
  renderConfigurar() {
    const empresa = this.empresaConfigurar || this.empresaSelecionada;
    return `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card cfg-busca-card">
          <div class="cfg-section-label">📋 SELECIONAR EMPRESA</div>
          <div style="position:relative">
            <input type="text" id="cfg-search" class="cfg-search-input"
              placeholder="🔍  Buscar empresa pelo nome..."
              value="${empresa ? empresa.nome : ''}">
            <div id="cfg-search-results" class="search-results"></div>
          </div>
        </div>
        <div id="cfg-conteudo">
          ${empresa
            ? '<div class="loading"></div>'
            : `<div class="empty-state"><div class="empty-state-icon">⚙️</div><div class="empty-state-text">Busque e selecione uma empresa acima</div></div>`}
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
        results.innerHTML = '<div class="search-result-item" style="color:#a0aec0">Nenhuma empresa encontrada</div>';
      } else {
        results.innerHTML = lista.map(e => `
          <div class="search-result-item" data-id="${e.id}">
            <div class="result-nome">${e.nome}</div>
            <div class="result-info">${e.codigo_interno || ''}</div>
          </div>`).join('');
        results.querySelectorAll('.search-result-item[data-id]').forEach(item => {
          item.addEventListener('click', async () => {
            const emp = lista.find(e => String(e.id) === item.dataset.id);
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
    container.innerHTML = '<div class="loading"></div>';
    try {
      const atividades = await this.api(`/api/empresas/${empresaId}/atividades`);
      const nomeEmpresa = this.empresaConfigurar?.nome || this.empresaSelecionada?.nome || '';
      const grupos = {};
      atividades.forEach(a => { const g = a.grupo || 'Geral'; (grupos[g] = grupos[g] || []).push(a); });

      const total    = atividades.length;
      const habCount = atividades.filter(a => a.habilitada).length;

      container.innerHTML = `
        <div class="card cfg-lista-card">
          <div class="cfg-empresa-header">
            <div>
              <div class="cfg-empresa-nome">⚙️ ${nomeEmpresa.toUpperCase()}</div>
              <div class="cfg-count" id="cfg-count-label">${habCount} de ${total} atividades habilitadas</div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn cfg-btn-habilitar" id="btn-habilitar-todas">Habilitar Todas</button>
              <button class="btn cfg-btn-desabilitar" id="btn-desabilitar-todas">Desabilitar Todas</button>
            </div>
          </div>

          <div class="cfg-grupos">
            ${Object.entries(grupos).map(([grupo, atvsGrupo]) => `
              <div class="cfg-grupo-section">
                <div class="cfg-grupo-header">${grupo.toUpperCase()}</div>
                ${atvsGrupo.map(a => `
                  <div class="cfg-atv-row">
                    <span class="cfg-atv-nome">${a.nome}</span>
                    <label class="toggle-ativo">
                      <input type="checkbox" class="cfg-toggle" ${a.habilitada ? 'checked' : ''}
                        data-empresa="${empresaId}" data-atv="${a.atividade_id}">
                      <span class="toggle-slider"></span>
                    </label>
                  </div>`).join('')}
              </div>`).join('')}
          </div>
        </div>`;

      const atualizarContagem = () => {
        const todos    = container.querySelectorAll('.cfg-toggle');
        const habN     = [...todos].filter(t => t.checked).length;
        const label    = document.getElementById('cfg-count-label');
        if (label) label.textContent = `${habN} de ${todos.length} atividades habilitadas`;
      };

      const salvarToggle = async (toggle) => {
        try {
          await this.api(`/api/empresas/${toggle.dataset.empresa}/atividades/${toggle.dataset.atv}`, {
            method: 'PUT', body: JSON.stringify({ habilitada: toggle.checked })
          });
          atualizarContagem();
        } catch { toggle.checked = !toggle.checked; }
      };

      container.querySelectorAll('.cfg-toggle').forEach(toggle => {
        toggle.addEventListener('change', () => salvarToggle(toggle));
      });

      document.getElementById('btn-habilitar-todas')?.addEventListener('click', async () => {
        const toggles = [...container.querySelectorAll('.cfg-toggle:not(:checked)')];
        toggles.forEach(t => { t.checked = true; });
        await Promise.all(toggles.map(t =>
          this.api(`/api/empresas/${t.dataset.empresa}/atividades/${t.dataset.atv}`, {
            method: 'PUT', body: JSON.stringify({ habilitada: true })
          }).catch(() => { t.checked = false; })
        ));
        atualizarContagem();
      });

      document.getElementById('btn-desabilitar-todas')?.addEventListener('click', async () => {
        const toggles = [...container.querySelectorAll('.cfg-toggle:checked')];
        toggles.forEach(t => { t.checked = false; });
        await Promise.all(toggles.map(t =>
          this.api(`/api/empresas/${t.dataset.empresa}/atividades/${t.dataset.atv}`, {
            method: 'PUT', body: JSON.stringify({ habilitada: false })
          }).catch(() => { t.checked = true; })
        ));
        atualizarContagem();
      });

    } catch (e) { container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Erro ao carregar</div></div>`; }
  }

  // ── Status Geral ──────────────────────────────────────────────────────────
  // ── Status Tab ────────────────────────────────────────────────────────────

  _renderStatusShell() {
    const userName = this.usuario || '—';
    return `
      <div class="status-page">
        <div class="card status-header-card">
          <div>
            <div class="status-title">📊 Status de Atividades</div>
            <div class="status-subtitle">${userName} · Período: <span style="color:#3498db;font-weight:700">${this.periodo || '—'}</span></div>
          </div>
          <div class="status-controls">
            <input id="status-search" class="status-search" placeholder="🔍 Buscar empresa..." value="${this._statusSearch || ''}">
            <div class="status-view-toggle">
              <button class="btn-status-view${this._statusView === 'colaboradores' ? ' active' : ''}" data-view="colaboradores">👥 Colaboradores</button>
              <button class="btn-status-view${this._statusView === 'empresas' ? ' active' : ''}" data-view="empresas">🏢 Todas as Empresas</button>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-status-refresh">🔄 Atualizar</button>
          </div>
        </div>
        <div id="status-summary-area"></div>
        <div id="status-main-content"><div class="loading"></div></div>
      </div>`;
  }

  async _carregarStatus() {
    const el = document.getElementById('status-main-content');
    if (el) el.innerHTML = '<div class="loading"></div>';
    try {
      this._statusData = await this.api(`/api/status/geral?periodo=${encodeURIComponent(this.periodo)}`);
      this._renderStatusContent();
    } catch (e) {
      if (el) el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Erro ao carregar: ${e.message}</div></div>`;
    }
  }

  _renderStatusContent() {
    if (this._statusColabDetalhe) {
      this._renderCollabDetalhe(this._statusColabDetalhe);
      return;
    }
    this._renderStatusSummary();
    if (this._statusView === 'colaboradores') {
      this._renderStatusColaboradores();
    } else {
      this._renderStatusEmpresas();
    }
  }

  _renderPendentesDropdown(lista) {
    const grupos = {};
    for (const p of lista) {
      const g = p.grupo || 'Geral';
      if (!grupos[g]) grupos[g] = [];
      grupos[g].push(p.nome);
    }
    return Object.entries(grupos).map(([grupo, atividades]) => `
      <div class="pdrop-grupo">${grupo.toUpperCase()}</div>
      ${atividades.map(nome => `<div class="pdrop-item">⏳ ${nome}</div>`).join('')}
    `).join('');
  }

  _statusColor(pct) {
    if (pct >= 100) return '#27ae60';
    if (pct >= 70)  return '#e67e22';
    if (pct >= 40)  return '#e67e22';
    return '#e74c3c';
  }

  _renderStatusSummary() {
    const summaryEl = document.getElementById('status-summary-area');
    if (!summaryEl || !this._statusData) return;
    const { colaboradores, geral } = this._statusData;
    const totalAtv  = geral.reduce((s, e) => s + e.total, 0);
    const totalConc = geral.reduce((s, e) => s + e.concluidas, 0);
    const pctGeral  = totalAtv > 0 ? Math.round((totalConc / totalAtv) * 100) : 0;
    const cor = this._statusColor(pctGeral);

    let cards;
    if (this._statusView === 'colaboradores') {
      cards = [
        { icon: '🏢', value: geral.length,                       label: 'Empresas',          style: '' },
        { icon: '👥', value: colaboradores.length,               label: 'Colaboradores',     style: '' },
        { icon: '📋', value: `${totalConc}/${totalAtv}`,         label: 'Atividades feitas', style: 'blue' },
        { icon: '📈', value: `${pctGeral}%`,                     label: 'Progresso geral',   style: 'color' },
      ];
    } else {
      const completas = geral.filter(e => e.pct === 100).length;
      cards = [
        { icon: '🏢', value: geral.length,                       label: 'Total',             style: '' },
        { icon: '✅', value: completas,                          label: '100%',              style: '' },
        { icon: '📋', value: `${totalConc}/${totalAtv}`,         label: 'Feitas',            style: 'blue' },
        { icon: '📈', value: `${pctGeral}%`,                     label: 'Geral',             style: 'color' },
      ];
    }

    summaryEl.innerHTML = `
      <div class="card status-summary-card">
        <div class="status-summary-cards">
          ${cards.map(c => `
            <div class="summary-stat${c.style === 'blue' ? ' summary-stat-blue' : c.style === 'color' ? ' summary-stat-pink' : ''}">
              <div class="summary-stat-icon">${c.icon}</div>
              <div class="summary-stat-value" style="${c.style === 'blue' ? 'color:#3498db' : c.style === 'color' ? `color:${cor}` : 'color:#2d3748'}">${c.value}</div>
              <div class="summary-stat-label">${c.label}</div>
            </div>`).join('')}
        </div>
        <div class="status-progress-label">Progresso geral (${pctGeral}%)</div>
        <div class="status-progress-track">
          <div class="status-progress-fill" style="width:${pctGeral}%;background:${cor}"></div>
        </div>
      </div>`;
  }

  _renderStatusColaboradores() {
    const content = document.getElementById('status-main-content');
    if (!content || !this._statusData) return;
    const { colaboradores } = this._statusData;
    const search = (this._statusSearch || '').toLowerCase();
    const CIRC = 201.06;

    let filtered = colaboradores;
    if (search) {
      filtered = colaboradores.filter(col =>
        col.colaborador.nome.toLowerCase().includes(search) ||
        col.empresas.some(e => e.empresa.nome.toLowerCase().includes(search))
      );
    }

    if (filtered.length === 0) {
      content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">Nenhum colaborador encontrado</div></div>`;
      return;
    }

    content.innerHTML = `<div class="status-collab-grid">
      ${filtered.map(col => {
        const cor = this._statusColor(col.pct);
        const offset = (CIRC * (1 - col.pct / 100)).toFixed(2);
        const iniciais = col.colaborador.nome.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
        const fotoAvatar = col.colaborador.foto
          ? `<img src="${col.colaborador.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : iniciais;
        return `
          <div class="collab-status-card collab-clicavel" data-colid="${col.colaborador.id}">
            <div class="collab-ring-wrap">
              <svg width="80" height="80" viewBox="0 0 80 80" style="transform:rotate(-90deg)">
                <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" stroke-width="7"/>
                <circle cx="40" cy="40" r="32" fill="none" stroke="${cor}" stroke-width="7"
                  stroke-dasharray="${CIRC}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
              </svg>
              <div class="collab-ring-avatar" style="${col.colaborador.foto ? 'background:transparent' : ''}">${fotoAvatar}</div>
            </div>
            <div class="collab-card-name">${col.colaborador.nome}</div>
            <div class="collab-card-role">${col.colaborador.funcao || 'Usuário'}</div>
            <div class="collab-card-pct" style="color:${cor}">${col.pct}%</div>
            <div class="collab-card-info">${col.concluidas}/${col.total_atividades} atividades · ${col.total_empresas} empresa${col.total_empresas !== 1 ? 's' : ''}</div>
            <div class="collab-card-detail">Ver detalhes →</div>
          </div>`;
      }).join('')}
    </div>`;

    content.querySelectorAll('.collab-clicavel').forEach(card => {
      card.addEventListener('click', () => {
        const colId = String(card.dataset.colid);
        const colObj = this._statusData?.colaboradores.find(c => String(c.colaborador.id) === colId);
        if (colObj) {
          this._statusColabDetalhe = colObj;
          this._renderStatusContent();
        }
      });
    });
  }

  _renderCollabDetalhe(col) {
    const summaryEl = document.getElementById('status-summary-area');
    const content   = document.getElementById('status-main-content');
    if (!summaryEl || !content) return;

    const cor      = this._statusColor(col.pct);
    const iniciais = col.colaborador.nome.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const completas = col.empresas.filter(e => e.pct === 100).length;
    const R = 22, CIRC2 = (2 * Math.PI * R).toFixed(2);
    const offset2 = (2 * Math.PI * R * (1 - col.pct / 100)).toFixed(2);
    const detalheAvatarInner = col.colaborador.foto
      ? `<img src="${col.colaborador.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : iniciais;

    summaryEl.innerHTML = `
      <div class="card status-summary-card">
        <div class="collab-detalhe-header">
          <button class="btn btn-secondary btn-sm" id="btn-collab-voltar">← Voltar</button>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="position:relative;width:52px;height:52px;flex-shrink:0">
              <svg width="52" height="52" viewBox="0 0 52 52" style="transform:rotate(-90deg);position:absolute;top:0;left:0">
                <circle cx="26" cy="26" r="${R}" fill="none" stroke="#e2e8f0" stroke-width="5"/>
                <circle cx="26" cy="26" r="${R}" fill="none" stroke="${cor}" stroke-width="5"
                  stroke-dasharray="${CIRC2}" stroke-dashoffset="${offset2}" stroke-linecap="round"/>
              </svg>
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:${col.colaborador.foto ? 'transparent' : '#3498db'};color:#fff;font-size:0.82rem;font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden">${detalheAvatarInner}</div>
            </div>
            <div>
              <div style="font-weight:700;font-size:1rem;color:#2d3748">${col.colaborador.nome}</div>
              <div style="font-size:0.78rem;color:#718096">${col.colaborador.funcao || 'Usuário'}</div>
            </div>
          </div>
          <div class="collab-detalhe-stats">
            <div class="summary-stat"><div class="summary-stat-icon">🏢</div><div class="summary-stat-value" style="color:#2d3748">${col.total_empresas}</div><div class="summary-stat-label">Empresas</div></div>
            <div class="summary-stat"><div class="summary-stat-icon">✅</div><div class="summary-stat-value" style="color:#27ae60">${completas}</div><div class="summary-stat-label">100%</div></div>
            <div class="summary-stat summary-stat-blue"><div class="summary-stat-icon">📋</div><div class="summary-stat-value" style="color:#3498db">${col.concluidas}/${col.total_atividades}</div><div class="summary-stat-label">Feitas</div></div>
            <div class="summary-stat summary-stat-pink"><div class="summary-stat-icon">📈</div><div class="summary-stat-value" style="color:${cor}">${col.pct}%</div><div class="summary-stat-label">Progresso</div></div>
          </div>
        </div>
        <div class="status-progress-label" style="margin-top:12px">Progresso (${col.pct}%)</div>
        <div class="status-progress-track">
          <div class="status-progress-fill" style="width:${col.pct}%;background:${cor}"></div>
        </div>
      </div>`;

    document.getElementById('btn-collab-voltar')?.addEventListener('click', () => {
      this._statusColabDetalhe = null;
      this._renderStatusContent();
    });

    content.innerHTML = `<div class="status-emp-grid">
      ${col.empresas.map(e => {
        const cor2 = this._statusColor(e.pct);
        return `
          <div class="emp-status-card">
            <div class="emp-card-top">
              <div style="flex:1;min-width:0">
                <div class="emp-card-id">${e.empresa.codigo_interno || e.empresa.id}</div>
                <div class="emp-card-nome">${e.empresa.nome}</div>
              </div>
              <div style="text-align:right;margin-left:8px">
                <div class="emp-card-pct" style="color:${cor2}">${e.pct}%</div>
                <div class="emp-card-pct-label">concluído</div>
              </div>
            </div>
            <div class="status-progress-track" style="margin-bottom:10px">
              <div class="status-progress-fill" style="width:${e.pct}%;background:${cor2}"></div>
            </div>
            <div class="emp-card-badges">
              <div class="badge-ok">✅ ${e.ok} OK</div>
              ${e.nao_aplicavel > 0 ? `<div class="badge-na">✗ ${e.nao_aplicavel} N/A</div>` : ''}
              ${e.pendentes > 0 ? `
                <div class="badge-pendente" data-empid="d${e.empresa.id}">
                  ⏳ ${e.pendentes} pendentes ▾
                  <div class="pendente-dropdown" id="cd-drop-${e.empresa.id}">
                    ${this._renderPendentesDropdown(e.pendentes_lista)}
                  </div>
                </div>` : `<div class="badge-ok" style="background:#f0fff4;border-color:#9ae6b4;color:#22543d">✅ Concluído</div>`}
            </div>
          </div>`;
      }).join('')}
    </div>`;

    content.querySelectorAll('.badge-pendente').forEach(badge => {
      badge.addEventListener('click', ev => {
        ev.stopPropagation();
        const empId = badge.dataset.empid.replace('d', '');
        const drop = document.getElementById(`cd-drop-${empId}`);
        if (drop) {
          content.querySelectorAll('.pendente-dropdown.open').forEach(d => { if (d !== drop) d.classList.remove('open'); });
          drop.classList.toggle('open');
        }
      });
    });
  }

  _renderStatusEmpresas() {
    const content = document.getElementById('status-main-content');
    if (!content || !this._statusData) return;
    const { geral } = this._statusData;
    const search = (this._statusSearch || '').toLowerCase();
    const regime = this._statusRegime || '';

    let filtered = geral;
    if (search) {
      filtered = filtered.filter(e =>
        e.empresa.nome.toLowerCase().includes(search) ||
        String(e.empresa.codigo_interno).includes(search)
      );
    }
    if (regime) {
      filtered = filtered.filter(e =>
        (e.empresa.regime_tributario || '').toLowerCase() === regime.toLowerCase()
      );
    }

    const regimes = [...new Set(geral.map(e => e.empresa.regime_tributario).filter(Boolean))].sort();

    const regimeFilter = regimes.length > 0 ? `
      <div class="regime-filter">
        <button class="btn-regime${!regime ? ' active' : ''}" data-regime="">Todos</button>
        ${regimes.map(r => `<button class="btn-regime${regime === r ? ' active' : ''}" data-regime="${r}">${r}</button>`).join('')}
      </div>` : '';

    const cards = filtered.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">🏢</div><div class="empty-state-text">Nenhuma empresa encontrada</div></div>`
      : `<div class="status-emp-grid">
          ${filtered.map(e => {
            const cor = this._statusColor(e.pct);
            return `
              <div class="emp-status-card">
                <div class="emp-card-top">
                  <div style="flex:1;min-width:0">
                    <div class="emp-card-id">${e.empresa.codigo_interno || e.empresa.id}</div>
                    <div class="emp-card-nome">${e.empresa.nome}</div>
                    ${e.empresa.regime_tributario ? `<div style="font-size:0.68rem;color:#a0aec0;margin-top:2px">${e.empresa.regime_tributario}</div>` : ''}
                  </div>
                  <div style="text-align:right;margin-left:8px">
                    <div class="emp-card-pct" style="color:${cor}">${e.pct}%</div>
                    <div class="emp-card-pct-label">concluído</div>
                  </div>
                </div>
                <div class="status-progress-track" style="margin-bottom:10px">
                  <div class="status-progress-fill" style="width:${e.pct}%;background:${cor}"></div>
                </div>
                <div class="emp-card-badges">
                  <div class="badge-ok">✅ ${e.ok} OK</div>
                  ${e.nao_aplicavel > 0 ? `<div class="badge-ok" style="background:#f0f8ff;border-color:#bee3f8;color:#2b6cb0">N/A ${e.nao_aplicavel}</div>` : ''}
                  ${e.pendentes > 0 ? `
                    <div class="badge-pendente" data-empid="${e.empresa.id}">
                      ⏳ ${e.pendentes} pendentes ▾
                      <div class="pendente-dropdown" id="pend-drop-${e.empresa.id}">
                        ${this._renderPendentesDropdown(e.pendentes_lista)}
                      </div>
                    </div>` : `<div class="badge-ok" style="background:#f0fff4;border-color:#9ae6b4;color:#22543d">✅ Concluído</div>`}
                </div>
              </div>`;
          }).join('')}
        </div>`;

    content.innerHTML = regimeFilter + cards;

    content.querySelectorAll('.btn-regime').forEach(btn => {
      btn.addEventListener('click', () => {
        this._statusRegime = btn.dataset.regime;
        this._renderStatusEmpresas();
      });
    });

    content.querySelectorAll('.badge-pendente').forEach(badge => {
      badge.addEventListener('click', e => {
        e.stopPropagation();
        const drop = document.getElementById(`pend-drop-${badge.dataset.empid}`);
        if (drop) {
          content.querySelectorAll('.pendente-dropdown.open').forEach(d => { if (d !== drop) d.classList.remove('open'); });
          drop.classList.toggle('open');
        }
      });
    });
  }

  _configurarEventosStatus() {
    document.querySelectorAll('.btn-status-view').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-status-view').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._statusView = btn.dataset.view;
        this._statusSearch = '';
        this._statusRegime = '';
        this._statusColabDetalhe = null;
        const s = document.getElementById('status-search');
        if (s) s.value = '';
        if (this._statusData) this._renderStatusContent();
      });
    });

    let searchTO;
    const searchEl = document.getElementById('status-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        clearTimeout(searchTO);
        searchTO = setTimeout(() => {
          this._statusSearch = searchEl.value;
          this._statusColabDetalhe = null;
          if (this._statusData) this._renderStatusContent();
        }, 200);
      });
    }

    const refreshBtn = document.getElementById('btn-status-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this._carregarStatus());

    document.addEventListener('click', e => {
      if (!e.target.closest('.badge-pendente')) {
        document.querySelectorAll('.pendente-dropdown.open').forEach(d => d.classList.remove('open'));
      }
    });
  }

  // ── Relatório de Anotações ────────────────────────────────────────────────
  _renderRelatorioShell() {
    return `
      <div class="status-page">
        <div class="status-header-card" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div>
              <div style="font-size:1.1rem;font-weight:700;color:#2d3748">📝 Relatório de Anotações</div>
              <div style="font-size:0.8rem;color:#718096;margin-top:2px">Todas as notas registradas por empresa e período</div>
            </div>
            <button id="btn-rel-refresh" style="padding:6px 14px;background:#ebf8ff;border:1px solid #bee3f8;border-radius:8px;color:#2b6cb0;font-weight:600;cursor:pointer;font-size:0.82rem">🔄 Atualizar</button>
          </div>
          <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
            <input id="rel-search" type="text" placeholder="🔍 Buscar empresa ou anotação..."
              style="flex:1;min-width:180px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.85rem">
            <select id="rel-periodo" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.85rem;color:#4a5568;background:#fff">
              <option value="">Todos os períodos</option>
              ${(this._periodos || []).map(p => `<option value="${p}">${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="rel-lista" style="display:flex;flex-direction:column;gap:10px">
          <div class="loading"></div>
        </div>
      </div>`;
  }

  _configurarEventosRelatorio() {
    document.getElementById('btn-rel-refresh')?.addEventListener('click', () => this._carregarRelatorio());

    let to;
    document.getElementById('rel-search')?.addEventListener('input', () => {
      clearTimeout(to);
      to = setTimeout(() => this._filtrarRelatorio(), 200);
    });

    document.getElementById('rel-periodo')?.addEventListener('change', () => this._filtrarRelatorio());
  }

  _filtrarRelatorio() {
    if (!this._relatorioNotas) return;
    const q = (document.getElementById('rel-search')?.value || '').toLowerCase();
    const per = document.getElementById('rel-periodo')?.value || '';
    let lista = this._relatorioNotas;
    if (q) lista = lista.filter(n =>
      (n.empresa_nome || '').toLowerCase().includes(q) ||
      (n.texto || '').toLowerCase().includes(q) ||
      (n.usuario || '').toLowerCase().includes(q)
    );
    if (per) lista = lista.filter(n => n.periodo === per);
    this._renderRelatorioLista(lista);
  }

  async _carregarRelatorio() {
    const el = document.getElementById('rel-lista');
    if (!el) return;
    el.innerHTML = '<div class="loading"></div>';
    try {
      this._relatorioNotas = await this.api('/api/notas');
      this._filtrarRelatorio();
    } catch (e) {
      el.innerHTML = `<div style="color:#c53030;padding:20px;text-align:center">Erro ao carregar anotações: ${e.message}</div>`;
    }
  }

  _renderRelatorioLista(lista) {
    const el = document.getElementById('rel-lista');
    if (!el) return;
    if (!lista.length) {
      el.innerHTML = '<div style="text-align:center;color:#a0aec0;padding:40px;font-size:0.9rem">Nenhuma anotação encontrada</div>';
      return;
    }
    el.innerHTML = lista.map(n => {
      const data = n.atualizado_em || n.criado_em || '';
      const dataFmt = data ? data.slice(0, 10).split('-').reverse().join('/') : '—';
      return `
        <div class="card rel-nota-card" data-nota-id="${n.id}" style="padding:14px 16px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
                <span style="font-size:0.8rem;font-weight:700;color:#2b6cb0;background:#ebf8ff;padding:2px 10px;border-radius:12px">${n.empresa_nome || '—'}</span>
                ${n.periodo ? `<span style="font-size:0.75rem;color:#718096;background:#f7fafc;border:1px solid #e2e8f0;padding:2px 8px;border-radius:12px">📅 ${n.periodo}</span>` : ''}
                ${n.usuario ? `<span style="font-size:0.75rem;color:#718096">por <strong>${n.usuario}</strong></span>` : ''}
                <span style="font-size:0.72rem;color:#a0aec0;margin-left:auto">${dataFmt}</span>
              </div>
              <div class="rel-nota-texto" style="font-size:0.88rem;color:#2d3748;line-height:1.5;white-space:pre-wrap">${n.texto || ''}</div>
              <textarea class="rel-nota-edit" data-id="${n.id}" style="display:none;width:100%;padding:8px 10px;border:1px solid #3498db;border-radius:6px;font-size:0.88rem;resize:vertical;font-family:inherit;box-sizing:border-box;margin-top:6px" rows="3">${n.texto || ''}</textarea>
              <div class="rel-edit-btns" style="display:none;margin-top:8px;display:none;gap:8px">
                <button class="btn-rel-salvar" data-id="${n.id}" style="padding:5px 14px;background:#3498db;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.82rem;font-weight:600">Salvar</button>
                <button class="btn-rel-cancelar" data-id="${n.id}" style="padding:5px 14px;background:#f7fafc;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:0.82rem">Cancelar</button>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn-rel-editar" data-id="${n.id}" title="Editar" style="padding:4px 10px;background:#f7fafc;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:0.82rem;color:#4a5568">✏️</button>
              <button class="btn-rel-excluir" data-id="${n.id}" title="Excluir" style="padding:4px 10px;background:#fff5f5;border:1px solid #fed7d7;border-radius:6px;cursor:pointer;font-size:0.82rem;color:#c53030">🗑️</button>
            </div>
          </div>
        </div>`;
    }).join('');

    el.querySelectorAll('.btn-rel-editar').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.rel-nota-card');
        card.querySelector('.rel-nota-texto').style.display = 'none';
        card.querySelector('.rel-nota-edit').style.display = 'block';
        const editBtns = card.querySelector('.rel-edit-btns');
        editBtns.style.display = 'flex';
        card.querySelector('.rel-nota-edit').focus();
      });
    });

    el.querySelectorAll('.btn-rel-cancelar').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.rel-nota-card');
        card.querySelector('.rel-nota-texto').style.display = '';
        card.querySelector('.rel-nota-edit').style.display = 'none';
        card.querySelector('.rel-edit-btns').style.display = 'none';
      });
    });

    el.querySelectorAll('.btn-rel-salvar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        const card = btn.closest('.rel-nota-card');
        const novo = card.querySelector('.rel-nota-edit').value.trim();
        if (!novo) { alert('O texto não pode ficar vazio.'); return; }
        try {
          await this.api('/api/notas', {
            method: 'PUT',
            body: JSON.stringify({ id, texto: novo })
          });
          const nota = this._relatorioNotas?.find(n => n.id === id);
          if (nota) nota.texto = novo;
          card.querySelector('.rel-nota-texto').textContent = novo;
          card.querySelector('.rel-nota-texto').style.display = '';
          card.querySelector('.rel-nota-edit').style.display = 'none';
          card.querySelector('.rel-edit-btns').style.display = 'none';
        } catch (e) { alert('Erro ao salvar: ' + e.message); }
      });
    });

    el.querySelectorAll('.btn-rel-excluir').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Excluir esta anotação?')) return;
        const id = parseInt(btn.dataset.id);
        try {
          await this.api(`/api/notas?id=${id}`, { method: 'DELETE' });
          if (this._relatorioNotas) this._relatorioNotas = this._relatorioNotas.filter(n => n.id !== id);
          btn.closest('.rel-nota-card').remove();
          if (!document.querySelectorAll('.rel-nota-card').length) {
            el.innerHTML = '<div style="text-align:center;color:#a0aec0;padding:40px;font-size:0.9rem">Nenhuma anotação encontrada</div>';
          }
        } catch (e) { alert('Erro ao excluir: ' + e.message); }
      });
    });
  }
}


const App = new GridFlowApp();
document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
