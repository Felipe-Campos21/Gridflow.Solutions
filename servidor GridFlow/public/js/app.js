// GridFlow Web - Aplicação Principal

class GridFlowApp {
  constructor() {
    this.usuario = null;
    this.colaborador = null;
    this.periodo = null;
    this.empresaSelecionada = null;
    this.atividades = [];
    this.historico = [];
    this.empresas = [];
    this.searchTimeout = null;
    this.refreshInterval = null;
    this.currentTab = 'dashboard';
  }

  // ── Inicialização ───────────────────────────────────────────────────────
  async init() {
    this.configurarEventos();
    await this.carregarPeriodos();
    await this.verificarConexao();
    await this.carregarColaboradores();
    this.iniciarAutoRefresh();
  }

  async verificarConexao() {
    try {
      const res = await this.api('/api/health');
      document.getElementById('status-dot').classList.add('online');
      document.getElementById('status-dot').classList.remove('offline');
    } catch (e) {
      document.getElementById('status-dot').classList.add('offline');
      document.getElementById('status-dot').classList.remove('online');
    }
  }

  // ── API ──────────────────────────────────────────────────────────────────
  async api(endpoint, options = {}) {
    const url = CONFIG.API_URL + endpoint;
    const headers = { 'Content-Type': 'application/json' };
    
    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers }
    });
    
    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }
    
    return response.json();
  }

  // ── Colaboradores ───────────────────────────────────────────────────────
  async carregarColaboradores() {
    try {
      const cols = await this.api('/api/colaboradores');
      this.renderUserList(cols);
    } catch (e) {
      console.error('Erro ao carregar colaboradores:', e);
    }
  }

  renderUserList(colaboradores) {
    const container = document.getElementById('user-list');
    container.innerHTML = colaboradores.map(col => `
      <div class="user-list-item" data-id="${col.id}" data-nome="${col.nome}">
        <div class="user-avatar">${col.nome.charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-weight:600">${col.nome}</div>
          <div style="font-size:0.75rem;color:#718096">${col.funcao || 'Usuário'}</div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.user-list-item').forEach(item => {
      item.addEventListener('click', () => this.selecionarUsuario(item));
    });
  }

  async selecionarUsuario(item) {
    const nome = item.dataset.nome;
    const id = parseInt(item.dataset.id);
    
    this.usuario = nome;
    this.colaborador = { id, nome };
    
    document.getElementById('current-user').textContent = nome;
    document.getElementById('user-avatar').textContent = nome.charAt(0).toUpperCase();
    
    this.closeUserModal();
    
    // Carregar empresas do colaborador
    await this.carregarMinhasEmpresas();
    
    // Se há empresas, selecionar a primeira
    if (this.minhasEmpresas && this.minhasEmpresas.length > 0) {
      await this.selecionarEmpresa(this.minhasEmpresas[0]);
    }
  }

  async carregarMinhasEmpresas() {
    try {
      const col = await this.api(`/api/colaboradores/${this.colaborador.id}`);
      this.colaborador = col;
      this.minhasEmpresas = col.empresas || [];
    } catch (e) {
      this.minhasEmpresas = [];
    }
  }

  openUserModal() {
    document.getElementById('user-modal').classList.add('show');
  }

  closeUserModal() {
    document.getElementById('user-modal').classList.remove('show');
  }

  // ── Períodos ─────────────────────────────────────────────────────────────
  async carregarPeriodos() {
    const periodos = this.gerarPeriodos();
    this.periodo = this.obterPeriodoAtual();
    this.renderPeriodoDropdown(periodos);
  }

  gerarPeriodos() {
    const periodos = [];
    const agora = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      periodos.push({ mes, ano, label: `${mes}/${ano}`, value: `${mes}/${ano}` });
    }
    return periodos;
  }

  obterPeriodoAtual() {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const ano = agora.getFullYear();
    return `${mes}/${ano}`;
  }

  renderPeriodoDropdown(periodos) {
    const dropdown = document.getElementById('periodo-dropdown');
    dropdown.innerHTML = periodos.map(p => `
      <div class="dropdown-item ${p.value === this.periodo ? 'active' : ''}" data-value="${p.value}">
        ${p.label}
      </div>
    `).join('');

    document.getElementById('periodo-display').textContent = this.periodo;

    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        this.periodo = item.dataset.value;
        document.getElementById('periodo-display').textContent = this.periodo;
        dropdown.classList.remove('show');
        this.atualizarConteudo();
      });
    });
  }

  // ── Navegação ───────────────────────────────────────────────────────────
  configurarEventos() {
    // Sidebar toggle
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.getElementById('app-sidebar').classList.toggle('collapsed');
    });

    // User switch
    document.getElementById('user-switch').addEventListener('click', () => {
      this.openUserModal();
    });

    // Periodo dropdown
    document.getElementById('btn-periodo').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('periodo-dropdown').classList.toggle('show');
    });

    // Close dropdown on outside click
    document.addEventListener('click', () => {
      document.getElementById('periodo-dropdown').classList.remove('show');
    });

    // Nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        if (tab) this.mudarTab(tab);
      });
    });
  }

  mudarTab(tab) {
    this.currentTab = tab;
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tab);
    });

    // Update title
    const titles = {
      dashboard: 'Checklist',
      atividades: 'Gerenciador de Atividades',
      configurar: 'Configurar Empresa',
      empresas: 'Gerenciador de Empresas',
      colaboradores: 'Colaboradores',
      status: 'Status Geral'
    };
    document.getElementById('topbar-title').textContent = titles[tab] || tab;

    // Render content
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
        break;
      case 'empresas':
        content.innerHTML = await this.renderEmpresas();
        break;
      case 'colaboradores':
        content.innerHTML = await this.renderColaboradores();
        break;
      case 'configurar':
        content.innerHTML = await this.renderConfigurar();
        break;
      case 'status':
        content.innerHTML = await this.renderStatus();
        break;
    }
  }

  async atualizarConteudo() {
    await this.renderizarConteudo();
  }

  // ── Dashboard ───────────────────────────────────────────────────────────
  async renderDashboard() {
    const periodo = this.periodo;
    
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

          ${this.minhasEmpresas && this.minhasEmpresas.length ? `
          <div class="card">
            <h3>⭐ Minhas Empresas</h3>
            <div id="db-minhas-empresas">
              ${this.minhasEmpresas.map(e => `
                <div class="minha-empresa-item" data-id="${e.id}">
                  <div class="minha-empresa-nome">${e.nome}</div>
                  <div class="minha-empresa-cod">${e.codigo_interno || e.cnpj || ''}</div>
                </div>
              `).join('')}
            </div>
          </div>` : ''}

          <div class="card" id="db-empresa-card">
            <h3>🏢 Empresa Selecionada</h3>
            <div id="db-empresa-info">
              <div class="empresa-info-empty">
                ${this.minhasEmpresas && this.minhasEmpresas.length ? 'Clique em uma das suas empresas' : 'Busque e selecione uma empresa'}
              </div>
            </div>
          </div>

          <div class="card" id="db-notas-card" style="display:none">
            <h3 style="margin:0 0 10px;font-size:0.92rem">📝 Anotações — <span style="color:#3498db">${periodo}</span></h3>
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
              <span style="font-size:0.78rem;font-weight:600;color:#3498db;background:#ebf8ff;padding:3px 10px;border-radius:20px">📅 ${periodo}</span>
            </div>
            <div id="db-atividades-container">
              <div class="atividades-vazio">Selecione uma empresa para ver as atividades</div>
            </div>
          </div>

          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
              <h3 style="margin:0">📋 Histórico — <span style="color:#3498db">${periodo}</span></h3>
              <span class="sync-info" id="db-sync-info">Auto-atualiza a cada 5s</span>
            </div>
            <div id="db-historico-lista">
              <div class="historico-vazio">Nenhum registro neste período</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  configurarEventosDashboard() {
    // Search
    const input = document.getElementById('db-search-input');
    if (input) {
      input.addEventListener('input', () => {
        clearTimeout(this.searchTimeout);
        const q = input.value.trim();
        if (q.length < 2) {
          document.getElementById('db-search-results').classList.remove('show');
          return;
        }
        this.searchTimeout = setTimeout(() => this.buscarEmpresas(q), CONFIG.searchDebounce);
      });
    }

    // Close search on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box')) {
        document.getElementById('db-search-results')?.classList.remove('show');
      }
    });

    // Minhas empresas
    document.querySelectorAll('.minha-empresa-item').forEach(el => {
      el.addEventListener('click', async () => {
        document.querySelectorAll('.minha-empresa-item').forEach(i => i.classList.remove('ativa'));
        el.classList.add('ativa');
        const empresa = this.minhasEmpresas.find(e => e.id == el.dataset.id);
        await this.selecionarEmpresa(empresa);
      });
    });

    // Nota salvar
    const btnSalvar = document.getElementById('db-nota-salvar');
    if (btnSalvar) {
      btnSalvar.addEventListener('click', () => this.salvarNota());
    }
  }

  async buscarEmpresas(q) {
    try {
      let lista = await this.api(`/api/empresas?search=${encodeURIComponent(q)}`);
      
      // Filtrar por empresas do colaborador se não for admin
      if (this.colaborador && !this.colaborador.admin && this.minhasEmpresas.length) {
        const ids = new Set(this.minhasEmpresas.map(e => e.id));
        lista = lista.filter(e => ids.has(e.id));
      }

      const results = document.getElementById('db-search-results');
      if (lista.length === 0) {
        results.innerHTML = '<div class="search-result-item"><div class="result-nome">Nenhuma empresa encontrada</div></div>';
      } else {
        results.innerHTML = lista.map(e => `
          <div class="search-result-item" data-id="${e.id}">
            <div class="result-nome">${e.nome}</div>
            <div class="result-info">${e.cnpj || ''} ${e.codigo_interno ? '• ' + e.codigo_interno : ''}</div>
          </div>
        `).join('');

        results.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', async () => {
            const empresa = lista.find(e => e.id == item.dataset.id);
            await this.selecionarEmpresa(empresa);
            results.classList.remove('show');
            input.value = '';
          });
        });
      }
      results.classList.add('show');
    } catch (e) {
      console.error('Erro na busca:', e);
    }
  }

  async selecionarEmpresa(empresa) {
    this.empresaSelecionada = empresa;
    
    // Update UI
    document.getElementById('db-empresa-info').innerHTML = `
      <div class="empresa-nome">${empresa.nome}</div>
      <div class="empresa-badges">
        ${empresa.cnpj ? `<span class="badge badge-blue">${empresa.cnpj}</span>` : ''}
        ${empresa.codigo_interno ? `<span class="badge badge-green">${empresa.codigo_interno}</span>` : ''}
      </div>
    `;

    document.getElementById('db-notas-card').style.display = 'block';

    // Carregar atividades e histórico
    await Promise.all([
      this.carregarAtividades(),
      this.carregarHistorico(),
      this.carregarNota()
    ]);
  }

  async carregarAtividades() {
    if (!this.empresaSelecionada) return;

    try {
      const empresaId = this.empresaSelecionada.id;
      const periodo = this.periodo;
      
      // Buscar atividades da empresa
      const atividades = await this.api(`/api/empresas/${empresaId}/atividades`);
      
      // Buscar status das atividades no período
      const status = await this.api(`/api/historico?empresa_id=${empresaId}&periodo=${periodo}`);
      const concluidas = new Set(status.filter(h => h.concluida).map(h => h.atividade_id));

      this.atividades = atividades;

      const container = document.getElementById('db-atividades-container');
      container.innerHTML = `
        <div class="atividades-grid">
          ${atividades.map(a => `
            <button class="atividade-btn ${concluidas.has(a.id) ? 'concluida' : ''}" 
                    data-id="${a.id}" data-codigo="${a.codigo}">
              <span class="btn-codigo">${a.codigo}</span>
              ${a.nome}
            </button>
          `).join('')}
        </div>
      `;

      // Bind click events
      container.querySelectorAll('.atividade-btn').forEach(btn => {
        btn.addEventListener('click', () => this.toggleAtividade(btn));
      });
    } catch (e) {
      console.error('Erro ao carregar atividades:', e);
    }
  }

  async toggleAtividade(btn) {
    if (!this.empresaSelecionada || !this.usuario) return;

    const atividadeId = parseInt(btn.dataset.id);
    const periodo = this.periodo;
    const empresaId = this.empresaSelecionada.id;

    const concluida = !btn.classList.contains('concluida');

    try {
      await this.api('/api/historico', {
        method: 'POST',
        body: JSON.stringify({
          empresa_id: empresaId,
          atividade_id: atividadeId,
          periodo: periodo,
          usuario: this.usuario,
          concluida: concluida,
          observacao: ''
        })
      });

      btn.classList.toggle('concluida');
      await this.carregarHistorico();
    } catch (e) {
      console.error('Erro ao atualizar atividade:', e);
    }
  }

  async carregarHistorico() {
    if (!this.empresaSelecionada) return;

    try {
      const periodo = this.periodo;
      const empresaId = this.empresaSelecionada.id;
      
      const historico = await this.api(`/api/historico?empresa_id=${empresaId}&periodo=${periodo}`);

      const container = document.getElementById('db-historico-lista');
      
      if (historico.length === 0) {
        container.innerHTML = '<div class="historico-vazio">Nenhum registro neste período</div>';
        return;
      }

      // Ordenar por data mais recente
      historico.sort((a, b) => new Date(b.data) - new Date(a.data));

      container.innerHTML = `
        <div class="historico-lista">
          ${historico.map(h => `
            <div class="historico-item">
              <div class="hi-data">${this.formatarData(h.data)}</div>
              <div class="hi-atividade">${h.atividade_codigo} - ${h.atividade_nome}</div>
              <div class="hi-usuario">${h.usuario}</div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
    }
  }

  async carregarNota() {
    if (!this.empresaSelecionada) return;

    try {
      const periodo = this.periodo;
      const empresaId = this.empresaSelecionada.id;
      
      const notas = await this.api(`/api/notas?empresa_id=${empresaId}&periodo=${periodo}`);
      
      if (notas && notas.length > 0 && notas[0].texto) {
        document.getElementById('db-nota-texto').value = notas[0].texto;
      } else {
        document.getElementById('db-nota-texto').value = '';
      }
    } catch (e) {
      console.error('Erro ao carregar nota:', e);
    }
  }

  async salvarNota() {
    if (!this.empresaSelecionada || !this.usuario) return;

    const texto = document.getElementById('db-nota-texto').value;
    const periodo = this.periodo;
    const empresaId = this.empresaSelecionada.id;

    try {
      await this.api('/api/notas', {
        method: 'POST',
        body: JSON.stringify({
          empresa_id: empresaId,
          periodo: periodo,
          usuario: this.usuario,
          texto: texto
        })
      });

      document.getElementById('db-nota-status').textContent = 'Salvo!';
      setTimeout(() => {
        document.getElementById('db-nota-status').textContent = '';
      }, 2000);
    } catch (e) {
      console.error('Erro ao salvar nota:', e);
      document.getElementById('db-nota-status').textContent = 'Erro ao salvar';
    }
  }

  formatarData(dataStr) {
    const d = new Date(dataStr);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Auto Refresh ─────────────────────────────────────────────────────────
  iniciarAutoRefresh() {
    this.refreshInterval = setInterval(async () => {
      await this.verificarConexao();
      if (this.currentTab === 'dashboard' && this.empresaSelecionada) {
        await Promise.all([
          this.carregarHistorico(),
          this.carregarAtividades()
        ]);
      }
    }, CONFIG.autoRefreshInterval);
  }

  // ── Outras Abas ──────────────────────────────────────────────────────────
  async renderAtividades() {
    try {
      const atividades = await this.api('/api/atividades');
      
      return `
        <div class="card">
          <h3>Gerenciador de Atividades</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Descrição</th>
                <th>Grupo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${atividades.map(a => `
                <tr>
                  <td><span class="atividade-codigo-tag">${a.codigo}</span></td>
                  <td>${a.nome}</td>
                  <td>${a.descricao || '-'}</td>
                  <td><span class="grupo-tag">${a.grupo || 'Geral'}</span></td>
                  <td>${a.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      return `<div class="loading">Erro ao carregar atividades</div>`;
    }
  }

  async renderEmpresas() {
    try {
      const empresas = await this.api('/api/empresas/todas');
      
      return `
        <div class="card">
          <h3>Gerenciador de Empresas (${empresas.length})</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CNPJ</th>
                <th>Código Interno</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${empresas.map(e => `
                <tr>
                  <td>${e.nome}</td>
                  <td>${e.cnpj || '-'}</td>
                  <td>${e.codigo_interno || '-'}</td>
                  <td>${e.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      return `<div class="loading">Erro ao carregar empresas</div>`;
    }
  }

  async renderColaboradores() {
    try {
      const cols = await this.api('/api/colaboradores');
      
      return `
        <div class="card">
          <h3>Colaboradores</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Função</th>
                <th>Admin</th>
                <th>Empresas</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${cols.map(c => `
                <tr>
                  <td>${c.nome}</td>
                  <td>${c.funcao || '-'}</td>
                  <td>${c.admin ? '👑 Sim' : 'Não'}</td>
                  <td>${c.empresas?.length || 0}</td>
                  <td>${c.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      return `<div class="loading">Erro ao carregar colaboradores</div>`;
    }
  }

  async renderConfigurar() {
    if (!this.empresaSelecionada) {
      return `
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon">🏢</div>
            <div class="empty-state-text">Selecione uma empresa no Dashboard para configurá-la</div>
          </div>
        </div>
      `;
    }

    try {
      const empresaId = this.empresaSelecionada.id;
      const atividades = await this.api(`/api/empresas/${empresaId}/atividades`);
      
      return `
        <div class="card">
          <h3>Configurar: ${this.empresaSelecionada.nome}</h3>
          <p style="color:#718096;margin-bottom:16px">Habilite ou desabilite as atividades desta empresa</p>
          <div>
            ${atividades.map(a => `
              <div class="configurar-atividade-row">
                <div class="cfg-atv-info">
                  <div class="cfg-atv-nome">${a.codigo} - ${a.nome}</div>
                  <div class="cfg-atv-grupo">${a.grupo || 'Geral'}</div>
                </div>
                <label class="toggle-ativo">
                  <input type="checkbox" ${a.habilitada ? 'checked' : ''} data-id="${a.id}">
                  <span class="toggle-slider"></span>
                </label>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (e) {
      return `<div class="loading">Erro ao carregar configuração</div>`;
    }
  }

  async renderStatus() {
    try {
      const [empresas, atividades, historico, cols] = await Promise.all([
        this.api('/api/empresas/todas'),
        this.api('/api/atividades'),
        this.api('/api/historico?periodo=' + this.periodo),
        this.api('/api/colaboradores')
      ]);

      const periodo = this.periodo;
      const concluidas = historico.filter(h => h.concluida).length;
      const total = historico.length;

      return `
        <div class="card">
          <h3>Status Geral</h3>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:12px">
            <div style="text-align:center;padding:16px;background:#f7fafc;border-radius:8px">
              <div style="font-size:2rem;font-weight:700;color:#3498db">${empresas.length}</div>
              <div style="font-size:0.8rem;color:#718096">Empresas</div>
            </div>
            <div style="text-align:center;padding:16px;background:#f7fafc;border-radius:8px">
              <div style="font-size:2rem;font-weight:700;color:#27ae60">${atividades.length}</div>
              <div style="font-size:0.8rem;color:#718096">Atividades</div>
            </div>
            <div style="text-align:center;padding:16px;background:#f7fafc;border-radius:8px">
              <div style="font-size:2rem;font-weight:700;color:#e67e22">${cols.length}</div>
              <div style="font-size:0.8rem;color:#718096">Colaboradores</div>
            </div>
            <div style="text-align:center;padding:16px;background:#f7fafc;border-radius:8px">
              <div style="font-size:2rem;font-weight:700;color:#9b59b6">${concluidas}/${total}</div>
              <div style="font-size:0.8rem;color:#718096">Concluídas (${periodo})</div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      return `<div class="loading">Erro ao carregar status</div>`;
    }
  }
}

// ── Inicialização ─────────────────────────────────────────────────────────
const App = new GridFlowApp();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// Expose App globally for onclick handlers
window.App = App;