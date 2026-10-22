/* Loja Julia Pescados — lado do cliente */
(function () {
  var S = JP.estado();
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var carrinho = {};            // id -> quantidade
  var cat = 'Todos', termo = '';
  var tipo = 'entrega', pagamento = 'Pix';
  var form = { nome: '', fone: '', bairro: '', endereco: '', troco: '', obs: '' };
  var pedidoAcomp = localStorage.getItem('jp_ultimo_pedido') || null;

  var atacadoId = localStorage.getItem('jp_atacado') || '';   // restaurante identificado (atacado)
  var repetindo = null;                                        // { clienteId, ref, data } quando o cliente chega pelo aviso de recompra
  var naFila = [];                                             // produtos em que este aparelho já pediu aviso de lote fresco
  try { naFila = JSON.parse(localStorage.getItem('jp_espera') || '[]'); } catch (e) { naFila = []; }
  try { carrinho = JSON.parse(localStorage.getItem('jp_carrinho') || '{}'); } catch (e) { carrinho = {}; }
  try { form = Object.assign(form, JSON.parse(localStorage.getItem('jp_form') || '{}')); } catch (e) {}

  function prod(id) { return S.produtos.filter(function (p) { return p.id === id; })[0]; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function atac() { return atacadoId ? EX.restaurante(atacadoId) : null; }
  function precoDe(p) { return atac() ? EX.precoAtacado(p) : p.preco; }
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
      var sem = p.estoque <= 0, a = atac(), kit = p.inclui && p.inclui.length;
      var econ = kit ? JP.precoSeparado(p, S.produtos) - p.preco : 0;
      var fila = naFila.indexOf(p.id) >= 0;
      return '<article class="card' + (sem ? ' esgotado' : '') + '" id="prod-' + p.id + '">' +
        '<div class="card-foto" style="background-image:url(img/' + p.img + ')">' + (p.dest ? '<span class="chip">Mais pedido</span>' : '') + (econ > 0.5 ? '<span class="chip verde">Economize ' + JP.brl(econ) + '</span>' : '') + '</div>' +
        '<div class="card-corpo"><h3>' + esc(p.nome) + '</h3><p>' + esc(p.desc) + '</p>' +
        (kit ? '<ul class="kit-inclui" aria-label="O que vem no kit">' + p.inclui.map(function (c) { var q = S.produtos.filter(function (x) { return x.id === c[0]; })[0]; return q ? '<li>' + (c[1] < 1 ? c[1] * 1000 + ' g' : c[1] + ' kg') + ' de ' + esc(q.nome.charAt(0).toLowerCase() + q.nome.slice(1)) + '</li>' : ''; }).join('') + '</ul>' : '') +
        '<div class="card-rodape"><span class="preco">' + (a ? '<s class="preco-velho">' + JP.brl(p.preco) + '</s> ' : '') + JP.brl(precoDe(p)) + ' <small>/ ' + p.un + (a ? ' · atacado' : '') + '</small></span>' +
        '<button class="btn pequeno" data-add="' + p.id + '"' + (sem ? ' disabled' : '') + '>' + (sem ? 'Esgotado' : 'Adicionar') + '</button></div>' +
        (p.fresco ? '<button type="button" class="espera-btn' + (fila ? ' na-fila' : '') + '" data-espera="' + p.id + '">' + (fila ? '✓ Você está na fila do próximo lote' : (sem || p.estoque <= p.min ? 'Avise-me quando chegar lote fresco' : 'Avisar quando chegar lote novo')) + '</button>' : '') +
        '</div></article>';
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
      var p = prod(id); return { id: id, nome: p.nome, un: p.un, preco: precoDe(p), qtd: carrinho[id], img: p.img };
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
    var h = (repetindo ? '<div class="aviso-repetir"><b>Seu pedido de ' + repetindo.data + ' já está aqui.</b> Confira os itens e o endereço e finalize: é só isso.</div>' : '') +
      (atac() ? '<div class="aviso-repetir atacado"><b>Atacado — ' + esc(atac().nome) + '.</b> Preço fixo da tabela de restaurantes.</div>' : '') + '<div class="bloco">' + c.its.map(function (i) {
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
      (pagamento === 'Pix' ? '<p class="dica">Você recebe a chave Pix no WhatsApp para pagar depois de confirmarmos o pedido.</p>' : '') + '</div>' +
      '<div class="bloco"><h3>Observações</h3><div class="campo"><label for="fObs">Algum pedido especial? (opcional)</label><textarea id="fObs" rows="2" maxlength="200" placeholder="Ex.: camarão sem casca, ligar ao chegar">' + esc(form.obs) + '</textarea></div></div>';

    h += avisoCorteHtml();
    h += '<div class="resumo"><div><span>Subtotal</span><span>' + JP.brl(c.sub) + '</span></div>' +
      '<div><span>Taxa de entrega</span><span>' + (tipo === 'retirada' ? 'Grátis' : (c.f ? JP.brl(c.taxa) : 'Escolha o bairro')) + '</span></div>' +
      '<div class="total"><span>Total</span><span>' + JP.brl(c.total) + '</span></div></div>' +
      '<div id="erroForm" class="erro-campo" role="alert"></div>' +
      '<button class="btn verde" id="finalizar">Finalizar pelo WhatsApp</button>' +
      '<p class="dica" style="text-align:center">Demonstração: o pedido é registrado aqui e a conversa abre pronta no WhatsApp da Júlia.</p>';
    el.innerHTML = h;
  }

  // Aviso do horário de corte: depois dele a loja aceita o pedido, mas a entrega é no próximo dia útil.
  function avisoCorteHtml() {
    var corte = EX.horaCorte();
    if (EX.aposCorte()) {
      var d = EX.proxDia().texto;
      return '<div class="aviso-corte" role="alert"><b>Atenção: entrega ' + (tipo === 'retirada' ? 'só ' : '') + d + '.</b> Pedidos feitos depois das ' + corte + ' não saem no mesmo dia. Você pode fazer o pedido agora e ' + (tipo === 'retirada' ? 'retirar' : 'receber') + ' ' + d + '.</div>';
    }
    return '<p class="dica corte-ok">Pedidos até as ' + corte + ' são ' + (tipo === 'retirada' ? 'separados' : 'entregues') + ' hoje. Depois disso, ficam para o próximo dia útil.</p>';
  }
  function faixaCorte() {
    var f = $('#faixaCorte'); if (!f) return;
    if (EX.aposCorte()) { f.hidden = false; f.innerHTML = '<b>Já passamos das ' + EX.horaCorte() + '.</b> Você pode pedir agora: a entrega será ' + EX.proxDia().texto + '.'; } else f.hidden = true;
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
    if (p.agendado) l.push('', '⏰ Pedido feito depois das ' + EX.horaCorte() + ': ' + (p.tipo === 'retirada' ? 'retirada ' : 'entrega ') + p.agendado + '.');
    if (p.atacadoId) l.push('', 'Pedido de atacado (restaurante), preço fixo da tabela.');
    if (p.obs) l.push('', 'Observações: ' + p.obs);
    l.push('Total: ' + JP.brl(c.total), 'Pagamento: ' + p.pagamento + (p.pagamento === 'Dinheiro' && form.troco ? ' (troco para R$ ' + form.troco + ')' : ''), '', 'Nome: ' + p.cliente, 'WhatsApp: ' + p.fone);
    return l.join('\n');
  }
  function registra(p) {
    S = JP.estado();
    var id = 'JP-' + (++S.seq); p.id = id;
    if (EX.aposCorte()) p.agendado = EX.proxDia().texto;   // depois do corte: aceita, mas avisa que é no dia seguinte
    S.pedidos.unshift(p);
    // cliente novo na carteira, ou soma ao existente
    var digs = p.fone.replace(/\D/g, ''), cli = S.clientes.filter(function (x) { return x.fone.replace(/\D/g, '') === digs; })[0];
    if (cli) { cli.pedidos += 1; cli.total += JP.totalPedido(p); cli.ultima = JP.agora(); cli.itens = p.itens.map(function (i) { return [i.id, i.qtd]; }); }
    else S.clientes.unshift({ id: 'c' + (S.clientes.length + 1), nome: p.cliente, fone: p.fone, bairro: p.bairro || 'Retirada', pedidos: 1, total: JP.totalPedido(p), ultima: JP.agora(), itens: p.itens.map(function (i) { return [i.id, i.qtd]; }) });
    // lead no CRM
    S.leads.unshift({ id: 'l' + JP.agora(), nome: p.cliente, fone: p.fone, origem: 'Site — pedido ' + id, etapa: 'orcamento', valor: JP.totalPedido(p), itens: p.itens.map(function (i) { return i.qtd + ' ' + i.un + ' ' + i.nome; }).join(', '), msgs: [['c', 'Pedido ' + id + ' feito pelo site.']], pedidoId: id });
    JP.salvar();
    if (p.recompra && repetindo) EX.marcarRepetiu(repetindo.clienteId, id);
    return id;
  }
  function finalizar() {
    var c = calc(), erro = validar(c);
    if (erro) { $('#erroForm').textContent = erro; return; }
    var p = {
      cliente: form.nome.trim(), fone: form.fone.trim(), bairro: tipo === 'entrega' ? form.bairro : '', endereco: tipo === 'entrega' ? form.endereco.trim() : '',
      tipo: tipo, pagamento: pagamento, itens: c.its.map(function (i) { return { id: i.id, nome: i.nome, un: i.un, preco: i.preco, qtd: i.qtd }; }),
      taxa: c.taxa, criado: JP.agora(), confirmado: false, baixa: false, motoboy: null, fixo: null, origemSite: true, obs: form.obs.trim()
    };
    if (atac()) p.atacadoId = atac().id;
    if (repetindo) p.recompra = true;
    var id = registra(p);
    window.open('https://wa.me/' + JP.WHATS + '?text=' + encodeURIComponent(mensagem(p, c)), '_blank', 'noopener');
    repetindo = null;
    carrinho = {}; form.obs = ''; salvaCarrinho(); atualizaContador();
    pedidoAcomp = id; localStorage.setItem('jp_ultimo_pedido', id);
    fechaGaveta(); abreAcomp(true);
  }
  // Atacado: o pedido recorrente do restaurante sai em um toque, com os dados já cadastrados.
  function pedirRecorrente() {
    var r = atac(); if (!r || !r.itens.length) return;
    S = JP.estado();
    var its = [], falta = '';
    r.itens.forEach(function (i) { var p = prod(i.id); if (!p) return; if (i.qtd > p.estoque) falta = p.nome; its.push({ id: p.id, nome: p.nome, un: p.un, preco: EX.precoAtacado(p), qtd: i.qtd }); });
    var er = $('#atErro');
    if (falta) { er.textContent = 'Estoque insuficiente de ' + falta + ' para o pedido recorrente. Ajuste as quantidades no carrinho.'; return; }
    var f = JP.frete(r.bairro), sub = its.reduce(function (t, i) { return t + i.preco * i.qtd; }, 0), taxa = f ? f.total : 0;
    var p = { cliente: r.nome, fone: r.fone, bairro: r.bairro, endereco: r.endereco, tipo: 'entrega', pagamento: 'Pix', itens: its, taxa: taxa, criado: JP.agora(), confirmado: false, baixa: false, motoboy: null, fixo: null, origemSite: true, atacadoId: r.id, semWhats: true };
    var id = registra(p);
    pedidoAcomp = id; localStorage.setItem('jp_ultimo_pedido', id);
    abreAcomp(true);
  }
  function carregaRecorrenteNoCarrinho() {
    var r = atac(); if (!r) return;
    carrinho = {}; r.itens.forEach(function (i) { var p = prod(i.id); if (p) carrinho[i.id] = Math.min(i.qtd, p.estoque); });
    Object.assign(form, { nome: r.nome, fone: r.fone, bairro: r.bairro, endereco: r.endereco }); salvaCarrinho(); atualizaContador(); abreGaveta();
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
      (novo ? '<div class="ok-topo"><h3>Pedido ' + p.id + ' enviado</h3><p class="dica">' + (p.semWhats ? 'O pedido recorrente já chegou à Júlia. Acompanhe por aqui.' : 'Abrimos a conversa no WhatsApp com os itens. Acompanhe por aqui.') + '</p></div>' : '<p class="dica">Pedido ' + p.id + ' — ' + esc(p.cliente) + '</p>') +
      (p.agendado ? '<div class="aviso-corte" role="alert"><b>' + (retirada ? 'Retirada ' : 'Entrega ') + p.agendado + '.</b> Seu pedido foi feito depois das ' + EX.horaCorte() + ', o nosso horário de corte, e não sai hoje. Avisaremos pelo WhatsApp quando a ' + (retirada ? 'retirada estiver pronta' : 'entrega sair') + '.</div>' : '') +
      '<div class="etapas" id="etapas">' + nomes.map(function (n) { return '<div class="etapa">' + n + '</div>'; }).join('') + '</div>' +
      '<div class="faixa-estado"><div><b id="estadoTxt"></b><div class="dica" id="estadoSub"></div></div><button class="btn pequeno claro" id="simConf" hidden>Simular confirmação da Júlia</button></div>' +
      (retirada ? '' : '<div id="mapaAcomp"></div>') + pix +
      '<div class="resumo">' + p.itens.map(function (i) { return '<div><span>' + i.qtd + ' ' + i.un + ' · ' + esc(i.nome) + '</span><span>' + JP.brl(i.preco * i.qtd) + '</span></div>'; }).join('') +
      '<div><span>' + (retirada ? 'Retirada' : 'Entrega — ' + esc(p.bairro)) + '</span><span>' + JP.brl(p.taxa) + '</span></div><div class="total"><span>Total · ' + esc(p.pagamento) + '</span><span>' + JP.brl(JP.totalPedido(p)) + '</span></div></div>' +
      '<div id="avalAcomp"></div><div id="repetirAcomp"></div>' +
      '<p class="dica" style="text-align:center">Demonstração acelerada: o trajeto do motoboy é simulado numa rota de exemplo.</p></div>';
    avalChave = ''; avalNota = 0;
    if (!retirada) montaMapa(p);
    atualizaAcomp();
  }

  function montaMapa(p) {
    var b = JP.BAIRROS.filter(function (x) { return x.nome === p.bairro; })[0] || JP.BAIRROS[0];
    mapa = L.map('mapaAcomp', { zoomControl: true, scrollWheelZoom: false }).setView([JP.BASE.lat, JP.BASE.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    var pts = JP.rota(b);
    camadas.pts = pts;
    L.polyline(pts, { color: '#0b4a5c', weight: 5, opacity: .85 }).addTo(mapa);
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
    var txt = { recebido: p.agendado && p.confirmado ? 'Entrega agendada' : p.confirmado ? 'Pedido confirmado' : 'Pedido recebido', preparando: 'Preparando seu pedido', saiu: 'Saiu para entrega', chegou: retirada ? 'Pronto para retirada' : 'Seu pedido chegou' };
    var sub = p.agendado && p.confirmado && !p.saiuEm ? (retirada ? 'Retirada ' : 'Entrega ') + p.agendado + '. Seu pedido está confirmado.' : !p.confirmado ? 'Aguardando a Júlia confirmar no WhatsApp.' : s.cod === 'saiu' ? 'Motoboy a caminho — ' + Math.round(s.prog * 100) + '% do trajeto.' : s.cod === 'chegou' ? 'Bom apetite!' : 'Estamos separando e embalando.';
    $('#estadoTxt').textContent = txt[s.cod]; $('#estadoSub').textContent = sub;
    $('#simConf').hidden = !!p.confirmado;
    if (camadas.moto && camadas.pts) camadas.moto.setLatLng(JP.pontoNaRota(camadas.pts, s.prog));
    if (!retirada && p.confirmado && s.cod === 'chegou') desenhaAval(p);
    if (p.confirmado && s.cod === 'chegou' && $('#repetirAcomp') && !$('#repetirAcomp').innerHTML) $('#repetirAcomp').innerHTML = '<button class="btn mar" id="pedirDeNovo">Pedir de novo</button>';
  }

  /* ---------- avaliação depois da entrega (pós-venda) ---------- */
  var avalChave = '', avalNota = 0;
  var ROT_NOTA = ['', 'Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente'];
  function desenhaAval(p) {
    var el = $('#avalAcomp'); if (!el) return;
    PV.recarregar();
    var pv = PV.ler(), feita = PV.doPedido(p.id), chave = p.id + (feita ? '|feita|' + feita.nota : pv.aval.ativa ? '|form' : '|off');
    if (chave === avalChave) return;
    avalChave = chave;
    if (!feita && !pv.aval.ativa) { el.innerHTML = ''; return; }
    if (feita) {
      el.innerHTML = '<div class="aval feita"><h3>Obrigada pela sua avaliação!</h3><p class="aval-est" role="img" aria-label="Nota ' + feita.nota + ' de 5">' + new Array(feita.nota + 1).join('★') + '<i>' + new Array(6 - feita.nota).join('☆') + '</i></p>' +
        (feita.nota <= 3 ? '<p class="dica">Sentimos muito. A Júlia vai falar com você pelo WhatsApp para resolver.</p>' : '<p class="dica">Gostou? Indique a Julia Pescados para amigos e família: é só passar o nosso perfil <b>@juliapescados</b>.</p>') + '</div>';
      return;
    }
    el.innerHTML = '<div class="aval"><h3>Como foi o seu pedido?</h3><p class="dica">Dê uma nota de 1 a 5 e, se quiser, conte em uma frase como foi.</p>' +
      '<div class="aval-notas" role="radiogroup" aria-label="Nota de 1 a 5">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" role="radio" aria-checked="false" class="aval-estrela" data-estrela="' + n + '" aria-label="' + n + ' de 5 — ' + ROT_NOTA[n] + '">★</button>'; }).join('') + '</div>' +
      '<p class="aval-rot" id="avalRot" aria-live="polite">&nbsp;</p>' +
      '<label class="sr" for="avalTxt">Comentário sobre o pedido</label><textarea id="avalTxt" rows="3" maxlength="300" placeholder="Seu comentário (opcional)"></textarea>' +
      '<label class="aval-ind"><input type="checkbox" id="avalInd"> Vou indicar a Julia Pescados para amigos e família</label>' +
      '<button class="btn" id="enviarAval" disabled>Enviar avaliação</button></div>';
    avalNota = 0;
  }
  function marcaNota(n) {
    avalNota = n;
    document.querySelectorAll('.aval-estrela').forEach(function (b) { var on = +b.dataset.estrela <= n; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(+b.dataset.estrela === n)); });
    $('#avalRot').textContent = n + ' de 5 — ' + ROT_NOTA[n]; $('#enviarAval').disabled = false;
  }
  function enviaAval() {
    var p = pedidoAtual(); if (!p || !avalNota) return;
    PV.avaliar({ pedido: p.id, cliente: p.cliente, fone: p.fone, nota: avalNota, comentario: $('#avalTxt').value, indicou: $('#avalInd').checked, origem: 'Loja' });
    avalChave = ''; desenhaAval(p);
  }

  /* ---------- lista de espera de lote fresco e acesso ao atacado ---------- */
  var exModo = '', exProd = '';
  function abreEx(titulo, html) { $('#exTitulo').textContent = titulo; $('#exConteudo').innerHTML = html; $('#modalEx').hidden = false; var i = $('#exConteudo input'); if (i) i.focus(); }
  function fechaEx() { $('#modalEx').hidden = true; }
  function abreEspera(id) {
    var p = prod(id); if (!p) return; exModo = 'espera'; exProd = id;
    if (naFila.indexOf(id) >= 0) { abreEx('Você já está na fila', '<div class="ex-corpo"><p>Assim que chegar lote fresco de <b>' + esc(p.nome) + '</b>, avisamos no seu WhatsApp.</p><button class="btn" data-fecha-ex>Fechar</button></div>'); return; }
    abreEx('Avise-me do próximo lote', '<div class="ex-corpo"><p>Quando chegar lote fresco de <b>' + esc(p.nome) + '</b>, mandamos um aviso no seu WhatsApp, com o link para pedir.</p>' +
      '<div class="campo"><label for="exNome">Nome</label><input id="exNome" autocomplete="name" value="' + esc(form.nome) + '"></div>' +
      '<div class="campo"><label for="exFone">WhatsApp</label><input id="exFone" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(form.fone) + '" placeholder="(85) 9 0000-0000"></div>' +
      '<div id="exErro" class="erro-campo" role="alert"></div><button class="btn" id="enviarEspera">Quero ser avisado</button>' +
      '<p class="dica">Demonstração: o aviso aparece na tela “Lote fresco” e nas Conversas do painel.</p></div>');
  }
  function enviaEspera() {
    var nome = $('#exNome').value.trim(), fone = $('#exFone').value.trim();
    if (!nome) { $('#exErro').textContent = 'Informe seu nome.'; return; }
    if (fone.replace(/\D/g, '').length < 10) { $('#exErro').textContent = 'Informe um WhatsApp válido com DDD.'; return; }
    form.nome = form.nome || nome; form.fone = form.fone || fone; salvaCarrinho();
    EX.recarregar(); EX.inscrever({ prod: exProd, nome: nome, fone: fone });
    if (naFila.indexOf(exProd) < 0) naFila.push(exProd); localStorage.setItem('jp_espera', JSON.stringify(naFila));
    var p = prod(exProd);
    $('#exTitulo').textContent = 'Você está na fila';
    $('#exConteudo').innerHTML = '<div class="ex-corpo"><div class="ok-topo"><h3>Pronto, ' + esc(nome.split(' ')[0]) + '!</h3><p>Avisaremos no seu WhatsApp assim que chegar lote fresco de <b>' + esc(p.nome) + '</b>.</p></div><button class="btn" data-fecha-ex>Fechar</button></div>';
    desenhaGrade();
  }
  function abreAtacadoModal() {
    exModo = 'atacado';
    abreEx('Sou restaurante', '<div class="ex-corpo"><p>Digite o código do seu restaurante para ver a tabela de preços de atacado e pedir de novo em um toque.</p>' +
      '<div class="campo"><label for="atCodigo">Código do restaurante</label><input id="atCodigo" autocomplete="off" placeholder="Ex.: MARE" maxlength="12"></div><div id="exErro" class="erro-campo" role="alert"></div>' +
      '<button class="btn" id="entrarAtacado">Entrar</button><p class="dica">Códigos da demonstração: ' + EX.ler().atacado.restaurantes.map(function (r) { return '<b>' + esc(r.codigo) + '</b>'; }).join(', ') + '.</p></div>');
  }
  function entraAtacado(cod) {
    var c = String(cod || '').trim().toUpperCase();
    var r = EX.ler().atacado.restaurantes.filter(function (x) { return x.codigo.toUpperCase() === c; })[0];
    if (!r) { var er = $('#exErro'); if (er) er.textContent = 'Código não encontrado.'; return; }
    atacadoId = r.id; localStorage.setItem('jp_atacado', r.id);
    Object.assign(form, { nome: r.nome, fone: r.fone, bairro: r.bairro, endereco: r.endereco }); salvaCarrinho();
    fechaEx(); desenhaTudo();
  }
  function desenhaAtacado() {
    var el = $('#atacadoPainel'), r = atac();
    $('#abrirAtacado').textContent = r ? 'Atacado: ' + r.nome.replace(/^(Restaurante|Bar|Cantina) /, '') : 'Sou restaurante';
    if (!r) { el.hidden = true; el.innerHTML = ''; return; }
    var its = r.itens.map(function (i) { var p = prod(i.id); return p ? { p: p, qtd: i.qtd } : null; }).filter(Boolean);
    var tot = its.reduce(function (t, x) { return t + EX.precoAtacado(x.p) * x.qtd; }, 0), varejo = its.reduce(function (t, x) { return t + x.p.preco * x.qtd; }, 0);
    el.hidden = false;
    el.innerHTML = '<div class="atacado-cab"><div><span class="chip rosa">Atacado</span><h2>' + esc(r.nome) + '</h2><p>Preço fixo da tabela de restaurantes, em todos os produtos da loja.</p></div><button type="button" class="link-btn" id="sairAtacado">Sair do atacado</button></div>' +
      (its.length ? '<div class="atacado-rec"><div><h3>Seu pedido recorrente' + (r.dias ? ' <small>' + esc(r.dias) + '</small>' : '') + '</h3><ul>' + its.map(function (x) { return '<li><span>' + x.qtd + ' ' + x.p.un + ' · ' + esc(x.p.nome) + '</span><b>' + JP.brl(EX.precoAtacado(x.p) * x.qtd) + '</b></li>'; }).join('') + '</ul>' +
        '<p class="atacado-tot">Total dos produtos <b>' + JP.brl(tot) + '</b> <small>(varejo: ' + JP.brl(varejo) + ')</small></p><p class="dica">Entrega em ' + esc(r.bairro) + ', ' + esc(r.endereco) + '. Taxa de entrega do bairro à parte.</p></div>' +
        '<div class="atacado-acoes"><button class="btn verde grande" id="pedirRecorrente">Pedir de novo em 1 toque</button><button class="btn linha" id="editarRecorrente">Ajustar no carrinho</button><div id="atErro" class="erro-campo" role="alert"></div></div></div>'
        : '<p class="dica">Ainda não há pedido recorrente cadastrado. Monte o pedido no carrinho; a Júlia salva como recorrente.</p>');
  }
  function desenhaTudo() { desenhaGrade(); desenhaAtacado(); atualizaContador(); if ($('#gaveta').classList.contains('aberta')) desenhaCarrinho(); }

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
    else if (t.dataset.estrela) marcaNota(+t.dataset.estrela);
    else if (t.id === 'enviarAval') enviaAval();
    else if (t.dataset.espera) abreEspera(t.dataset.espera);
    else if (t.id === 'enviarEspera') enviaEspera();
    else if (t.id === 'fecharEx' || t.hasAttribute('data-fecha-ex')) fechaEx();
    else if (t.id === 'abrirAtacado') abreAtacadoModal();
    else if (t.id === 'entrarAtacado') entraAtacado($('#atCodigo').value);
    else if (t.id === 'sairAtacado') { atacadoId = ''; localStorage.removeItem('jp_atacado'); desenhaTudo(); }
    else if (t.id === 'pedirRecorrente') pedirRecorrente();
    else if (t.id === 'editarRecorrente') carregaRecorrenteNoCarrinho();
    else if (t.id === 'pedirDeNovo') { var ul = pedidoAtual(); if (ul) { carrinho = {}; ul.itens.forEach(function (i) { if (prod(i.id)) carrinho[i.id] = Math.min(i.qtd, prod(i.id).estoque); }); salvaCarrinho(); atualizaContador(); fechaAcomp(); abreGaveta(); } }
    else if (t.id === 'simConf') { JP.confirmarPedido(pedidoAcomp); S = JP.estado(); desenhaAcomp(false); }
  });
  $('#veu').addEventListener('click', fechaGaveta);
  $('#modalEx').addEventListener('click', function (e) { if (e.target.id === 'modalEx') fechaEx(); });
  $('#modalAcomp').addEventListener('click', function (e) { if (e.target.id === 'modalAcomp') fechaAcomp(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { fechaGaveta(); fechaEx(); if (!$('#modalAcomp').hidden) fechaAcomp(); } });
  $('#busca').addEventListener('input', function (e) { termo = e.target.value.trim().toLowerCase(); desenhaGrade(); });
  $('#corpoCarrinho').addEventListener('input', function (e) {
    var m = { fNome: 'nome', fFone: 'fone', fEnd: 'endereco', fTroco: 'troco', fObs: 'obs' }[e.target.id];
    if (m) { form[m] = e.target.value; salvaCarrinho(); }
  });
  $('#corpoCarrinho').addEventListener('change', function (e) {
    if (e.target.id === 'fBairro') { form.bairro = e.target.value; salvaCarrinho(); desenhaCarrinho(); }
  });
  // mantém o catálogo atualizado quando o painel dá baixa no estoque em outra aba
  window.addEventListener('storage', function (e) { if (e.key === 'jp_demo_v1') { S = JP.estado(); desenhaGrade(); } });

  window.addEventListener('storage', function (e) { if (e.key === EX.CHAVE) { EX.recarregar(); desenhaAtacado(); faixaCorte(); } });
  desenhaCats(); desenhaGrade(); desenhaTaxas(); atualizaContador(); desenhaAtacado(); faixaCorte();
  setInterval(function () { faixaCorte(); }, 30000);

  // Links dos avisos: ?repetir=<cliente> (recompra), ?add=<produto> (lote fresco, receitas) e ?atacado=<código>
  (function () {
    var q = new URLSearchParams(location.search), mudou = false;
    if (q.get('atacado')) { var r = EX.ler().atacado.restaurantes.filter(function (x) { return x.codigo.toUpperCase() === q.get('atacado').toUpperCase(); })[0]; if (r) { atacadoId = r.id; localStorage.setItem('jp_atacado', r.id); Object.assign(form, { nome: r.nome, fone: r.fone, bairro: r.bairro, endereco: r.endereco }); salvaCarrinho(); desenhaTudo(); mudou = true; } }
    if (q.get('repetir')) {
      var c = S.clientes.filter(function (x) { return x.id === q.get('repetir'); })[0];
      if (c && c.itens && c.itens.length) {
        carrinho = {}; c.itens.forEach(function (i) { var p = prod(i[0]); if (p && p.estoque > 0) carrinho[i[0]] = Math.min(i[1], p.estoque); });
        Object.assign(form, { nome: c.nome, fone: c.fone, bairro: c.bairro === 'Retirada' ? '' : c.bairro, endereco: c.endereco || form.endereco });
        tipo = form.bairro ? 'entrega' : tipo; repetindo = { clienteId: c.id, ref: q.get('ref') || 'recompra', data: new Date(c.ultima).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) };
        salvaCarrinho(); atualizaContador(); abreGaveta(); mudou = true;
      }
    } else if (q.get('add')) {
      var p0 = prod(q.get('add'));
      if (p0 && p0.estoque > 0) { add(p0.id, 1); abreGaveta(); }
      var alvo = $('#prod-' + q.get('add')); if (alvo) setTimeout(function () { alvo.scrollIntoView({ block: 'center' }); alvo.classList.add('destaque'); }, 300);
      mudou = true;
    }
    if (mudou && history.replaceState) history.replaceState(null, '', location.pathname);
  })();
  // Atalho para a demonstração: /index.html?acompanhar abre o último pedido
  if (/acompanhar/.test(location.search) && pedidoAcomp) abreAcomp(false);
})();
