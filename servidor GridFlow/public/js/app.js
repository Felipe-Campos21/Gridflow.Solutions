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
    try { this.filiais = await this.api(`/api/empresas/${empresa.id}/filiais`); }
    catch { this.filiais = []; }
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
      // Propagar para filiais se esta empresa é matriz
      if (this.filiais && this.filiais.length > 0) {
        for (const filial of this.filiais) {
          try {
            if (status !== 'OK') {
              await this.api('/api/historico', { method: 'POST', body: JSON.stringify({
                empresa_id: filial.id, atividade_id: atividadeId,
                periodo: this.periodo, usuario: this.usuario, status: 'OK', observacao: ''
              })});
            } else {
              const hf = await this.api(`/api/historico?empresa_id=${filial.id}&periodo=${encodeURIComponent(this.periodo)}`);
              const rec = hf.find(h => h.atividade_id === atividadeId && h.status === 'OK');
              if (rec) await this.api(`/api/historico/${rec.id}`, { method: 'DELETE' });
            }
          } catch (ef) { console.error('Erro propagando filial:', ef); }
        }
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
                <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Inscrição Estadual <span style="color:#718096;font-weight:400">(0 = Isento)</span></label>
                <input id="emp-ie" type="text" placeholder="Digite os números..."
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
        <div style="display:grid;grid-template-columns:1fr 360px;gap:16px;align-items:start">

          <!-- Lista -->
          <div class="card" style="padding:0;overflow:hidden">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #f0f0f0">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:1.1rem">👥</span>
                <span style="font-weight:700;text-transform:uppercase;font-size:0.78rem;color:#718096;letter-spacing:.05em">Colaboradores</span>
              </div>
              <button class="btn btn-primary" id="btn-novo-col" style="font-size:0.82rem;padding:6px 14px">✦ Novo</button>
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

          <!-- Formulário + Vincular -->
          <div style="display:flex;flex-direction:column;gap:16px">

            <!-- Form criar/editar -->
            <div class="card">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
                <span>➕</span>
                <span id="form-col-titulo" style="font-weight:700;text-transform:uppercase;font-size:0.78rem;color:#718096;letter-spacing:.05em">Novo Colaborador</span>
              </div>
              <input type="hidden" id="col-id">

              <div style="margin-bottom:12px">
                <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Nome completo *</label>
                <input id="col-nome" type="text" placeholder="Ex: João da Silva"
                  style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.88rem">
              </div>

              <div style="margin-bottom:12px">
                <label style="font-size:0.8rem;font-weight:600;color:#4a5568;display:block;margin-bottom:4px">Função / Cargo</label>
                <input id="col-funcao" type="text" placeholder="Ex: Assistente Financeiro"
                  style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.88rem">
              </div>

              <div style="margin-bottom:14px;display:flex;align-items:center;gap:10px">
                <label class="toggle-ativo" style="margin:0">
                  <input id="col-admin" type="checkbox">
                  <span class="toggle-slider"></span>
                </label>
                <span style="font-size:0.85rem;color:#4a5568">Administrador
                  <span style="color:#718096;font-size:0.76rem">(acesso total)</span></span>
              </div>

              <div style="margin-bottom:16px">
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
                <button class="btn" id="btn-limpar-col">Limpar</button>
              </div>
            </div>

            <!-- Vincular empresa a todos -->
            <div class="card">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span>🔗</span>
                <span style="font-weight:700;text-transform:uppercase;font-size:0.78rem;color:#718096;letter-spacing:.05em">Vincular Empresa a Todos</span>
              </div>
              <p style="font-size:0.8rem;color:#718096;margin-bottom:12px">Adiciona uma empresa para todos os colaboradores de uma vez.</p>
              <div style="position:relative">
                <input type="text" id="vincular-search" placeholder="🔍 Buscar empresa..."
                  style="width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.88rem">
                <div id="vincular-results" class="search-results" style="position:absolute;top:100%;left:0;right:0;z-index:100"></div>
              </div>
            </div>
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
      this._colsFotoBase64 = '';
      this._removerFoto = false;
    };

    document.getElementById('btn-novo-col')?.addEventListener('click', limparForm);
    document.getElementById('btn-limpar-col')?.addEventListener('click', limparForm);

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
        } else {
          await this.api('/api/colaboradores', { method: 'POST', body: JSON.stringify(payload) });
        }
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
        this._colsFotoBase64 = '';
        this._removerFoto = false;
        if (btn.dataset.foto) {
          document.getElementById('col-foto-preview').innerHTML = `<img src="${btn.dataset.foto}" style="width:100%;height:100%;object-fit:cover">`;
          document.getElementById('btn-foto-remover').style.display = 'inline-flex';
          document.getElementById('col-foto-nome').textContent = 'Foto atual';
        }
        document.getElementById('col-foto-preview').style.background = this.avatarColor(btn.dataset.nome);
        document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
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
