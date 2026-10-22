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
  var cv = { sel: null, busca: '', filtro: 'todas', etq: '', resp: '', etapa: '', perfil: true, aba: 'msg', rap: false, mobile: 'lista' };
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
  function corAvatar(n) { var s = 0; for (var i = 0; i < n.length; i++) s += n.charCodeAt(i); return ['#0d5c6b', '#e8622a', '#8a4fbf', '#1f8a4c', '#c77d0a', '#d6336c'][s % 6]; }
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

  /* ---------- CONVERSAS ---------- */
  function filtradas() {
    var b = cv.busca.toLowerCase().trim(), nb = digitos(cv.busca);
    return D.leads.filter(function (l) {
      if (cv.filtro === 'nao' && !l.nao) return false;
      if (cv.etq && l.etq.indexOf(cv.etq) < 0) return false;
      if (cv.resp === '__sem' ? !!l.resp : (cv.resp && l.resp !== cv.resp)) return false;
      if (cv.etapa && l.etapa !== cv.etapa) return false;
      if (b) {
        var achou = l.nome.toLowerCase().indexOf(b) >= 0 || (nb && digitos(l.fone).indexOf(nb) >= 0) ||
          l.msgs.some(function (m) { return m.d !== 's' && m.t.toLowerCase().indexOf(b) >= 0; });
        if (!achou) return false;
      }
      return true;
    }).sort(function (a, b2) { return ordemUlt(b2) - ordemUlt(a); });
  }
  function conversas(param, tela) {
    if (param && lead(param)) { cv.sel = param; cv.mobile = 'chat'; }
    if (!cv.sel) cv.sel = null;
    var opResp = '<option value="">Todos os responsáveis</option><option value="__sem"' + (cv.resp === '__sem' ? ' selected' : '') + '>Sem responsável</option>' +
      ATENDENTES.map(function (a) { return '<option' + (cv.resp === a ? ' selected' : '') + '>' + a + '</option>'; }).join('');
    var opEtq = '<option value="">Todas as etiquetas</option>' + D.etiquetas.map(function (e) { return '<option' + (cv.etq === e ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('');
    var opEtapa = '<option value="">Todas as etapas</option>' + ETAPAS.map(function (e) { return '<option value="' + e[0] + '"' + (cv.etapa === e[0] ? ' selected' : '') + '>' + e[1] + '</option>'; }).join('');
    tela.innerHTML = '<div class="cab"><div><h1>Conversas</h1><p>Atendimento dos leads no estilo WhatsApp Web. Demonstração: as mensagens enviadas aqui são simuladas e não saem do navegador.</p></div></div>' +
      '<div class="cv ' + (cv.perfil ? 'com-perfil ' : '') + 'm-' + cv.mobile + '">' +
      '<section class="cv-lista" aria-label="Lista de conversas">' +
      '<div class="cv-busca"><input type="search" id="cvBusca" placeholder="Buscar nome, telefone ou mensagem" value="' + esc(cv.busca) + '" aria-label="Buscar conversas"></div>' +
      '<div class="cv-chips" id="cvChips"></div>' +
      '<div class="cv-selects"><select id="cvResp" aria-label="Responsável">' + opResp + '</select><select id="cvEtq" aria-label="Etiqueta">' + opEtq + '</select><select id="cvEtapa" aria-label="Etapa do funil">' + opEtapa + '</select></div>' +
      '<div class="cv-itens" id="cvItens"></div></section>' +
      '<section class="cv-chat" id="cvChat" aria-label="Conversa"></section>' +
      '<aside class="cv-perfil" id="cvPerfil" aria-label="Perfil do lead"></aside></div>';
    desenhaLista(); desenhaChat(); desenhaPerfil();
  }
  function desenhaLista() {
    var todas = D.leads.length, nao = D.leads.filter(function (l) { return l.nao; }).length;
    $('#cvChips').innerHTML = '<button class="filtro' + (cv.filtro === 'todas' ? ' ativo' : '') + '" data-cvf="todas">Todas<b>' + todas + '</b></button><button class="filtro' + (cv.filtro === 'nao' ? ' ativo' : '') + '" data-cvf="nao">Não lidas<b>' + nao + '</b></button>';
    var ls = filtradas();
    $('#cvItens').innerHTML = ls.length ? ls.map(function (l) {
      var u = ultima(l), pre = u ? (u.d === 'j' ? 'Você: ' : '') + u.t : '';
      return '<button class="cv-item' + (cv.sel === l.id ? ' ativo' : '') + '" data-cvabre="' + l.id + '">' + avatar(l.nome) +
        '<span class="cv-item-meio"><span class="cv-item-topo"><b>' + esc(l.nome) + '</b><time>' + (u ? hora(u.ts) : '') + '</time></span>' +
        '<span class="cv-pre">' + esc(pre) + '</span>' +
        '<span class="cv-item-pe">' + l.etq.slice(0, 2).map(chipEtq).join('') + '<span class="cv-etapa">' + esc(etapaRot(l.etapa)) + '</span></span></span>' +
        (l.nao ? '<span class="cv-nao" aria-label="' + l.nao + ' não lidas">' + l.nao + '</span>' : '') + '</button>';
    }).join('') : '<p class="vazio">Nenhuma conversa neste filtro.</p>';
  }
  function bolha(m) {
    if (m.d === 's') return '<div class="cv-sis"><span>' + esc(m.t) + '</span></div>';
    if (m.d === 'n') return '<div class="cv-nota"><small>Nota interna · ' + esc(m.por || '') + ' · só a equipe vê</small>' + esc(m.t) + '<time>' + hora(m.ts) + '</time></div>';
    var tick = m.d === 'j' ? '<span class="cv-tick ' + (m.st === 'lida' ? 'lida' : '') + '" aria-label="' + (m.st || 'enviada') + '">' + (m.st === 'enviada' ? '✓' : '✓✓') + '</span>' : '';
    return '<div class="cv-msg ' + m.d + '">' + (m.camp ? '<small class="cv-camp">Campanha: ' + esc(m.camp) + '</small>' : '') + esc(m.t).replace(/\n/g, '<br>') + '<time>' + hora(m.ts) + tick + '</time></div>';
  }
  function desenhaChat() {
    var el = $('#cvChat'); if (!el) return;
    var l = cv.sel ? lead(cv.sel) : null;
    if (!l) { el.innerHTML = '<div class="cv-vazio"><div class="cv-vazio-ic">◎</div><h2>Selecione uma conversa</h2><p>Escolha um lead na lista para ver o histórico, responder, anotar e mover no funil.</p></div>'; return; }
    var msgs = '', dia = '';
    l.msgs.forEach(function (m) { var r = diaRotulo(m.ts); if (r !== dia) { dia = r; msgs += '<div class="cv-dia"><span>' + esc(r) + '</span></div>'; } msgs += bolha(m); });
    var opEtapa = ETAPAS.map(function (e) { return '<option value="' + e[0] + '"' + (l.etapa === e[0] ? ' selected' : '') + '>' + e[1] + '</option>'; }).join('');
    var opResp = '<option value="">Sem responsável</option>' + ATENDENTES.map(function (a) { return '<option' + (l.resp === a ? ' selected' : '') + '>' + a + '</option>'; }).join('');
    el.innerHTML = '<header class="cv-cab"><button class="cv-volta" data-cvvolta aria-label="Voltar à lista">←</button>' + avatar(l.nome) +
      '<div class="cv-cab-nome"><b>' + esc(l.nome) + '</b><small>' + esc(l.fone) + ' · ' + esc(catOf(l).rot) + '</small></div>' +
      '<label class="sr" for="cvEtapaL">Etapa</label><select id="cvEtapaL" class="peq" data-cvetapa="' + l.id + '">' + opEtapa + '</select>' +
      '<label class="sr" for="cvRespL">Responsável</label><select id="cvRespL" class="peq" data-cvresp="' + l.id + '">' + opResp + '</select>' +
      '<button class="btn pequeno linha" data-cvperfil>' + (cv.perfil ? 'Ocultar perfil' : 'Ver perfil') + '</button></header>' +
      (l.optout ? '<div class="cv-aviso">Este contato pediu para sair (SAIR). Está fora de todas as campanhas; você ainda pode responder manualmente se ele escrever.</div>' : '') +
      '<div class="cv-msgs" id="cvMsgs">' + msgs + '</div>' +
      '<div class="cv-compor"><div class="cv-abas" role="tablist"><button role="tab" class="' + (cv.aba === 'msg' ? 'ativo' : '') + '" data-cvaba="msg">Mensagem</button><button role="tab" class="' + (cv.aba === 'nota' ? 'ativo nota' : '') + '" data-cvaba="nota">Nota interna</button>' +
      '<button class="cv-rap-b" data-cvrap aria-expanded="' + cv.rap + '">⚡ Respostas rápidas</button></div>' +
      '<div class="cv-rap" id="cvRap"' + (cv.rap ? '' : ' hidden') + '></div>' +
      '<div class="cv-linha ' + (cv.aba === 'nota' ? 'nota' : '') + '"><textarea id="cvTexto" rows="2" placeholder="' + (cv.aba === 'nota' ? 'Anotação interna (o cliente não recebe)' : 'Escreva uma mensagem — digite / para respostas rápidas') + '" aria-label="Mensagem"></textarea>' +
      '<button class="btn mar" data-cvenviar>' + (cv.aba === 'nota' ? 'Salvar nota' : 'Enviar') + '</button></div>' +
      '<small class="cv-dica">Envio simulado — nada sai deste navegador. Enter envia, Shift+Enter quebra a linha.</small></div>';
    desenhaRapidas('');
    var m = $('#cvMsgs'); if (m) m.scrollTop = m.scrollHeight;
  }
  function desenhaRapidas(filtro) {
    var el = $('#cvRap'); if (!el) return;
    var l = lead(cv.sel);
    var lista = RAPIDAS.filter(function (r) { return !filtro || r[0].indexOf(filtro) === 0 || r[1].toLowerCase().indexOf(filtro.slice(1)) >= 0; });
    el.innerHTML = lista.length ? lista.map(function (r, i) { return '<button data-cvusa="' + RAPIDAS.indexOf(r) + '"><b>' + r[0] + '</b><span>' + esc(r[1].replace(/\{nome\}/g, primeiro(l.nome))) + '</span></button>'; }).join('') : '<p class="vazio">Nenhuma resposta rápida com esse atalho.</p>';
  }
  function desenhaPerfil() {
    var el = $('#cvPerfil'); if (!el) return;
    var l = cv.sel ? lead(cv.sel) : null;
    el.hidden = !l || !cv.perfil;
    if (!l) { el.innerHTML = ''; return; }
    var c = cliente(l), cat = catOf(l), S = ctx.estado();
    var peds = S.pedidos.filter(function (p) { return p.cliente === l.nome; }).slice(0, 4);
    var etqs = D.etiquetas.map(function (e) { return '<button class="cv-etq ' + etqCls(e) + (l.etq.indexOf(e) >= 0 ? ' on' : '') + '" data-cvetq="' + esc(e) + '" aria-pressed="' + (l.etq.indexOf(e) >= 0) + '">' + esc(e) + '</button>'; }).join('');
    el.innerHTML = '<div class="cv-p-topo">' + avatar(l.nome) + '<div><h2>' + esc(l.nome) + '</h2><span class="chip ' + cat.cls + '">' + cat.rot + '</span></div></div>' +
      '<dl class="cv-dl"><dt>Telefone</dt><dd>' + esc(l.fone) + '</dd><dt>Origem</dt><dd>' + esc(l.origem) + '</dd>' +
      (l.bairro ? '<dt>Bairro</dt><dd>' + esc(l.bairro) + '</dd>' : '') +
      '<dt>Interesse</dt><dd>' + esc(l.itens) + '</dd><dt>Valor em negociação</dt><dd>' + ctx.brl(l.valor) + '</dd>' +
      '<dt>Etapa</dt><dd>' + esc(etapaRot(l.etapa)) + '</dd><dt>Responsável</dt><dd>' + esc(l.resp || 'Sem responsável') + '</dd>' +
      '<dt>Disparos</dt><dd>' + (l.optout ? '<span class="chip perigo">Pediu para sair (opt-out)</span>' : '<span class="chip ok">Pode receber campanhas</span>') + '</dd></dl>' +
      '<h3 class="cv-h3">Carteira</h3>' + (c ? '<p class="cv-p">' + c.pedidos + ' pedidos · ' + ctx.brl(c.total) + ' comprados · última compra ' + ctx.ha(c.ultima) + '.</p>' : '<p class="cv-p">Ainda não comprou: classificado como prospect.</p>') +
      '<h3 class="cv-h3">Etiquetas</h3><div class="cv-etqs">' + etqs + '</div>' +
      '<form class="cv-novaetq" data-cvnova><input id="cvNovaEtq" maxlength="20" placeholder="Nova etiqueta" aria-label="Nova etiqueta"><button class="btn pequeno claro">Criar</button></form>' +
      '<h3 class="cv-h3">Pedidos</h3>' + (peds.length ? peds.map(function (p) { return '<div class="cv-ped"><b>' + p.id + '</b><span>' + ctx.brl(ctx.totalPedido(p)) + '</span><small>' + (p.confirmado ? 'Confirmado' : 'Aguardando confirmação') + '</small></div>'; }).join('') : '<p class="cv-p">Nenhum pedido registrado na loja.</p>') +
      (l.vendido ? '<div class="caixa-venda venda-feita"><h3>Venda confirmada</h3><p>Venda de ' + ctx.brl(l.valor) + ' registrada. Veja o registro no Funil.</p></div>'
        : '<div class="caixa-venda"><h3>Confirmar a venda</h3><p>Move o lead para Vendido, soma na carteira e gera o registro do evento de venda (simulado).</p><button class="btn verde" data-cvvenda="' + l.id + '">Confirmar venda</button></div>') +
      '<h3 class="cv-h3">Histórico</h3><ol class="cv-hist">' + l.hist.slice().reverse().slice(0, 12).map(function (h) { return '<li><time>' + ctx.dataHora(h.ts) + '</time>' + esc(h.t) + '</li>'; }).join('') + '</ol>' +
      '<button class="btn pequeno linha cv-sair" data-cvsair="' + l.id + '"' + (l.optout ? ' disabled' : '') + '>Simular cliente respondendo SAIR</button>';
  }
  function abreConversa(id) {
    var l = lead(id); if (!l) return;
    cv.sel = id; cv.mobile = 'chat'; l.nao = 0; salvar();
    desenhaLista(); desenhaChat(); desenhaPerfil();
    var raiz = $('.cv'); if (raiz) raiz.className = 'cv ' + (cv.perfil ? 'com-perfil ' : '') + 'm-' + cv.mobile;
    ctx.selos();
  }
  function enviar() {
    var l = lead(cv.sel), ta = $('#cvTexto'); if (!l || !ta) return;
    var t = ta.value.trim(); if (!t) { toast('Escreva algo antes de enviar.'); return; }
    if (cv.aba === 'nota') {
      l.msgs.push({ d: 'n', t: t, ts: agora(), por: l.resp || 'Júlia' }); hist(l, 'Nota interna adicionada.'); salvar();
      cv.rap = false; desenhaChat(); desenhaPerfil(); desenhaLista(); toast('Nota salva. O cliente não vê.'); return;
    }
    if (!l.resp) { l.resp = 'Júlia'; sistema(l, 'Conversa atribuída a Júlia ao responder.'); }
    var m = { d: 'j', t: t, ts: agora(), st: 'enviada' }; l.msgs.push(m); l.nao = 0; salvar();
    cv.rap = false; desenhaChat(); desenhaLista(); desenhaPerfil(); ctx.selos();
    var id = l.id;
    setTimeout(function () { m.st = 'entregue'; salvar(); if (cv.sel === id && ctx.modulo() === 'conversas') desenhaChat(); }, 900);
    setTimeout(function () { m.st = 'lida'; salvar(); if (cv.sel === id && ctx.modulo() === 'conversas') desenhaChat(); }, 2000);
    if (!l.optout) setTimeout(function () {
      var r = RESPOSTAS[Math.floor(Math.random() * RESPOSTAS.length)];
      l.msgs.push({ d: 'c', t: r, ts: agora() });
      if (!(cv.sel === id && ctx.modulo() === 'conversas')) l.nao = (l.nao || 0) + 1;
      salvar(); ctx.selos();
      if (ctx.modulo() === 'conversas') { desenhaLista(); if (cv.sel === id) desenhaChat(); }
    }, 4200);
  }
  function clienteSair(l) {
    if (l.optout) return;
    l.msgs.push({ d: 'c', t: 'SAIR', ts: agora() });
    CRM.registraOptout(l, 'Cliente respondeu SAIR: removido de todas as campanhas futuras.');
    desenhaChat(); desenhaLista(); desenhaPerfil();
    toast(primeiro(l.nome) + ' entrou na lista de opt-out e não recebe mais disparos.');
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
    if (m === 'conversas') {
      if (t.dataset.cvabre) abreConversa(t.dataset.cvabre);
      else if (t.dataset.cvf) { cv.filtro = t.dataset.cvf; desenhaLista(); }
      else if (t.dataset.cvvolta !== undefined) { cv.mobile = 'lista'; $('.cv').className = 'cv ' + (cv.perfil ? 'com-perfil ' : '') + 'm-lista'; }
      else if (t.dataset.cvperfil !== undefined) { cv.perfil = !cv.perfil; var raiz = $('.cv'); raiz.className = 'cv ' + (cv.perfil ? 'com-perfil ' : '') + 'm-' + cv.mobile; desenhaChat(); desenhaPerfil(); }
      else if (t.dataset.cvaba) { cv.aba = t.dataset.cvaba; var tx = ($('#cvTexto') || {}).value || ''; desenhaChat(); $('#cvTexto').value = tx; $('#cvTexto').focus(); }
      else if (t.dataset.cvrap !== undefined) { cv.rap = !cv.rap; var r = $('#cvRap'); r.hidden = !cv.rap; t.setAttribute('aria-expanded', cv.rap); }
      else if (t.dataset.cvusa) { var l = lead(cv.sel), q = RAPIDAS[+t.dataset.cvusa]; $('#cvTexto').value = q[1].replace(/\{nome\}/g, primeiro(l.nome)); cv.rap = false; $('#cvRap').hidden = true; $('#cvTexto').focus(); }
      else if (t.dataset.cvenviar !== undefined) enviar();
      else if (t.dataset.cvetq) { alternaEtq(lead(cv.sel), t.dataset.cvetq); desenhaPerfil(); desenhaLista(); }
      else if (t.dataset.cvvenda) { confirmarVenda(lead(t.dataset.cvvenda)); desenhaChat(); desenhaPerfil(); desenhaLista(); ctx.selos(); }
      else if (t.dataset.cvsair) clienteSair(lead(t.dataset.cvsair));
    } else if (m === 'funil') {
      if (t.dataset.fnabre) { location.hash = '#conversas/' + t.dataset.fnabre; }
      else if (t.dataset.fnvenda) { confirmarVenda(lead(t.dataset.fnvenda)); desenhaKanban(); desenhaLogVendas(); }
    }
  });
  document.addEventListener('change', function (e) {
    if (!D) return; var id = e.target.id, m = ctx.modulo();
    if (m === 'conversas') {
      if (id === 'cvResp') { cv.resp = e.target.value; desenhaLista(); }
      else if (id === 'cvEtq') { cv.etq = e.target.value; desenhaLista(); }
      else if (id === 'cvEtapa') { cv.etapa = e.target.value; desenhaLista(); }
      else if (e.target.dataset.cvetapa) { var l = lead(e.target.dataset.cvetapa); mudaEtapa(l, e.target.value, l.resp || 'Júlia'); desenhaChat(); desenhaPerfil(); desenhaLista(); }
      else if (e.target.dataset.cvresp !== undefined && e.target.dataset.cvresp) { atribui(lead(e.target.dataset.cvresp), e.target.value); desenhaChat(); desenhaPerfil(); desenhaLista(); toast(e.target.value ? 'Conversa atribuída a ' + e.target.value + '.' : 'Atribuição removida.'); }
    } else if (m === 'funil') {
      if (id === 'fnResp') { fn.resp = e.target.value; desenhaKanban(); }
      else if (id === 'fnEtq') { fn.etq = e.target.value; desenhaKanban(); }
    }
  });
  document.addEventListener('input', function (e) {
    if (!D) return; var m = ctx.modulo();
    if (m === 'conversas' && e.target.id === 'cvBusca') { cv.busca = e.target.value; desenhaLista(); }
    else if (m === 'conversas' && e.target.id === 'cvTexto') {
      var v = e.target.value;
      if (v.charAt(0) === '/' && cv.aba === 'msg') { cv.rap = true; $('#cvRap').hidden = false; desenhaRapidas(v.split(' ')[0]); }
      else if (cv.rap && v.charAt(0) !== '/') { cv.rap = false; $('#cvRap').hidden = true; }
    } else if (m === 'funil' && e.target.id === 'fnBusca') { fn.busca = e.target.value; desenhaKanban(); }
  });
  document.addEventListener('submit', function (e) {
    if (!D) return;
    if (e.target.dataset.cvnova === undefined) return;
    e.preventDefault();
    var inp = $('#cvNovaEtq'), nome = inp.value.trim().replace(/\s+/g, ' ');
    if (!nome) { toast('Digite o nome da etiqueta.'); return; }
    if (D.etiquetas.some(function (x) { return x.toLowerCase() === nome.toLowerCase(); })) { toast('Essa etiqueta já existe.'); return; }
    D.etiquetas.push(nome); alternaEtq(lead(cv.sel), nome); desenhaPerfil(); desenhaLista(); toast('Etiqueta “' + nome + '” criada e aplicada.');
  });
  document.addEventListener('keydown', function (e) {
    if (!D || e.target.id !== 'cvTexto') return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
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
      if (m === 'conversas') conversas(param, tela);
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
      primeiro: primeiro, sistema: sistema, lead: lead, ETAPAS: ETAPAS, hora: hora, etqCls: etqCls, chipEtq: chipEtq, ETQ_BASE: ETQ_BASE
    }
  };
})();
