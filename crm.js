/* CRM da Julia Pescados — conversas, funil e base das campanhas (demonstração: tudo no navegador, nada é enviado) */
(function () {
  var K = 'jp_crm_v1';
  var ctx = null, D = null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var ETAPAS = [['novo', 'Novo contato'], ['conversa', 'Em conversa'], ['orcamento', 'Orçamento enviado'], ['pago', 'Pagamento recebido'], ['vendido', 'Vendido']];
  var ATENDENTES = ['Júlia', 'Marina', 'Pedro'];
  var ETQ_BASE = { 'Atacado': 'mar', 'Restaurante': 'laranja', 'Pix': 'ok', 'Urgente': 'perigo', 'Retirada': 'cinza', 'Indicação': 'rosa', 'Reativar': 'alerta' };
  var RAPIDAS = [
    ['/bomdia', 'Bom dia, {nome}! Aqui é da Julia Pescados. Como posso ajudar?'],
    ['/precos', 'Hoje temos camarão cinza a R$ 49,90/kg, filé de tilápia a R$ 36,90/kg e o Kit Churrasco do Mar a R$ 84,90. Quer que eu monte seu pedido?'],
    ['/entrega', 'Entregamos em Fortaleza e Caucaia. A taxa varia por bairro (de R$ 6,00 a R$ 22,00) e o prazo médio é de 60 a 90 minutos.'],
    ['/pix', 'Pode pagar no Pix, {nome}. Assim que cair, já separamos o pedido e avisamos a saída para entrega.'],
    ['/orcamento', 'Segue o orçamento, {nome}. A validade é de 24 horas e os preços podem mudar conforme a pesca do dia.'],
    ['/obrigado', 'Obrigada pela preferência, {nome}! Qualquer coisa é só chamar por aqui.']
  ];
  var RESPOSTAS = ['Beleza, pode ser!', 'Obrigado, vou ver aqui e já te falo.', 'Pode mandar o Pix então.', 'Combinado, fico no aguardo.', 'Perfeito! Qual o prazo de entrega?', 'Tem como entregar ainda hoje?'];
  var fn = { busca: '', etq: '', resp: '' };

  function esc(t) { return ctx.esc(t); }
  function toast(m) { ctx.toast(m); }
  function agora() { return Date.now(); }
  function minAtras(n) { return agora() - n * 60000; }
  function digitos(f) { return String(f || '').replace(/\D/g, ''); }
  function primeiro(n) { return String(n || '').split(' ')[0]; }
  function hora(ts) { return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function diaRotulo(ts) {
    var d = new Date(ts), h = new Date(), ontem = new Date(); ontem.setDate(h.getDate() - 1);
    if (d.toDateString() === h.toDateString()) return 'Hoje';
    if (d.toDateString() === ontem.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  }
  function iniciais(n) { var p = String(n).split(' ').filter(function (x) { return x.length > 2 || /^[A-Z]/.test(x); }); return ((p[0] || '?')[0] + ((p[1] || '')[0] || '')).toUpperCase(); }
  function corAvatar(n) { var s = 0; for (var i = 0; i < n.length; i++) s += n.charCodeAt(i); return ['#0b4a5c', '#9c2417', '#6b3fa0', '#1d7a43', '#8a5d00', '#b02a63'][s % 6]; }
  function avatar(n) { return '<span class="cv-av" style="background:' + corAvatar(n) + '" aria-hidden="true">' + esc(iniciais(n)) + '</span>'; }

  /* ---------- dados de exemplo ---------- */
  function semente() {
    var S = ctx.estado();
    var base = [
      { id: 'l1', nome: 'Hotel Terral Praia', fone: '(85) 98701-3321', origem: 'Indicação', etapa: 'novo', valor: 2400, itens: 'Camarão VG 30 kg/semana', etq: ['Atacado', 'Indicação'], resp: 'Júlia', nao: 1, msgs: [['c', 'Boa tarde! Vi vocês no Instagram. Vocês entregam camarão no atacado para hotel?', 190], ['j', 'Boa tarde! Entregamos sim, Fortaleza e Caucaia. Qual volume semanal?', 185], ['c', 'Em torno de 30 kg de camarão VG.', 22]] },
      { id: 'l2', nome: 'Sabrina Oliveira', fone: '(85) 98604-7712', origem: 'Instagram — Stories', etapa: 'novo', valor: 190, itens: 'Kit Churrasco do Mar', etq: ['Pix'], resp: '', nao: 1, msgs: [['c', 'Oi, quanto está o kit churrasco?', 9], ['j', 'Oi, Sabrina! O Kit Churrasco do Mar está R$ 84,90.', 8], ['c', 'Tem para entregar hoje no Cocó?', 3]] },
      { id: 'l3', nome: 'Bar do Zeca', fone: '(85) 98219-0045', origem: 'Indicação', etapa: 'conversa', valor: 1850, itens: 'Anéis de lula 20 kg + camarão 15 kg', etq: ['Atacado', 'Restaurante', 'Urgente'], resp: 'Marina', nao: 2, cli: 'Bar do Zeca', msgs: [['c', 'Preciso de lula e camarão para sexta.', 75], ['j', 'Consigo entregar na quinta à tarde. Fecha?', 70], ['c', 'Me passa o valor fechado.', 14], ['c', 'Se der até as 17h eu já confirmo.', 13]] },
      { id: 'l4', nome: 'Rodrigo Brandão', fone: '(85) 98903-5521', origem: 'Instagram', etapa: 'conversa', valor: 260, itens: 'Camarão descascado 2 kg + filé 1 kg', etq: [], resp: 'Pedro', nao: 0, msgs: [['c', 'Entregam no Cambeba?', 130], ['j', 'Entregamos! A taxa é R$ 14,00.', 126]] },
      { id: 'l5', nome: 'Cantina da Nona', fone: '(85) 98650-1177', origem: 'Cliente recorrente', etapa: 'orcamento', valor: 1320, itens: 'Camarão cinza 15 kg + mix frutos do mar 5 kg', etq: ['Atacado', 'Restaurante', 'Pix'], resp: 'Marina', nao: 1, cli: 'Cantina da Nona', msgs: [['j', 'Segue o orçamento do pedido semanal.', 300], ['c', 'Pode fechar, pago no Pix.', 40]] },
      { id: 'l6', nome: 'Helena Barros', fone: '(85) 98305-8870', origem: 'Instagram', etapa: 'orcamento', valor: 215, itens: 'Filé de salmão 1 kg + camarão 2 kg', etq: [], resp: 'Júlia', nao: 0, msgs: [['j', 'Total R$ 215,00 com entrega.', 1500], ['c', 'Vou confirmar com meu marido e já retorno.', 1490]] },
      { id: 'l7', nome: 'Eduardo Pinheiro', fone: '(85) 98211-3340', origem: 'Cliente recorrente', etapa: 'pago', valor: 358, itens: 'Camarão cinza 3 kg + filé 2 kg', etq: ['Pix'], resp: 'Pedro', nao: 0, cli: 'Eduardo Pinheiro', msgs: [['c', 'Comprovante do Pix enviado.', 52], ['j', 'Recebido! Já separamos o pedido.', 50]] },
      { id: 'l8', nome: 'Gustavo Nogueira', fone: '(85) 98177-2209', origem: 'Indicação', etapa: 'vendido', valor: 980, itens: 'Camarão sem cabeça 15 kg + posta de serra 3 kg', etq: ['Indicação'], resp: 'Júlia', nao: 0, vendido: true, msgs: [['c', 'Entrega recebida, tudo certo.', 2880]] },
      { id: 'l9', nome: 'Carla Mendonça', origem: 'Cliente recorrente', etapa: 'conversa', valor: 310, itens: 'Camarão descascado 2 kg + lula 1 kg', etq: ['Pix'], resp: 'Júlia', nao: 1, cli: 'Carla Mendonça', msgs: [['c', 'Oi! Quero repetir o pedido da semana passada.', 31], ['j', 'Claro, Carla! Camarão descascado 2 kg e lula 1 kg, certo?', 28], ['c', 'Isso! Pode mandar o valor.', 6]] },
      { id: 'l10', nome: 'Restaurante Maré Cheia', origem: 'Cliente recorrente', etapa: 'orcamento', valor: 4200, itens: 'Camarão cinza 40 kg + lula 10 kg', etq: ['Atacado', 'Restaurante'], resp: 'Marina', nao: 0, cli: 'Restaurante Maré Cheia', msgs: [['c', 'Boa tarde, preciso fechar o pedido do fim de semana.', 400], ['j', 'Segue o orçamento: R$ 4.200,00 com entrega. Validade de 24 horas.', 380]] },
      { id: 'l11', nome: 'Silvana Rocha', origem: 'Cliente recorrente', etapa: 'novo', valor: 190, itens: 'Reativação — filé de tilápia', etq: ['Reativar'], resp: '', nao: 0, cli: 'Silvana Rocha', msgs: [['j', 'Oi, Silvana! Faz um tempo que não nos falamos. Chegou tilápia fresquinha.', 4320]] },
      { id: 'l12', nome: 'André Lima', origem: 'Cliente recorrente', etapa: 'novo', valor: 120, itens: 'Reativação', etq: ['Reativar'], resp: '', nao: 0, cli: 'André Lima', optout: true, msgs: [['j', 'Oi, André! Temos novidades em camarão. Quer ver o catálogo?', 6000], ['c', 'SAIR', 5990]] },
      { id: 'l13', nome: 'Mônica Sales', origem: 'Cliente recorrente', etapa: 'pago', valor: 270, itens: 'Kit Família + posta de serra', etq: ['Pix', 'Retirada'], resp: 'Pedro', nao: 0, cli: 'Mônica Sales', msgs: [['c', 'Paguei no Pix, retiro hoje às 16h.', 60], ['j', 'Perfeito, Mônica! Seu pedido estará separado.', 57]] },
      { id: 'l14', nome: 'Tereza Cristina', origem: 'Cliente recorrente', etapa: 'conversa', valor: 150, itens: 'Camarão VG 2 kg', etq: [], resp: '', nao: 0, cli: 'Tereza Cristina', msgs: [['c', 'Vocês têm camarão VG hoje?', 600], ['j', 'Temos sim, R$ 64,90 o quilo. Quantos quilos, Tereza?', 590]] }
    ];
    var usados = {};
    base.forEach(function (b) { if (b.cli) usados[b.cli] = 1; });
    S.clientes.forEach(function (c, i) {
      if (usados[c.nome] || base.some(function (b) { return b.nome === c.nome; })) return;
      var tk = c.total / c.pedidos;
      base.push({ id: 'l' + (15 + i), nome: c.nome, fone: c.fone, origem: 'Cliente recorrente', etapa: 'vendido', valor: Math.round(tk), itens: 'Último pedido da carteira', etq: [], resp: ATENDENTES[i % 3], nao: 0, vendido: true, cli: c.nome, msgs: [['c', 'Oi! Chegou tudo certinho, obrigado.', 1440 + i * 200], ['j', 'Que bom, ' + primeiro(c.nome) + '! Qualquer coisa é só chamar.', 1430 + i * 200]] });
    });
    return base.map(function (b) {
      var cli = b.cli ? S.clientes.filter(function (c) { return c.nome === b.cli; })[0] : null;
      return {
        id: b.id, nome: b.nome, fone: b.fone || (cli && cli.fone) || '', origem: b.origem, etapa: b.etapa, valor: b.valor, itens: b.itens,
        etq: b.etq.slice(), resp: b.resp, nao: b.nao, vendido: !!b.vendido, clienteId: cli ? cli.id : null, optout: !!b.optout, ultimoDisparo: 0,
        bairro: cli ? cli.bairro : '',
        msgs: b.msgs.map(function (m) { return { d: m[0], t: m[1], ts: minAtras(m[2]), st: m[0] === 'j' ? 'lida' : '' }; }),
        hist: [{ ts: minAtras(b.msgs[0][2] + 1), t: 'Contato criado — origem: ' + b.origem }]
      };
    });
  }

  function carregar() {
    try { var s = localStorage.getItem(K); if (s) { D = JSON.parse(s); return D; } } catch (e) {}
    D = { leads: semente(), etiquetas: Object.keys(ETQ_BASE), vendas: [], optout: [], envios: [], camps: [], seqVenda: 1, seqCamp: 1, cfg: null };
    D.leads.forEach(function (l) { if (l.optout) D.optout.push(digitos(l.fone)); });
    CRM.campanhas.semear(D);
    salvar(); return D;
  }
  function salvar() { try { localStorage.setItem(K, JSON.stringify(D)); } catch (e) {} }
  function lead(id) { return D.leads.filter(function (l) { return l.id === id; })[0]; }
  function cliente(l) { return l.clienteId ? ctx.estado().clientes.filter(function (c) { return c.id === l.clienteId; })[0] : null; }
  function catOf(l) { var c = cliente(l); return c ? ctx.categoria(c) : { cod: 'prospect', rot: 'Prospect', cls: 'alerta' }; }
  function etapaRot(cod) { return (ETAPAS.filter(function (e) { return e[0] === cod; })[0] || [0, cod])[1]; }
  function ultima(l) { return l.msgs.filter(function (m) { return m.d !== 'n' && m.d !== 's'; }).slice(-1)[0] || l.msgs.slice(-1)[0]; }
  function ordemUlt(l) { var m = l.msgs[l.msgs.length - 1]; return m ? m.ts : 0; }
  function etqCls(e) { return ETQ_BASE[e] || 'cinza'; }
  function chipEtq(e) { return '<span class="chip ' + etqCls(e) + '">' + esc(e) + '</span>'; }
  function hist(l, t) { l.hist.push({ ts: agora(), t: t }); }
  function sistema(l, t) { l.msgs.push({ d: 's', t: t, ts: agora() }); }
  function naoLidas() { return D ? D.leads.reduce(function (s, l) { return s + (l.nao || 0); }, 0) : 0; }

  /* ---------- ações compartilhadas (conversas e funil) ---------- */
  function mudaEtapa(l, nova, quem) {
    if (l.etapa === nova) return;
    var de = etapaRot(l.etapa);
    l.etapa = nova; if (nova !== 'vendido') l.vendido = false;
    var t = 'Etapa alterada de “' + de + '” para “' + etapaRot(nova) + '”' + (quem ? ' por ' + quem : '') + '.';
    sistema(l, t); hist(l, t); salvar();
  }
  function confirmarVenda(l) {
    if (l.vendido) return;
    var quem = l.resp || 'Júlia';
    l.etapa = 'vendido'; l.vendido = true; if (!l.resp) l.resp = quem;
    var reg = { id: 'VD-' + (1000 + D.seqVenda++), quando: agora(), leadId: l.id, nome: l.nome, fone: l.fone, valor: l.valor, itens: l.itens, resp: quem, origem: 'CRM — conversa com ' + l.nome };
    D.vendas.unshift(reg);
    var c = cliente(l);
    if (c) { c.pedidos += 1; c.total += l.valor; c.ultima = agora(); ctx.salvarEstado(); }
    var t = 'Venda confirmada por ' + quem + ': ' + ctx.brl(l.valor) + ' (registro ' + reg.id + ').';
    sistema(l, t); hist(l, t); salvar();
    toast('Venda confirmada: ' + ctx.brl(l.valor) + '. Registro ' + reg.id + ' gerado (simulado).');
  }
  function atribui(l, quem) {
    l.resp = quem; var t = quem ? 'Conversa atribuída a ' + quem + '.' : 'Atribuição removida.';
    sistema(l, t); hist(l, t); salvar();
  }
  function alternaEtq(l, e) {
    var i = l.etq.indexOf(e);
    if (i >= 0) l.etq.splice(i, 1); else l.etq.push(e);
    hist(l, (i >= 0 ? 'Etiqueta removida: ' : 'Etiqueta adicionada: ') + e); salvar();
  }

  /* ---------- FUNIL (kanban integrado às conversas) ---------- */
  function funil(param, tela) {
    var total = D.leads.filter(function (l) { return l.etapa !== 'vendido'; }).reduce(function (s, l) { return s + l.valor; }, 0);
    var opResp = '<option value="">Todos os responsáveis</option><option value="__sem"' + (fn.resp === '__sem' ? ' selected' : '') + '>Sem responsável</option>' + ATENDENTES.map(function (a) { return '<option' + (fn.resp === a ? ' selected' : '') + '>' + a + '</option>'; }).join('');
    var opEtq = '<option value="">Todas as etiquetas</option>' + D.etiquetas.map(function (e) { return '<option' + (fn.etq === e ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('');
    tela.innerHTML = '<div class="cab"><div><h1>Funil de vendas</h1><p>Arraste os cartões entre as etapas. Cada cartão abre a conversa do lead; soltar em Vendido confirma a venda.</p></div><span class="chip laranja">' + ctx.brl(total) + ' em negociação</span></div>' +
      '<div class="filtros"><select id="fnResp" class="peq" aria-label="Responsável">' + opResp + '</select><select id="fnEtq" class="peq" aria-label="Etiqueta">' + opEtq + '</select><input type="search" id="fnBusca" placeholder="Buscar lead" value="' + esc(fn.busca) + '" aria-label="Buscar lead"></div>' +
      '<div class="kanban" id="kanban"></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Registro de vendas confirmadas <small>simulação — nenhum dado sai deste navegador</small></h2><div class="log" id="logVendas"></div></div>';
    desenhaKanban(); desenhaLogVendas();
  }
  function desenhaKanban() {
    var b = fn.busca.toLowerCase().trim();
    var ls = D.leads.filter(function (l) {
      if (fn.etq && l.etq.indexOf(fn.etq) < 0) return false;
      if (fn.resp === '__sem' ? !!l.resp : (fn.resp && l.resp !== fn.resp)) return false;
      return !b || l.nome.toLowerCase().indexOf(b) >= 0;
    });
    $('#kanban').innerHTML = ETAPAS.map(function (e) {
      var col = ls.filter(function (l) { return l.etapa === e[0]; }).sort(function (a, c) { return ordemUlt(c) - ordemUlt(a); }), tot = col.reduce(function (s, l) { return s + l.valor; }, 0);
      return '<div class="coluna" data-etapa="' + e[0] + '"><h3>' + e[1] + '<small>' + col.length + ' · ' + ctx.brl(tot) + '</small></h3>' +
        col.map(function (l) {
          var u = ultima(l), cat = catOf(l);
          return '<div class="lead" draggable="true" data-lead="' + l.id + '"><button class="lead-abre" data-fnabre="' + l.id + '" aria-label="Abrir conversa de ' + esc(l.nome) + '"><b>' + esc(l.nome) + (l.nao ? '<span class="cv-nao">' + l.nao + '</span>' : '') + '</b>' +
            '<small>' + esc(l.itens) + '</small>' + (u ? '<small class="lead-ult">' + esc((u.d === 'j' ? 'Você: ' : '') + u.t) + '</small>' : '') + '</button>' +
            '<div class="lead-etq">' + l.etq.map(chipEtq).join('') + '<span class="chip ' + cat.cls + '">' + cat.rot + '</span></div>' +
            '<div class="linha-fim"><span>' + ctx.brl(l.valor) + '</span><span class="lead-resp">' + (l.resp ? avatar(l.resp) : '<small>Sem responsável</small>') + '</span></div>' +
            (l.vendido ? '<span class="chip ok">Venda confirmada</span>' : (l.etapa === 'pago' ? '<button class="btn pequeno verde lead-venda" data-fnvenda="' + l.id + '">Confirmar venda</button>' : '')) + '</div>';
        }).join('') + '</div>';
    }).join('');
  }
  function desenhaLogVendas() {
    var el = $('#logVendas'); if (!el) return;
    if (!D.vendas.length) { el.textContent = 'Nenhum registro ainda. Confirme uma venda na conversa ou no funil para ver o evento aqui.'; return; }
    el.innerHTML = D.vendas.map(function (v) {
      var j = { evento: 'venda_confirmada', registro: v.id, quando: new Date(v.quando).toISOString(), origem: 'crm_conversa', cliente: { nome: v.nome, telefone: v.fone }, responsavel: v.resp, moeda: 'BRL', valor: +v.valor.toFixed(2), itens: v.itens };
      return esc(ctx.dataHora(v.quando)) + '  →  ' + esc(v.origem) + '\n' + esc(JSON.stringify(j, null, 2)) + '\n<span class="erro">registrado localmente (simulado)</span>\n';
    }).join('\n');
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    if (!D) return;
    var t = e.target.closest('button'); if (!t) return;
    var m = ctx.modulo();
    if (m === 'funil') {
      if (t.dataset.fnabre) { location.hash = '#conversas/' + t.dataset.fnabre; }
      else if (t.dataset.fnvenda) { confirmarVenda(lead(t.dataset.fnvenda)); desenhaKanban(); desenhaLogVendas(); }
    }
  });
  document.addEventListener('change', function (e) {
    if (!D) return; var id = e.target.id, m = ctx.modulo();
    if (m === 'funil') {
      if (id === 'fnResp') { fn.resp = e.target.value; desenhaKanban(); }
      else if (id === 'fnEtq') { fn.etq = e.target.value; desenhaKanban(); }
    }
  });
  document.addEventListener('input', function (e) {
    if (!D) return; var m = ctx.modulo();
    if (m === 'funil' && e.target.id === 'fnBusca') { fn.busca = e.target.value; desenhaKanban(); }
  });
  // arrastar cartões entre colunas do funil
  var arrastando = null;
  document.addEventListener('dragstart', function (e) { var l = e.target.closest && e.target.closest('.lead'); if (l && ctx && ctx.modulo() === 'funil') { arrastando = l.dataset.lead; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', arrastando); } catch (x) {} } });
  document.addEventListener('dragover', function (e) { var c = e.target.closest && e.target.closest('.coluna'); if (c && arrastando) { e.preventDefault(); document.querySelectorAll('.coluna').forEach(function (x) { x.classList.toggle('sobre', x === c); }); } });
  document.addEventListener('drop', function (e) {
    var c = e.target.closest && e.target.closest('.coluna'); if (!c || !arrastando) return; e.preventDefault();
    var l = lead(arrastando);
    if (l && l.etapa !== c.dataset.etapa) {
      if (c.dataset.etapa === 'vendido') { if (!l.vendido) confirmarVenda(l); }
      else { mudaEtapa(l, c.dataset.etapa, l.resp || 'Júlia'); toast('“' + l.nome + '” movido para ' + etapaRot(c.dataset.etapa) + '.'); }
      desenhaKanban(); desenhaLogVendas(); ctx.selos();
    }
    arrastando = null;
  });
  document.addEventListener('dragend', function () { arrastando = null; document.querySelectorAll('.coluna').forEach(function (x) { x.classList.remove('sobre'); }); });

  /* ---------- API ---------- */
  var CRM = window.CRM = {
    init: function (c) { ctx = c; carregar(); setInterval(function () { CRM.campanhas.tick(); }, 1000); },
    render: function (m, param, tela) {
      if (m === 'conversas') CRM.conv.render(m, param, tela);
      else if (m === 'funil') funil(param, tela);
      else if (m === 'campanhas') CRM.campanhas.render(tela);
    },
    naoLidas: naoLidas,
    reset: function () { try { localStorage.removeItem(K); } catch (e) {} D = null; carregar(); },
    registraOptout: function (l, texto) {
      var d = digitos(l.fone); if (D.optout.indexOf(d) < 0) D.optout.push(d);
      l.optout = true; sistema(l, texto); hist(l, 'Opt-out: pediu para sair dos disparos.'); salvar();
    },
    i: {
      dados: function () { return D; }, salvar: salvar, esc: esc, toast: toast, ctx: function () { return ctx; }, catOf: catOf, digitos: digitos,
      primeiro: primeiro, sistema: sistema, lead: lead, ETAPAS: ETAPAS, hora: hora, etqCls: etqCls, chipEtq: chipEtq, ETQ_BASE: ETQ_BASE,
      ATENDENTES: ATENDENTES, RAPIDAS: RAPIDAS, RESPOSTAS: RESPOSTAS, atribui: atribui, mudaEtapa: mudaEtapa, confirmarVenda: confirmarVenda, alternaEtq: alternaEtq,
      hist: hist, diaRotulo: diaRotulo, etapaRot: etapaRot, ultima: ultima, ordemUlt: ordemUlt, agora: agora, cliente: cliente, corAvatar: corAvatar, iniciais: iniciais
    }
  };
})();
