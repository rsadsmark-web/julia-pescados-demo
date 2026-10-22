/* Loja Julia Pescados — lado do cliente */
(function () {
  var S = JP.estado();
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var carrinho = {};            // id -> quantidade
  var cat = 'Todos', termo = '';
  var tipo = 'entrega', pagamento = 'Pix';
  var form = { nome: '', fone: '', bairro: '', endereco: '', troco: '' };
  var pedidoAcomp = localStorage.getItem('jp_ultimo_pedido') || null;

  try { carrinho = JSON.parse(localStorage.getItem('jp_carrinho') || '{}'); } catch (e) { carrinho = {}; }
  try { form = Object.assign(form, JSON.parse(localStorage.getItem('jp_form') || '{}')); } catch (e) {}

  function prod(id) { return S.produtos.filter(function (p) { return p.id === id; })[0]; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function salvaCarrinho() { localStorage.setItem('jp_carrinho', JSON.stringify(carrinho)); localStorage.setItem('jp_form', JSON.stringify(form)); }

  /* ---------- catálogo ---------- */
  function desenhaCats() {
    var l = ['Todos'].concat(JP.CATEGORIAS);
    $('#cats').innerHTML = l.map(function (c) {
      return '<button class="cat' + (c === cat ? ' ativa' : '') + '" role="tab" aria-selected="' + (c === cat) + '" data-c="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }
  function desenhaGrade() {
    var lista = S.produtos.filter(function (p) {
      return (cat === 'Todos' || p.cat === cat) && (!termo || p.nome.toLowerCase().indexOf(termo) >= 0);
    });
    $('#grade').innerHTML = lista.length ? lista.map(function (p) {
      var sem = p.estoque <= 0;
      return '<article class="card' + (sem ? ' esgotado' : '') + '">' +
        '<div class="card-foto" style="background-image:url(img/' + p.img + ')">' + (p.dest ? '<span class="chip">Mais pedido</span>' : '') + '</div>' +
        '<div class="card-corpo"><h3>' + esc(p.nome) + '</h3><p>' + esc(p.desc) + '</p>' +
        '<div class="card-rodape"><span class="preco">' + JP.brl(p.preco) + ' <small>/ ' + p.un + '</small></span>' +
        '<button class="btn pequeno" data-add="' + p.id + '"' + (sem ? ' disabled' : '') + '>' + (sem ? 'Esgotado' : 'Adicionar') + '</button></div></div></article>';
    }).join('') : '<p class="vazio">Nenhum produto encontrado.</p>';
  }
  function desenhaTaxas() {
    $('#tabelaTaxas').innerHTML = JP.BAIRROS.map(function (b) {
      var f = JP.frete(b.nome);
      return '<div class="taxa"><span>' + esc(b.nome) + '<small>cerca de ' + f.km.toFixed(1).replace('.', ',') + ' km</small></span><b>' + JP.brl(f.total) + '</b></div>';
    }).join('');
  }

  /* ---------- carrinho ---------- */
  function itens() {
    return Object.keys(carrinho).filter(function (id) { return carrinho[id] > 0 && prod(id); }).map(function (id) {
      var p = prod(id); return { id: id, nome: p.nome, un: p.un, preco: p.preco, qtd: carrinho[id], img: p.img };
    });
  }
  function atualizaContador() {
    var n = itens().reduce(function (s, i) { return s + 1 * (i.qtd > 0); }, 0);
    $('#qtdCarrinho').textContent = n;
  }
  function add(id, d) {
    var p = prod(id); if (!p) return;
    var novo = Math.max(0, +((carrinho[id] || 0) + d).toFixed(1));
    if (novo > p.estoque) novo = p.estoque;
    if (novo <= 0) delete carrinho[id]; else carrinho[id] = novo;
    salvaCarrinho(); atualizaContador();
    var b = $('#abrirCarrinho'); b.classList.remove('pulso'); void b.offsetWidth; b.classList.add('pulso');
    if ($('#gaveta').classList.contains('aberta')) desenhaCarrinho();
  }
  function calc() {
    var its = itens(), sub = its.reduce(function (s, i) { return s + i.preco * i.qtd; }, 0);
    var f = tipo === 'entrega' && form.bairro ? JP.frete(form.bairro) : null;
    var taxa = f ? f.total : 0;
    return { its: its, sub: sub, f: f, taxa: taxa, total: sub + taxa };
  }
  function pgtos() { return tipo === 'entrega' ? ['Pix', 'Cartão na entrega', 'Dinheiro'] : ['Pix', 'Cartão na retirada', 'Dinheiro']; }

  function desenhaCarrinho() {
    var c = calc(), el = $('#corpoCarrinho');
    if (!c.its.length) { el.innerHTML = '<p class="vazio">Seu carrinho está vazio.<br>Escolha alguns produtos para começar.</p>'; return; }
    if (pgtos().indexOf(pagamento) < 0) pagamento = 'Pix';
    var h = '<div class="bloco">' + c.its.map(function (i) {
      return '<div class="linha-item"><div class="mini" style="background-image:url(img/' + i.img + ')"></div><div><b>' + esc(i.nome) + '</b><small>' + JP.brl(i.preco) + ' / ' + i.un + '</small></div>' +
        '<div style="text-align:right"><div class="qtd"><button data-d="-1" data-id="' + i.id + '" aria-label="Diminuir">−</button><span>' + i.qtd + '</span><button data-d="1" data-id="' + i.id + '" aria-label="Aumentar">+</button></div></div></div>';
    }).join('') + '</div>';

    h += '<div class="bloco"><h3>Como você quer receber</h3><div class="opcoes">' +
      '<button class="opcao' + (tipo === 'entrega' ? ' ativa' : '') + '" data-tipo="entrega">Entrega</button>' +
      '<button class="opcao' + (tipo === 'retirada' ? ' ativa' : '') + '" data-tipo="retirada">Retirada</button></div></div>';

    h += '<div class="bloco"><h3>Seus dados</h3>' +
      '<div class="campo"><label for="fNome">Nome</label><input id="fNome" autocomplete="name" value="' + esc(form.nome) + '" placeholder="Seu nome"></div>' +
      '<div class="campo"><label for="fFone">WhatsApp</label><input id="fFone" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(form.fone) + '" placeholder="(85) 9 0000-0000"></div>';
    if (tipo === 'entrega') {
      h += '<div class="campo"><label for="fBairro">Bairro</label><select id="fBairro"><option value="">Selecione o bairro</option>' +
        JP.BAIRROS.map(function (b) { return '<option' + (b.nome === form.bairro ? ' selected' : '') + '>' + esc(b.nome) + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label for="fEnd">Endereço</label><input id="fEnd" autocomplete="street-address" value="' + esc(form.endereco) + '" placeholder="Rua, número, complemento"></div>';
      if (c.f) h += '<p class="dica">Distância estimada de ' + c.f.km.toFixed(1).replace('.', ',') + ' km. Taxa do bairro ' + JP.brl(c.f.taxaBairro) + (c.f.extra ? ' + ' + JP.brl(c.f.extra) + ' pela distância.' : '. Sem acréscimo de distância.') + '</p>';
    } else {
      h += '<p class="dica">Retirada na base de distribuição, de segunda a sábado, das 6h às 14h. O endereço é combinado pelo WhatsApp.</p>';
    }
    h += '</div>';

    h += '<div class="bloco"><h3>Pagamento</h3><div class="opcoes tres">' + pgtos().map(function (p) {
      return '<button class="opcao' + (p === pagamento ? ' ativa' : '') + '" data-pg="' + p + '">' + p + '</button>';
    }).join('') + '</div>' +
      (pagamento === 'Dinheiro' ? '<div class="campo"><label for="fTroco">Troco para quanto?</label><input id="fTroco" inputmode="decimal" value="' + esc(form.troco) + '" placeholder="Ex.: 200"></div>' : '') +
      (pagamento === 'Pix' ? '<p class="dica">Você recebe a chave Pix no WhatsApp para pagar depois de confirmarmos o pedido.</p>' : '') + '</div>';

    h += '<div class="resumo"><div><span>Subtotal</span><span>' + JP.brl(c.sub) + '</span></div>' +
      '<div><span>Taxa de entrega</span><span>' + (tipo === 'retirada' ? 'Grátis' : (c.f ? JP.brl(c.taxa) : 'Escolha o bairro')) + '</span></div>' +
      '<div class="total"><span>Total</span><span>' + JP.brl(c.total) + '</span></div></div>' +
      '<div id="erroForm" class="erro-campo" role="alert"></div>' +
      '<button class="btn verde" id="finalizar">Finalizar pelo WhatsApp</button>' +
      '<p class="dica" style="text-align:center">Demonstração: o pedido é registrado aqui e a conversa abre pronta no WhatsApp da Júlia.</p>';
    el.innerHTML = h;
  }

  function abreGaveta() { desenhaCarrinho(); $('#gaveta').classList.add('aberta'); $('#gaveta').setAttribute('aria-hidden', 'false'); $('#veu').hidden = false; }
  function fechaGaveta() { $('#gaveta').classList.remove('aberta'); $('#gaveta').setAttribute('aria-hidden', 'true'); $('#veu').hidden = true; }

  /* ---------- finalização ---------- */
  function validar(c) {
    if (!form.nome.trim()) return 'Informe seu nome.';
    if (form.fone.replace(/\D/g, '').length < 10) return 'Informe um WhatsApp válido com DDD.';
    if (tipo === 'entrega') {
      if (!form.bairro) return 'Escolha o bairro da entrega.';
      if (!form.endereco.trim()) return 'Informe o endereço de entrega.';
    }
    return '';
  }
  function mensagem(p, c) {
    var l = ['Olá, Julia Pescados! Quero fazer um pedido (' + p.id + '):', ''];
    p.itens.forEach(function (i) { l.push('• ' + i.qtd + ' ' + i.un + ' de ' + i.nome + ' — ' + JP.brl(i.preco * i.qtd)); });
    l.push('', 'Subtotal: ' + JP.brl(c.sub));
    if (p.tipo === 'entrega') { l.push('Entrega em ' + p.bairro + ': ' + JP.brl(p.taxa)); l.push('Endereço: ' + p.endereco); }
    else l.push('Retirada no local');
    l.push('Total: ' + JP.brl(c.total), 'Pagamento: ' + p.pagamento + (p.pagamento === 'Dinheiro' && form.troco ? ' (troco para R$ ' + form.troco + ')' : ''), '', 'Nome: ' + p.cliente, 'WhatsApp: ' + p.fone);
    return l.join('\n');
  }
  function finalizar() {
    var c = calc(), erro = validar(c);
    if (erro) { $('#erroForm').textContent = erro; return; }
    S = JP.estado();
    var id = 'JP-' + (++S.seq);
    var p = {
      id: id, cliente: form.nome.trim(), fone: form.fone.trim(), bairro: tipo === 'entrega' ? form.bairro : '', endereco: tipo === 'entrega' ? form.endereco.trim() : '',
      tipo: tipo, pagamento: pagamento, itens: c.its.map(function (i) { return { id: i.id, nome: i.nome, un: i.un, preco: i.preco, qtd: i.qtd }; }),
      taxa: c.taxa, criado: JP.agora(), confirmado: false, baixa: false, motoboy: null, fixo: null, origemSite: true
    };
    S.pedidos.unshift(p);
    // cliente novo na carteira, ou soma ao existente
    var digs = p.fone.replace(/\D/g, ''), cli = S.clientes.filter(function (x) { return x.fone.replace(/\D/g, '') === digs; })[0];
    if (cli) { cli.pedidos += 1; cli.total += JP.totalPedido(p); cli.ultima = JP.agora(); }
    else S.clientes.unshift({ id: 'c' + (S.clientes.length + 1), nome: p.cliente, fone: p.fone, bairro: p.bairro || 'Retirada', pedidos: 1, total: JP.totalPedido(p), ultima: JP.agora() });
    // lead no CRM
    S.leads.unshift({ id: 'l' + JP.agora(), nome: p.cliente, fone: p.fone, origem: 'Site — pedido ' + id, etapa: 'orcamento', valor: JP.totalPedido(p), itens: p.itens.map(function (i) { return i.qtd + ' ' + i.un + ' ' + i.nome; }).join(', '), msgs: [['c', 'Pedido ' + id + ' feito pelo site.']], pedidoId: id });
    JP.salvar();

    var texto = mensagem(p, c);
    window.open('https://wa.me/' + JP.WHATS + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
    carrinho = {}; salvaCarrinho(); atualizaContador();
    pedidoAcomp = id; localStorage.setItem('jp_ultimo_pedido', id);
    fechaGaveta(); abreAcomp(true);
  }

  /* ---------- acompanhamento com mapa ---------- */
  var mapa = null, camadas = {}, timer = null;
  function pedidoAtual() { S = JP.estado(); return S.pedidos.filter(function (p) { return p.id === pedidoAcomp; })[0]; }

  function abreAcomp(novo) {
    $('#modalAcomp').hidden = false;
    desenhaAcomp(novo);
    clearInterval(timer); timer = setInterval(atualizaAcomp, 1000);
  }
  function fechaAcomp() { $('#modalAcomp').hidden = true; clearInterval(timer); if (mapa) { mapa.remove(); mapa = null; camadas = {}; } }

  function desenhaAcomp(novo) {
    var p = pedidoAtual(), el = $('#acompConteudo');
    if (!p) { el.innerHTML = '<div class="acomp"><p class="vazio">Você ainda não fez nenhum pedido neste aparelho.</p></div>'; return; }
    var retirada = p.tipo === 'retirada', nomes = retirada ? ['Pedido recebido', 'Confirmado', 'Preparando', 'Pronto'] : ['Pedido recebido', 'Preparando', 'Saiu para entrega', 'Chegou'];
    var pix = p.pagamento === 'Pix' ? '<div class="dica">Pagamento por Pix: a chave é enviada pelo WhatsApp quando a Júlia confirmar.</div>' : '';
    el.innerHTML = '<div class="acomp">' +
      (novo ? '<div class="ok-topo"><h3>Pedido ' + p.id + ' enviado</h3><p class="dica">Abrimos a conversa no WhatsApp com os itens. Acompanhe por aqui.</p></div>' : '<p class="dica">Pedido ' + p.id + ' — ' + esc(p.cliente) + '</p>') +
      '<div class="etapas" id="etapas">' + nomes.map(function (n) { return '<div class="etapa">' + n + '</div>'; }).join('') + '</div>' +
      '<div class="faixa-estado"><div><b id="estadoTxt"></b><div class="dica" id="estadoSub"></div></div><button class="btn pequeno claro" id="simConf" hidden>Simular confirmação da Júlia</button></div>' +
      (retirada ? '' : '<div id="mapaAcomp"></div>') + pix +
      '<div class="resumo">' + p.itens.map(function (i) { return '<div><span>' + i.qtd + ' ' + i.un + ' · ' + esc(i.nome) + '</span><span>' + JP.brl(i.preco * i.qtd) + '</span></div>'; }).join('') +
      '<div><span>' + (retirada ? 'Retirada' : 'Entrega — ' + esc(p.bairro)) + '</span><span>' + JP.brl(p.taxa) + '</span></div><div class="total"><span>Total · ' + esc(p.pagamento) + '</span><span>' + JP.brl(JP.totalPedido(p)) + '</span></div></div>' +
      '<p class="dica" style="text-align:center">Demonstração acelerada: o trajeto do motoboy é simulado numa rota de exemplo.</p></div>';
    if (!retirada) montaMapa(p);
    atualizaAcomp();
  }

  function montaMapa(p) {
    var b = JP.BAIRROS.filter(function (x) { return x.nome === p.bairro; })[0] || JP.BAIRROS[0];
    mapa = L.map('mapaAcomp', { zoomControl: true, scrollWheelZoom: false }).setView([JP.BASE.lat, JP.BASE.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    var pts = JP.rota(b);
    camadas.pts = pts;
    L.polyline(pts, { color: '#14224f', weight: 5, opacity: .85 }).addTo(mapa);
    L.marker([JP.BASE.lat, JP.BASE.lng], { icon: L.divIcon({ className: '', html: '<div class="base-pin">Julia Pescados</div>', iconSize: [0, 0], iconAnchor: [50, 12] }) }).addTo(mapa);
    L.marker([b.lat, b.lng], { icon: L.divIcon({ className: '', html: '<div class="destino-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 22] }) }).addTo(mapa);
    camadas.moto = L.marker(pts[0], { icon: L.divIcon({ className: '', html: '<div class="motoboy-pin">Moto</div>', iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(mapa);
    mapa.fitBounds(L.polyline(pts).getBounds(), { padding: [30, 30] });
    setTimeout(function () { mapa && mapa.invalidateSize(); }, 150);
  }

  function atualizaAcomp() {
    var p = pedidoAtual(); if (!p || $('#modalAcomp').hidden) return;
    var s = JP.situacao(p), retirada = p.tipo === 'retirada';
    var ordem = retirada ? { recebido: 0, preparando: 2, chegou: 3 } : { recebido: 0, preparando: 1, saiu: 2, chegou: 3 };
    var idx = p.confirmado ? (s.cod === 'recebido' ? (retirada ? 1 : 0) : ordem[s.cod]) : 0;
    var els = document.querySelectorAll('#etapas .etapa');
    els.forEach(function (e, i) { e.className = 'etapa' + (i < idx || (s.cod === 'chegou' && i === 3) ? ' feita' : '') + (i === idx && s.cod !== 'chegou' ? ' atual' : ''); });
    var txt = { recebido: p.confirmado ? 'Pedido confirmado' : 'Pedido recebido', preparando: 'Preparando seu pedido', saiu: 'Saiu para entrega', chegou: retirada ? 'Pronto para retirada' : 'Seu pedido chegou' };
    var sub = !p.confirmado ? 'Aguardando a Júlia confirmar no WhatsApp.' : s.cod === 'saiu' ? 'Motoboy a caminho — ' + Math.round(s.prog * 100) + '% do trajeto.' : s.cod === 'chegou' ? 'Bom apetite!' : 'Estamos separando e embalando.';
    $('#estadoTxt').textContent = txt[s.cod]; $('#estadoSub').textContent = sub;
    $('#simConf').hidden = !!p.confirmado;
    if (camadas.moto && camadas.pts) camadas.moto.setLatLng(JP.pontoNaRota(camadas.pts, s.prog));
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, a'); if (!t) return;
    if (t.dataset.c) { cat = t.dataset.c; desenhaCats(); desenhaGrade(); }
    else if (t.dataset.add) add(t.dataset.add, 1);
    else if (t.dataset.d) { add(t.dataset.id, +t.dataset.d); }
    else if (t.dataset.tipo) { tipo = t.dataset.tipo; desenhaCarrinho(); }
    else if (t.dataset.pg) { pagamento = t.dataset.pg; desenhaCarrinho(); }
    else if (t.id === 'abrirCarrinho') abreGaveta();
    else if (t.id === 'fecharCarrinho' ) fechaGaveta();
    else if (t.id === 'finalizar') finalizar();
    else if (t.id === 'abrirAcomp') { var ult = localStorage.getItem('jp_ultimo_pedido'); pedidoAcomp = ult; abreAcomp(false); }
    else if (t.id === 'fecharAcomp') fechaAcomp();
    else if (t.id === 'simConf') { JP.confirmarPedido(pedidoAcomp); S = JP.estado(); desenhaAcomp(false); }
  });
  $('#veu').addEventListener('click', fechaGaveta);
  $('#modalAcomp').addEventListener('click', function (e) { if (e.target.id === 'modalAcomp') fechaAcomp(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { fechaGaveta(); if (!$('#modalAcomp').hidden) fechaAcomp(); } });
  $('#busca').addEventListener('input', function (e) { termo = e.target.value.trim().toLowerCase(); desenhaGrade(); });
  $('#corpoCarrinho').addEventListener('input', function (e) {
    var m = { fNome: 'nome', fFone: 'fone', fEnd: 'endereco', fTroco: 'troco' }[e.target.id];
    if (m) { form[m] = e.target.value; salvaCarrinho(); }
  });
  $('#corpoCarrinho').addEventListener('change', function (e) {
    if (e.target.id === 'fBairro') { form.bairro = e.target.value; salvaCarrinho(); desenhaCarrinho(); }
  });
  // mantém o catálogo atualizado quando o painel dá baixa no estoque em outra aba
  window.addEventListener('storage', function (e) { if (e.key === 'jp_demo_v1') { S = JP.estado(); desenhaGrade(); } });

  desenhaCats(); desenhaGrade(); desenhaTaxas(); atualizaContador();
  // Atalho para a demonstração: /index.html?acompanhar abre o último pedido
  if (/acompanhar/.test(location.search) && pedidoAcomp) abreAcomp(false);
})();
