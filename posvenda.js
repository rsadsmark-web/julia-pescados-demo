/* Pós-venda no painel da Julia Pescados: receitas no WhatsApp e avaliação depois da entrega.
   Demonstração: as mensagens só aparecem nas Conversas deste navegador; nenhuma IA é chamada e nada é enviado. */
(function () {
  var ctx = null, I = null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var F = { filtro: 'todas', respondendo: null, recProd: 'p1' };
  var ESTRELA = '★', VAZIA = '☆';

  function esc(t) { return ctx.esc(t); }
  function S() { return PV.ler(); }
  // empresas mantêm o nome inteiro na saudação ("Olá, Bar do Zeca")
  function primeiro(n) { return /^(Restaurante|Bar|Cantina|Hotel)\b/.test(n) ? String(n) : String(n || '').split(' ')[0]; }
  function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function nota1(n) { return String(n).replace('.', ','); }
  function estrelas(n) { return '<span class="pv-est" role="img" aria-label="Nota ' + n + ' de 5">' + new Array(n + 1).join(ESTRELA) + '<i>' + new Array(6 - n).join(VAZIA) + '</i></span>'; }
  function pedidoObj(id) { return ctx.estado().pedidos.filter(function (p) { return p.id === id; })[0]; }
  function entregue(p) { return p.confirmado && p.tipo === 'entrega' && (p.fixo === 'entregue' || JP.situacao(p).cod === 'chegou'); }
  function achaLead(nome, pedidoId, criar) {
    var D = I.dados(), ls = D.leads;
    var l = ls.filter(function (x) { return pedidoId && x.pedidoId === pedidoId; })[0] || ls.filter(function (x) { return x.nome === nome; })[0];
    var p = !l && criar && pedidoId ? pedidoObj(pedidoId) : null;
    if (p) { // cliente novo vindo da loja: abre a conversa dele no WhatsApp
      var t = p.criado || Date.now();
      l = { id: 'l' + t, nome: p.cliente, fone: p.fone, origem: 'Site — pedido ' + p.id, etapa: 'vendido', valor: JP.totalPedido(p), itens: p.itens.map(function (i) { return i.qtd + ' ' + i.un + ' ' + i.nome; }).join(', '),
        etq: [], resp: '', nao: 0, vendido: true, clienteId: null, optout: false, ultimoDisparo: 0, bairro: p.bairro || '', pedidoId: p.id,
        msgs: [{ d: 'c', t: 'Pedido ' + p.id + ' feito pelo site.', ts: t }], hist: [{ ts: t, t: 'Contato criado — origem: Site — pedido ' + p.id }] };
      D.leads.unshift(l); I.salvar();
    }
    return l;
  }
  function modeloAval(nome, pedido) { return S().aval.texto.replace(/\{nome\}/g, primeiro(nome)).replace(/\{pedido\}/g, pedido); }

  /* ---------- mensagens nas Conversas ---------- */
  function msg(l, d, t, ts, ia) {
    var m = { d: d, t: t, ts: ts }; if (d === 'j') m.st = 'lida'; if (ia) m.ia = 1;
    l.msgs.push(m); l.msgs.sort(function (a, b) { return a.ts - b.ts; });
    return m;
  }
  function refrescaConversas() {
    I.salvar(); ctx.selos();
    if (window.CRM.conv.atualizar) CRM.conv.atualizar();
  }
  function contaIA(n) { var D = I.dados(); if (D.conv) D.conv.contIA.auto += n; }
  // Depois da entrega a IA manda uma só mensagem, com o link da página de receitas dos produtos do pedido.
  function enviaReceitas(p, l, t0) {
    var s = S(), prods = [], nomes = [];
    p.itens.forEach(function (i) { if (prods.length < 3 && prods.indexOf(i.id) < 0 && PV.receitasDoProduto(i.id).length) { prods.push(i.id); nomes.push(i.nome); } });
    if (!prods.length) return 0;
    var link = PV.linkReceitas(prods, p.id), lista = nomes.join(', ').replace(/, ([^,]*)$/, ' e $1');
    msg(l, 'j', PV.modeloReceitas(primeiro(l.nome), p.id, lista, link), t0, true);
    msg(l, 's', 'A IA enviou o link de receitas do pedido ' + p.id + ' (pós-venda).', t0 + 1000, true);
    s.envios.unshift({ pedido: p.id, cliente: p.cliente, produto: lista, quando: t0, lead: l.id, link: link });
    contaIA(1); PV.salvar();
    return 1;
  }
  function pedeAvaliacao(p, l, t) {
    msg(l, 'j', modeloAval(l.nome, p.id), t, true);
    contaIA(1); PV.salvar();
  }
  // Depois da entrega: receita na hora e, logo depois, o pedido de nota.
  function posEntrega(p, t0, imediato) {
    var s = S(), l = achaLead(p.cliente, p.id, true);
    s.processados[p.id] = 1; PV.salvar();
    if (!l) return;
    var n = s.receitas.ativa ? enviaReceitas(p, l, t0) : 0;
    if (s.aval.ativa) {
      var t = t0 + (n ? 5000 : 0) + 60000;
      if (imediato) setTimeout(function () { pedeAvaliacao(p, l, Date.now()); refrescaConversas(); atualizaTelas(); }, 4000);
      else pedeAvaliacao(p, l, t);
    }
    refrescaConversas();
    if (imediato && n) ctx.toast('Pedido ' + p.id + ' entregue: a IA mandou o link das receitas para ' + p.cliente + ' nas Conversas.');
  }
  // Cliente avaliou (na loja ou por WhatsApp): aparece na conversa e a IA agradece ou passa para a equipe.
  function sincroniza() {
    var s = PV.recarregar(), mudou = false;
    s.lista.forEach(function (a) {
      if (a.convOk) return;
      a.convOk = true; mudou = true;
      var l = achaLead(a.cliente, a.pedido, true); if (!l) return;
      var txt = 'Nota ' + a.nota + ' de 5' + (a.comentario ? ': ' + a.comentario : '.') + (a.indicou ? '\nVou indicar para uns amigos!' : '');
      msg(l, 'c', txt, a.quando, false);
      var nome = primeiro(l.nome), g = Date.now() - a.quando < 600000 ? 1000 : 40000;
      if (PV.baixa(a)) {
        msg(l, 'j', 'Sinto muito, ' + nome + '. Obrigada por contar. Já avisei a Júlia, que vai falar com você por aqui para resolver.', a.quando + g, true);
        var D = I.dados();
        if (window.CRM.conv.garante) CRM.conv.garante();
        if (D.conv) { var mt = D.conv.meta[l.id] || (D.conv.meta[l.id] = { ia: null, status: 'aberta', obs: '', precisa: '' }); mt.ia = 'humano'; mt.precisa = 'Avaliação baixa: nota ' + a.nota; mt.status = 'aberta'; }
        msg(l, 's', 'A IA passou a conversa para atendimento humano: avaliação baixa (nota ' + a.nota + ').', a.quando + g + 1000, true);
        if (Date.now() - a.quando < 3600000) l.nao = (l.nao || 0) + 1;
      } else {
        msg(l, 'j', 'Que bom, ' + nome + '! Obrigada pela nota ' + a.nota + ' e pelo carinho.' + (a.indicou ? ' Pode mandar o nosso perfil @juliapescados para os seus amigos.' : ' Se lembrar de alguém que gosta de pescado fresco, indique a gente: @juliapescados.'), a.quando + g, true);
      }
      contaIA(1);
    });
    if (mudou) { PV.salvar(); refrescaConversas(); }
  }

  /* ---------- dados de exemplo ---------- */
  function semear() {
    var s = S(); if (s.semeado) return;
    if (window.JP_VAZIO) { s.semeado = true; PV.salvar(); return; }
    var agora = Date.now(), dia = 86400000;
    // pedidos já entregues hoje: receita e pedido de nota já enviados nas Conversas
    var hoje = [['JP-1044'], ['JP-1045'], ['JP-1046']];
    var resposta = {
      'JP-1045': [5, 'Camarão fresquíssimo e a receita veio na hora certa. Fiz hoje mesmo!', true],
      'JP-1046': [2, 'O Kit Família chegou com a lula descongelada e atrasou quase uma hora.', false]
    };
    ctx.estado().pedidos.forEach(function (p) { if (entregue(p)) s.processados[p.id] = 1; });
    hoje.forEach(function (h) {
      var p = pedidoObj(h[0]); if (!p) return;
      var l = achaLead(p.cliente, p.id); if (!l) return;
      var t0 = p.criado + 95 * 60000;
      var n = enviaReceitas(p, l, t0), tp = t0 + (n ? 5000 : 0) + 60000;
      pedeAvaliacao(p, l, tp);
      var r = resposta[h[0]];
      if (r) PV.avaliar({ pedido: p.id, cliente: p.cliente, fone: p.fone, nota: r[0], comentario: r[1], indicou: r[2], origem: 'WhatsApp', quando: tp + 25 * 60000 });
    });
    var hist = [
      ['JP-1038', 'Eduardo Pinheiro', 5, 'Camarão fresquíssimo, chegou antes do horário.', 1, 3, 1],
      ['JP-1039', 'Cantina da Nona', 5, 'Qualidade de sempre, o camarão cinza rende muito.', 1, 4, 1],
      ['JP-1040', 'Beatriz Fontenele', 4, 'Tudo certo, só o motoboy demorou um pouco para achar o prédio.', 0, 4, 1],
      ['JP-1041', 'Mônica Sales', 5, 'Filé de tilápia sem espinha, as crianças comeram tudo.', 1, 5, 1],
      ['JP-1036', 'Paulo Henrique', 3, 'Produto bom, mas o pacote chegou com pouco gelo.', 0, 6, 1],
      ['JP-1035', 'Joana Darc', 4, 'Chegou bem embalado e gelado.', 0, 7, 1],
      ['JP-1033', 'Rafael Costa', 1, 'Pedido veio sem a lula que eu pedi.', 0, 8, 1, 'Rafael, pedimos desculpas pelo erro. Mandamos a lula que faltou no mesmo dia, sem custo.'],
      ['JP-1031', 'Letícia Alves', 5, 'Sempre entrega no horário combinado.', 1, 9, 1],
      ['JP-1030', 'Tereza Cristina', 5, 'Salmão excelente. Voltarei a comprar.', 0, 10, 1],
      ['JP-1028', 'Francisco Teixeira', 4, 'Bom preço e produto bem embalado.', 0, 12, 1],
      ['JP-1027', 'Ivan Gomes', 5, 'Pedi para Caucaia e chegou tudo certo.', 1, 14, 1]
    ];
    hist.forEach(function (h) {
      var a = PV.avaliar({ pedido: h[0], cliente: h[1], nota: h[2], comentario: h[3], indicou: !!h[4], origem: h[6] ? 'Loja' : 'WhatsApp', quando: agora - h[5] * dia - 3600000 * (h[6] ? 3 : 0), convOk: !!h[6] });
      if (h[7]) { a.respondida = true; a.resposta = h[7]; }
    });
    s.semeado = true; PV.salvar();
    sincroniza();
  }

  /* ---------- Receitas ---------- */
  function chaveToggle(ativa, rotulo, id) {
    return '<button type="button" class="pv-chave" role="switch" aria-checked="' + ativa + '" id="' + id + '"><i aria-hidden="true"></i><span>' + rotulo + '</span></button>';
  }
  function receitas(tela) {
    var s = S(), prods = ctx.estado().produtos.filter(function (p) { return PV.receitasDoProduto(p.id).length; });
    if (F.recProd !== 'todos' && !prods.some(function (p) { return p.id === F.recProd; })) F.recProd = 'todos';
    var lista = PV.receitas().filter(function (r) { return F.recProd === 'todos' || r.prod === F.recProd; });
    var nomeProd = function (id) { return (prods.filter(function (p) { return p.id === id; })[0] || {}).nome || id; };
    var exemplo = PV.modeloReceitas('Marcos', 'JP-1045', 'Camarão cinza inteiro e Filé de tilápia', PV.linkReceitas(['p1', 'p5'], 'JP-1045'));
    tela.innerHTML = '<div class="cab"><div><h1>Receitas</h1><p>Depois que o pedido é entregue, a IA manda ao cliente o link de uma página com várias receitas dos produtos que ele comprou.</p></div>' +
      '<a class="btn pequeno claro" href="/receitas" target="_blank" rel="noopener">Ver a página pública ↗</a></div>' +
      '<div class="painel pv-topo"><div>' + chaveToggle(s.receitas.ativa, s.receitas.ativa ? 'Envio do link de receitas ligado' : 'Envio do link de receitas desligado', 'pvRecAtiva') +
      '<p class="pv-nota">A mensagem sai na conversa do cliente, logo depois da entrega. Quem desliga a IA nas Conversas também para este envio.</p>' +
      '<label class="sr" for="pvRecTexto">Mensagem enviada com o link</label><textarea id="pvRecTexto" rows="4">' + esc(s.receitas.texto) + '</textarea>' +
      '<p class="pv-nota">Use {nome}, {pedido}, {produtos} e {link} no texto.</p>' +
      '<div class="acoes"><button class="btn pequeno" id="pvRecTextoSalvar">Salvar mensagem</button><button class="btn pequeno claro" id="pvRecTextoPadrao">Voltar ao padrão</button></div></div>' +
      '<div class="pv-ex"><small>Como o cliente recebe no WhatsApp</small><p class="pv-prev">' + esc(exemplo).replace(/\n/g, '<br>') + '</p></div></div>' +
      '<div class="painel"><h2>Receitas da página <small>' + lista.length + ' de ' + PV.receitas().length + '</small></h2>' +
      '<div class="filtros" id="pvRecFiltros"><button class="filtro' + (F.recProd === 'todos' ? ' ativo' : '') + '" data-rec-f="todos" aria-pressed="' + (F.recProd === 'todos') + '">Todos</button>' +
      prods.map(function (p) { return '<button class="filtro' + (F.recProd === p.id ? ' ativo' : '') + '" data-rec-f="' + p.id + '" aria-pressed="' + (F.recProd === p.id) + '">' + esc(p.nome) + '<b>' + PV.receitasDoProduto(p.id).length + '</b></button>'; }).join('') + '</div>' +
      '<div class="pv-grade" id="pvReceitas">' + lista.map(function (r) {
        return '<div class="pv-rec" data-rec-card="' + r.id + '"><h3><span>' + esc(r.titulo) + '</span>' + (r.editada ? '<span class="chip laranja">Editada</span>' : '<span class="chip cinza">Padrão</span>') + '</h3>' +
          '<small class="pv-mudo">' + esc(nomeProd(r.prod)) + '</small>' +
          '<div class="form-grade"><div class="campo largo"><label for="rt-' + r.id + '">Título</label><input id="rt-' + r.id + '" value="' + esc(r.titulo) + '"></div>' +
          '<div class="campo"><label for="rm-' + r.id + '">Tempo</label><input id="rm-' + r.id + '" value="' + esc(r.tempo) + '"></div>' +
          '<div class="campo"><label for="rp-' + r.id + '">Serve</label><input id="rp-' + r.id + '" type="number" min="1" value="' + r.porcoes + '"></div></div>' +
          '<label for="ri-' + r.id + '">Ingredientes <small class="pv-mudo">um por linha</small></label><textarea id="ri-' + r.id + '" rows="5">' + esc(r.ingr.join('\n')) + '</textarea>' +
          '<label for="rs-' + r.id + '">Modo de preparo <small class="pv-mudo">um passo por linha</small></label><textarea id="rs-' + r.id + '" rows="5">' + esc(r.prep.join('\n')) + '</textarea>' +
          '<div class="acoes"><button class="btn pequeno" data-rec-salvar="' + r.id + '">Salvar</button>' + (r.editada ? '<button class="btn pequeno claro" data-rec-padrao="' + r.id + '">Voltar ao texto padrão</button>' : '') + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Links enviados recentemente <small>' + s.envios.length + ' nesta demonstração</small></h2>' +
      (s.envios.length ? '<div class="rolagem"><table><thead><tr><th>Quando</th><th>Cliente</th><th>Pedido</th><th>Produtos</th><th></th></tr></thead><tbody>' +
        s.envios.slice(0, 8).map(function (e) { return '<tr><td>' + ctx.dataHora(e.quando) + '</td><td>' + esc(e.cliente) + '</td><td>' + e.pedido + '</td><td>' + esc(e.produto) + '</td><td><a class="btn pequeno claro" href="#conversas/' + e.lead + '">Abrir conversa</a></td></tr>'; }).join('') + '</tbody></table></div>'
        : '<p class="vazio">Nenhum link enviado ainda. Confirme um pedido de entrega na loja e espere a entrega para ver a mensagem nas Conversas.</p>') + '</div>';
  }

  /* ---------- Avaliações ---------- */
  function avaliacoes(tela) {
    var s = S(), l = s.lista, total = l.length, media = PV.media();
    var baixas = l.filter(function (a) { return PV.baixa(a) && !a.respondida; });
    var indic = l.filter(function (a) { return a.indicou; }).length;
    var aguard = ctx.estado().pedidos.filter(function (p) { return entregue(p) && !PV.doPedido(p.id); });
    var dist = [5, 4, 3, 2, 1].map(function (n) { return [n, l.filter(function (a) { return a.nota === n; }).length]; });
    var fs = [['todas', 'Todas', total], ['5', '5 estrelas', dist[0][1]], ['4', '4 estrelas', dist[1][1]], ['3', '3 estrelas', dist[2][1]], ['2', '2 estrelas', dist[3][1]], ['1', '1 estrela', dist[4][1]], ['responder', 'A responder', baixas.length]];
    tela.innerHTML = '<div class="cab"><div><h1>Avaliações</h1><p>Depois da entrega, o cliente dá uma nota de 1 a 5 e deixa um comentário, pelo WhatsApp ou pelo acompanhamento do pedido na loja.</p></div></div>' +
      '<div class="kpis">' + kpiHtml('Nota média', total ? nota1(media.toFixed(1)) + ' de 5' : '—', total + ' avaliações') +
      kpiHtml('Notas baixas a responder', baixas.length, baixas.length ? 'nota 3 ou menos, sem resposta' : 'nenhuma pendente', baixas.length ? 'alerta' : '') +
      kpiHtml('Vão indicar amigos', indic, total ? Math.round(indic / total * 100) + '% dos que avaliaram' : '') +
      kpiHtml('Entregues sem nota', aguard.length, aguard.length ? 'esperando o cliente' : 'todos avaliaram') + '</div>' +
      '<div class="duas pv-duas"><div class="painel"><h2>Notas recebidas <small>mais recentes primeiro</small></h2><div class="filtros" id="pvFiltros">' +
      fs.map(function (f) { return '<button class="filtro' + (F.filtro === f[0] ? ' ativo' : '') + '" data-pv-f="' + f[0] + '" aria-pressed="' + (F.filtro === f[0]) + '">' + f[1] + '<b>' + f[2] + '</b></button>'; }).join('') + '</div>' +
      '<div id="pvLista"></div></div>' +
      '<div><div class="painel"><h2>Distribuição</h2>' + dist.map(function (d) { var pc = total ? d[1] / total * 100 : 0; return '<div class="pv-barra"><span>' + d[0] + ' ' + ESTRELA + '</span><div><i style="width:' + pc + '%" class="n' + d[0] + '"></i></div><b>' + d[1] + '</b></div>'; }).join('') + '</div>' +
      '<div class="painel" style="margin-top:18px"><h2>Mensagem pós-entrega</h2>' +
      chaveToggle(s.aval.ativa, s.aval.ativa ? 'Pedido de avaliação ligado' : 'Pedido de avaliação desligado', 'pvAvalAtiva') +
      '<p class="pv-nota">Enviada pela IA nas Conversas e exibida também no acompanhamento da loja. Use {nome} e {pedido} no texto.</p>' +
      '<label class="sr" for="pvAvalTexto">Texto do pedido de avaliação</label><textarea id="pvAvalTexto" rows="6">' + esc(s.aval.texto) + '</textarea>' +
      '<div class="acoes"><button class="btn pequeno" id="pvAvalSalvar">Salvar texto</button><button class="btn pequeno claro" id="pvAvalPadrao">Voltar ao padrão</button></div></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Entregues sem avaliação</h2>' +
      (aguard.length ? aguard.slice(0, 5).map(function (p) { return '<div class="pv-aguard"><div><b>' + p.id + '</b> · ' + esc(p.cliente) + '</div><div class="acoes"><select class="peq" id="sim-' + p.id + '" aria-label="Nota simulada de ' + esc(p.cliente) + '"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select><button class="btn pequeno claro" data-pv-sim="' + p.id + '">Simular resposta</button></div></div>'; }).join('') + '<small class="pv-nota">Só na demonstração: simula o cliente respondendo à mensagem do WhatsApp.</small>'
        : '<p class="vazio" style="padding:18px 8px">Nenhum pedido entregue esperando nota.</p>') + '</div></div></div>';
    desenhaLista();
  }
  function kpiHtml(t, v, sub, cls) { return '<div class="kpi ' + (cls || '') + '"><span>' + t + '</span><b>' + v + '</b><small>' + sub + '</small></div>'; }
  function desenhaLista() {
    var el = $('#pvLista'); if (!el) return;
    var l = S().lista.filter(function (a) {
      if (F.filtro === 'todas') return true;
      if (F.filtro === 'responder') return PV.baixa(a) && !a.respondida;
      return String(a.nota) === F.filtro;
    }).sort(function (a, b) { return b.quando - a.quando; });
    el.innerHTML = l.length ? l.map(function (a) {
      var pend = PV.baixa(a) && !a.respondida, lead = achaLead(a.cliente, a.pedido);
      return '<article class="pv-av' + (pend ? ' alerta' : '') + '" data-av="' + a.id + '"><header>' + estrelas(a.nota) + '<b>' + esc(a.cliente) + '</b><small>' + a.pedido + ' · ' + ctx.ha(a.quando) + '</small>' +
        '<span class="chip ' + (a.origem === 'Loja' ? 'laranja' : 'ok') + '">' + (a.origem === 'Loja' ? 'Pela loja' : 'WhatsApp') + '</span>' + (a.indicou ? '<span class="chip rosa">Vai indicar</span>' : '') +
        (pend ? '<span class="chip perigo">Responder</span>' : '') + '</header>' +
        '<p>' + (a.comentario ? '“' + esc(a.comentario) + '”' : '<span class="pv-mudo">Sem comentário.</span>') + '</p>' +
        (a.respondida ? '<div class="pv-resp"><small>Resposta da Júlia</small>' + esc(a.resposta) + '</div>' : '') +
        (F.respondendo === a.id ? '<div class="pv-caixa"><label class="sr" for="pvResp">Resposta para ' + esc(a.cliente) + '</label><textarea id="pvResp" rows="3">' + esc(F.rascunho) + '</textarea><div class="acoes"><button class="btn pequeno" data-pv-enviar="' + a.id + '">Enviar pelo WhatsApp</button><button class="btn pequeno claro" data-pv-cancela>Cancelar</button></div></div>' :
          '<div class="acoes">' + (!a.respondida && PV.baixa(a) ? '<button class="btn pequeno" data-pv-resp="' + a.id + '">Responder</button>' : '') + (lead ? '<a class="btn pequeno claro" href="#conversas/' + lead.id + '">Abrir conversa</a>' : '') + '</div>') + '</article>';
    }).join('') : '<p class="vazio">Nenhuma avaliação neste filtro.</p>';
  }
  function sugestao(a) {
    var n = primeiro(a.cliente);
    return n + ', obrigada por contar o que aconteceu e desculpe o transtorno. Pode me passar mais detalhes por aqui? Quero resolver e garantir que o próximo pedido saia como você merece.';
  }
  function responder(id) {
    var a = S().lista.filter(function (x) { return x.id === id; })[0], txt = ($('#pvResp') || {}).value;
    if (!a || !txt || !txt.trim()) { ctx.toast('Escreva a resposta antes de enviar.'); return; }
    a.respondida = true; a.resposta = txt.trim(); F.respondendo = null; PV.salvar();
    var l = achaLead(a.cliente, a.pedido);
    if (l) {
      msg(l, 'j', a.resposta, Date.now(), false);
      if (!l.resp) l.resp = 'Júlia';
      var D = I.dados(); if (D.conv && D.conv.meta[l.id]) D.conv.meta[l.id].precisa = '';
      l.nao = 0; refrescaConversas();
    }
    ctx.toast('Resposta enviada a ' + a.cliente + ' pelo WhatsApp (simulado).');
    atualizaTelas();
  }
  function simular(pedidoId) {
    var p = pedidoObj(pedidoId), n = +($('#sim-' + pedidoId) || {}).value || 5;
    if (!p || PV.doPedido(pedidoId)) return;
    var bank = PV.COMENTARIOS[n];
    PV.avaliar({ pedido: p.id, cliente: p.cliente, fone: p.fone, nota: n, comentario: bank[Math.floor(Math.random() * bank.length)], indicou: n >= 4 && Math.random() > .4, origem: 'WhatsApp' });
    sincroniza(); ctx.toast(p.cliente + ' respondeu com nota ' + n + '. Veja na conversa dele.'); atualizaTelas();
  }

  /* ---------- telas e eventos ---------- */
  function render(m, tela) { sincroniza(); if (m === 'receitas') receitas(tela); else avaliacoes(tela); }
  function atualizaTelas() {
    var m = ctx.modulo(), t = $('#tela');
    if (m === 'avaliacoes') { var y = window.scrollY; avaliacoes(t); window.scrollTo(0, y); } ctx.selos();
  }
  function pendentesBaixas() { return S().lista.filter(function (a) { return PV.baixa(a) && !a.respondida; }).length; }

  document.addEventListener('click', function (e) {
    var m = ctx && ctx.modulo(); if (m !== 'receitas' && m !== 'avaliacoes') return;
    var t = e.target.closest('button'); if (!t) return;
    var s = S();
    if (t.id === 'pvRecAtiva') { s.receitas.ativa = !s.receitas.ativa; PV.salvar(); receitas($('#tela')); ctx.toast(s.receitas.ativa ? 'Envio do link de receitas ligado.' : 'Envio do link de receitas desligado. Nenhuma mensagem sai até religar.'); }
    else if (t.id === 'pvRecTextoSalvar') { var tx0 = $('#pvRecTexto').value.trim(); if (!tx0 || tx0.indexOf('{link}') < 0) { ctx.toast('A mensagem precisa ter o {link} da página de receitas.'); return; } s.receitas.texto = tx0; PV.salvar(); receitas($('#tela')); ctx.toast('Mensagem do link de receitas salva.'); }
    else if (t.id === 'pvRecTextoPadrao') { s.receitas.texto = PV.MSG_RECEITAS; PV.salvar(); receitas($('#tela')); ctx.toast('Mensagem padrão restaurada.'); }
    else if (t.dataset.recF) { F.recProd = t.dataset.recF; receitas($('#tela')); }
    else if (t.dataset.recSalvar) {
      var id = t.dataset.recSalvar, ln = function (k) { return $('#' + k + '-' + id).value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
      var ed = { titulo: $('#rt-' + id).value.trim(), tempo: $('#rm-' + id).value.trim(), porcoes: Math.max(1, +$('#rp-' + id).value || 1), ingr: ln('ri'), prep: ln('rs') };
      if (!ed.titulo || !ed.ingr.length || !ed.prep.length) { ctx.toast('A receita precisa de título, ingredientes e modo de preparo.'); return; }
      s.receitas.edits[id] = ed; PV.salvar(); var y = window.scrollY; receitas($('#tela')); window.scrollTo(0, y); ctx.toast('Receita salva. A página pública já mostra o novo texto.');
    }
    else if (t.dataset.recPadrao) { delete s.receitas.edits[t.dataset.recPadrao]; PV.salvar(); var y2 = window.scrollY; receitas($('#tela')); window.scrollTo(0, y2); ctx.toast('Texto padrão restaurado.'); }
    else if (t.id === 'pvAvalAtiva') { s.aval.ativa = !s.aval.ativa; PV.salvar(); atualizaTelas(); ctx.toast(s.aval.ativa ? 'Pedido de avaliação ligado.' : 'Pedido de avaliação desligado, também na loja.'); }
    else if (t.id === 'pvAvalSalvar') { var tx = $('#pvAvalTexto').value.trim(); if (!tx) { ctx.toast('O texto não pode ficar vazio.'); return; } s.aval.texto = tx; PV.salvar(); ctx.toast('Texto do pedido de avaliação salvo.'); }
    else if (t.id === 'pvAvalPadrao') { s.aval.texto = PV.MSG_AVALIACAO; PV.salvar(); atualizaTelas(); ctx.toast('Texto padrão restaurado.'); }
    else if (t.dataset.pvF) { F.filtro = t.dataset.pvF; F.respondendo = null; atualizaTelas(); }
    else if (t.dataset.pvResp) { var a = s.lista.filter(function (x) { return x.id === t.dataset.pvResp; })[0]; F.respondendo = a.id; F.rascunho = sugestao(a); desenhaLista(); var c = $('#pvResp'); if (c) c.focus(); }
    else if (t.dataset.pvCancela !== undefined) { F.respondendo = null; desenhaLista(); }
    else if (t.dataset.pvEnviar) responder(t.dataset.pvEnviar);
    else if (t.dataset.pvSim) simular(t.dataset.pvSim);
  });

  window.PVA = {
    init: function (c) {
      ctx = c; I = window.CRM.i; PV.recarregar(); semear(); sincroniza();
      setInterval(function () {
        PV.recarregar();
        var s = S();
        ctx.estado().pedidos.forEach(function (p) { if (!s.processados[p.id] && entregue(p)) posEntrega(p, Date.now(), true); });
      }, 2000);
      window.addEventListener('storage', function (e) {
        if (e.key !== PV.CHAVE) return;
        sincroniza(); ctx.selos();
        var mod = ctx.modulo(); if (mod === 'avaliacoes') atualizaTelas();
      });
    },
    render: render, pendentesBaixas: pendentesBaixas,
    // usado pelas novidades (recompra, lote fresco, saída para entrega): mensagem da IA na conversa do cliente
    avisar: function (cli, texto, origem) {
      var D = I.dados(), digs = String(cli.fone || '').replace(/\D/g, '');
      var l = D.leads.filter(function (x) { return digs && String(x.fone).replace(/\D/g, '') === digs; })[0] || D.leads.filter(function (x) { return x.nome === cli.nome; })[0];
      if (!l) {
        var t = Date.now();
        l = { id: 'l' + t, nome: cli.nome, fone: cli.fone, origem: origem || 'Cliente', etapa: 'vendido', valor: 0, itens: '', etq: [], resp: '', nao: 0, vendido: true, clienteId: cli.id || null, optout: false, ultimoDisparo: 0, bairro: cli.bairro || '',
          msgs: [], hist: [{ ts: t, t: 'Contato criado — origem: ' + (origem || 'Cliente') }] };
        D.leads.unshift(l);
      }
      if (l.optout) return null;
      msg(l, 'j', texto, Date.now(), true); contaIA(1); refrescaConversas();
      return l;
    },
    reset: function () { PV.reset(); F.filtro = 'todas'; F.respondendo = null; PV.recarregar(); semear(); }
  };
})();
