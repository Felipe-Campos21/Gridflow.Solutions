  // ================================================================
  // AUTH: Login
  // ================================================================
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await readBody(req);
    const { email, senha } = body;

    if (!email || !senha)
      return sendJson(res, 400, { erro: 'Email e senha são obrigatórios' });

    const emailLower = email.toLowerCase().trim();
    const senhaHash  = hashSenha(senha);

    const result = await sbFetch(
      'colaboradores?email=eq.' + encodeURIComponent(emailLower) +
      '&senha_hash=eq.' + encodeURIComponent(senhaHash) +
      '&ativo=eq.1&select=id,nome,email,funcao,foto,conta_id,admin_conta'
    );

    if (!result.body || result.body.length === 0)
      return sendJson(res, 401, { erro: 'Email ou senha incorretos' });

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
      colaborador: { id: colab.id, nome: colab.nome, email: colab.email, funcao: colab.funcao, foto: colab.foto, admin: colab.admin_conta },
      conta: { id: conta.id, tipo: conta.tipo, nome_empresa: conta.nome_empresa, plano: conta.plano },
      empresas: empresas,
      atividades: atividades,
      historico: historico,
      colaboradores_conta: colaboradoresDaConta
    });
  }