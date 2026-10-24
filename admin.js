/* Painel administrativo Julia Pescados — demonstração (dados de exemplo no navegador) */
(function () {
  var S = JP.estado();
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var tela = $('#tela');
  var modulo = 'visao', mapa = null, mapaCam = null, ticker = null;
  var filtroCli = 'todos', buscaCli = '', ordCli = 'total';
  var nfSel = null, parametro = '', abertos = {}, logoPdf = null;
  var CORES = { m1: '#9c2417', m2: '#0b4a5c', m3: '#e0861a' };

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function recarrega() { S = JP.estado(); }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 3800); }
  function pedido(id) { return S.pedidos.filter(function (p) { return p.id === id; })[0]; }
  function motoboy(id) { return S.motoboys.filter(function (m) { return m.id === id; })[0]; }
  function dias(ms) { return Math.floor((JP.agora() - ms) / 86400000); }
  function ha(ms) { var d = dias(ms); return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : 'há ' + d + ' dias'; }
  function chipSit(p) {
    var s = JP.situacao(p), cls = { recebido: p.confirmado ? 'cinza' : 'alerta', preparando: 'laranja', saiu: 'laranja', chegou: 'ok' }[s.cod];
    var r = !p.confirmado ? 'Aguardando confirmação' : (p.tipo === 'retirada' && s.cod === 'chegou') ? 'Pronto para retirada' : s.rotulo;
    return '<span class="chip ' + cls + '" data-sit="' + p.id + '">' + r + '</span>';
  }

  /* ---------- categoria automática da carteira ---------- */
  function categoria(c) {
    if (dias(c.ultima) > 45) return { cod: 'inativo', rot: 'Inativo', cls: 'cinza' };
    if (c.total >= 3000 || c.pedidos >= 15) return { cod: 'vip', rot: 'VIP', cls: 'rosa' };
    if (c.pedidos >= 3) return { cod: 'recorrente', rot: 'Recorrente', cls: 'ok' };
    return { cod: 'novo', rot: 'Novo', cls: 'laranja' };
  }

  /* ---------- selos do menu ---------- */
  function selos() {
    var pend = S.pedidos.filter(function (p) { return !p.confirmado; }).length;
    var baixo = S.produtos.filter(function (p) { return p.estoque <= p.min; }).length;
    $('#seloPedidos').textContent = pend || ''; $('#seloEstoque').textContent = baixo || '';
    var nl = window.CRM ? CRM.naoLidas() : 0; $('#seloConversas').textContent = nl || '';
    var av = window.PVA ? PVA.pendentesBaixas() : 0; $('#seloAvaliacoes').textContent = av || '';
    var es = window.EXP ? EXP.inscritosPendentes() : 0; $('#seloEspera').textContent = es || '';
  }

  /* ---------- Visão geral ---------- */
  function visao() {
    var hoje = S.pedidos.filter(function (p) { return dias(p.criado) < 1; });
    var fat = hoje.reduce(function (s, p) { return s + JP.totalPedido(p); }, 0);
    var abertos = S.pedidos.filter(function (p) { return p.confirmado && p.fixo !== 'entregue' && JP.situacao(p).cod !== 'chegou'; }).length;
    var pend = S.pedidos.filter(function (p) { return !p.confirmado; }).length;
    var baixo = S.produtos.filter(function (p) { return p.estoque <= p.min; });
    tela.innerHTML = '<div class="cab"><div><h1>Bom dia, Júlia</h1><p>Resumo da operação de hoje.</p></div></div>' +
      '<div class="kpis">' +
      kpi('Pedidos hoje', hoje.length, JP.brl(fat) + ' faturados') +
      kpi('Aguardando confirmação', pend, 'confirme para dar baixa no estoque', pend ? 'alerta' : '') +
      kpi('Entregas em andamento', abertos, S.motoboys.length + ' motoboys na equipe') +
      kpi('Estoque baixo', baixo.length, baixo.length ? 'repor em breve' : 'tudo em dia', baixo.length ? 'alerta' : '') + '</div>' +
      '<div class="duas"><div class="painel"><h2>Últimos pedidos <a class="btn pequeno claro" href="#pedidos">Ver todos</a></h2><div class="rolagem"><table><thead><tr><th>Pedido</th><th>Cliente</th><th class="num">Total</th><th>Situação</th></tr></thead><tbody>' +
      S.pedidos.slice(0, 6).map(function (p) { return '<tr><td><b>' + p.id + '</b></td><td>' + esc(p.cliente) + '</td><td class="num">' + JP.brl(JP.totalPedido(p)) + '</td><td>' + chipSit(p) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>' +
      '<div class="painel"><h2>Atenção</h2>' +
      (baixo.length ? baixo.map(function (p) { return '<div class="banner alerta"><b>' + esc(p.nome) + '</b> — restam ' + p.estoque + ' ' + p.un + ' (mínimo ' + p.min + ')</div>'; }).join('') : '<p class="vazio">Nenhum alerta de estoque.</p>') +
      (pend ? '<div class="banner info">' + pend + ' pedido(s) esperando confirmação. <a href="#pedidos">Abrir pedidos</a></div>' : '') + '</div></div>';
  }
  function kpi(t, v, s, cls) { return '<div class="kpi ' + (cls || '') + '"><span>' + t + '</span><b>' + v + '</b><small>' + s + '</small></div>'; }

  /* ---------- Pedidos e delivery ---------- */
  function pedidosTela() {
    tela.innerHTML = '<div class="cab"><div><h1>Pedidos e delivery</h1><p>Confirme pedidos, escolha o motoboy e acompanhe as rotas no mapa.</p></div></div>' +
      '<div class="mapa-linha"><div class="painel"><h2>Mapa dos motoboys <small>Fortaleza — rota simulada</small></h2><div id="mapaAdmin"></div></div>' +
      '<div class="painel"><h2>Rotas de entrega <small>equipe própria</small></h2><div class="rotas" id="rotas"></div></div></div>' +
      '<div class="painel" style="margin-top:18px"><h2>Pedidos <small>os feitos pela loja aparecem aqui na hora · clique em “Ver itens” para abrir o pedido</small><button class="btn pequeno claro" id="pdfDia" type="button">Baixar pedidos do dia (PDF)</button></h2><div class="rolagem"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Entrega</th><th class="num">Total</th><th>Situação</th><th>Motoboy</th><th>Ações</th></tr></thead><tbody id="corpoPedidos"></tbody></table></div></div>';
    desenhaPedidos(); montaMapaAdmin(); atualizaMapaAdmin();
  }
  function detalhePedido(p) {
    var ent = p.tipo === 'retirada';
    return '<div class="det-pedido"><div class="det-itens"><table><thead><tr><th>Produto</th><th class="num">Quantidade</th><th class="num">Preço unitário</th><th class="num">Total</th></tr></thead><tbody>' +
      p.itens.map(function (i) { return '<tr><td>' + esc(i.nome) + (i.obs ? '<small>Observação: ' + esc(i.obs) + '</small>' : '') + '</td><td class="num">' + String(i.qtd).replace('.', ',') + ' ' + esc(i.un || '') + '</td><td class="num">' + JP.brl(i.preco) + '</td><td class="num">' + JP.brl(i.preco * i.qtd) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="3">Subtotal</td><td class="num">' + JP.brl(JP.subtotal(p)) + '</td></tr><tr><td colspan="3">' + (ent ? 'Retirada' : 'Taxa de entrega' + (p.bairro ? ' (' + esc(p.bairro) + ')' : '')) + '</td><td class="num">' + JP.brl(p.taxa || 0) + '</td></tr><tr class="tot"><td colspan="3">Total do pedido</td><td class="num">' + JP.brl(JP.totalPedido(p)) + '</td></tr></tfoot></table></div>' +
      '<dl class="det-dados"><div><dt>Cliente</dt><dd>' + esc(p.cliente) + '</dd></div><div><dt>WhatsApp</dt><dd>' + esc(p.fone) + '</dd></div>' +
      '<div><dt>' + (ent ? 'Retirada' : 'Endereço de entrega') + '</dt><dd>' + (ent ? 'Retirada no local' : esc(p.endereco) + (p.bairro ? ' — ' + esc(p.bairro) : '')) + '</dd></div>' +
      '<div><dt>Forma de pagamento</dt><dd>' + esc(p.pagamento) + '</dd></div>' +
      '<div class="largo"><dt>Observações</dt><dd>' + (p.obs ? esc(p.obs) : '<i>Sem observações.</i>') + '</dd></div>' +
      '<div class="largo"><button class="btn pequeno" type="button" data-pdf="' + p.id + '">Baixar pedido em PDF</button></div></dl></div>';
  }
  function desenhaPedidos() {
    $('#corpoPedidos').innerHTML = S.pedidos.map(function (p) {
      var ent = p.tipo === 'retirada' ? 'Retirada' : esc(p.bairro);
      var sel = p.tipo === 'retirada' ? '<span class="chip cinza">—</span>' :
        '<select class="peq" data-moto="' + p.id + '" aria-label="Motoboy do pedido ' + p.id + '"' + (p.fixo === 'entregue' ? ' disabled' : '') + '><option value="">Atribuir</option>' +
        S.motoboys.map(function (m) { return '<option value="' + m.id + '"' + (p.motoboy === m.id ? ' selected' : '') + '>' + m.nome + '</option>'; }).join('') + '</select>';
      var acao = !p.confirmado ? '<button class="btn pequeno" data-conf="' + p.id + '">Confirmar</button>'
        : '<button class="btn pequeno claro" data-venda="' + p.id + '"' + (p.vendaConfirmada ? ' disabled' : '') + '>' + (p.vendaConfirmada ? 'Venda registrada' : 'Confirmar venda') + '</button>';
      return '<tr><td><b>' + p.id + '</b>' + (p.atacadoId ? ' <span class="chip rosa">Atacado</span>' : '') + (p.recompra ? ' <span class="chip ok">Recompra</span>' : '') + (p.agendado ? ' <span class="chip alerta">' + esc(p.agendado) + '</span>' : '') + '<small>' + JP.dataHora(p.criado) + '</small></td><td>' + esc(p.cliente) + '<small>' + esc(p.pagamento) + '</small></td><td>' + ent + '</td>' +
        '<td class="num">' + JP.brl(JP.totalPedido(p)) + '</td><td>' + chipSit(p) + '</td><td>' + sel + '</td><td><div class="acoes"><button class="btn pequeno claro" type="button" data-itens="' + p.id + '" aria-expanded="' + !!abertos[p.id] + '">' + (abertos[p.id] ? 'Ocultar itens' : 'Ver itens (' + p.itens.length + ')') + '</button>' + acao + '</div></td></tr>' +
        (abertos[p.id] ? '<tr class="linha-det"><td colspan="7">' + detalhePedido(p) + '</td></tr>' : '');
    }).join('');
  }
  function montaMapaAdmin() {
    if (mapa) { mapa.remove(); mapa = null; }
    mapa = L.map('mapaAdmin', { scrollWheelZoom: false }).setView([JP.BASE.lat, JP.BASE.lng], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    L.marker([JP.BASE.lat, JP.BASE.lng], { icon: L.divIcon({ className: '', html: '<div class="base-pin">Base</div>', iconSize: [0, 0], iconAnchor: [20, 12] }) }).addTo(mapa);
    mapaCam = L.layerGroup().addTo(mapa); mapa._motos = {}; mapa._rotas = '';
    setTimeout(function () { mapa && mapa.invalidateSize(); }, 150);
  }
  function ativasMapa() {
    return S.pedidos.filter(function (p) { return p.tipo === 'entrega' && p.confirmado && p.motoboy && p.fixo !== 'entregue' && JP.situacao(p).cod !== 'chegou'; });
  }
  function atualizaMapaAdmin() {
    if (!mapa) return;
    var at = ativasMapa(), assinatura = at.map(function (p) { return p.id + p.motoboy; }).join('|');
    if (assinatura !== mapa._rotas) { // redesenha rotas só quando algo mudou
      mapaCam.clearLayers(); mapa._motos = {}; mapa._rotas = assinatura;
      at.forEach(function (p) {
        var b = JP.BAIRROS.filter(function (x) { return x.nome === p.bairro; })[0]; if (!b) return;
        var pts = JP.rota(b), cor = CORES[p.motoboy] || '#0b4a5c';
        p._pts = pts;
        L.polyline(pts, { color: cor, weight: 4, opacity: .7, dashArray: '2 8' }).addTo(mapaCam);
        L.marker([b.lat, b.lng], { icon: L.divIcon({ className: '', html: '<div class="destino-pin" style="background:' + cor + '"></div>', iconSize: [22, 22], iconAnchor: [11, 22] }) }).addTo(mapaCam).bindTooltip(p.id + ' · ' + p.bairro);
        mapa._motos[p.id] = { pts: pts, m: L.marker(pts[0], { icon: L.divIcon({ className: '', html: '<div class="motoboy-pin" style="background:' + cor + '">' + esc((motoboy(p.motoboy) || {}).nome || '?').slice(0, 2) + '</div>', iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(mapaCam).bindTooltip((motoboy(p.motoboy) || {}).nome + ' → ' + p.id) };
      });
      if (at.length) { var all = []; at.forEach(function (p) { all = all.concat(mapa._motos[p.id] ? mapa._motos[p.id].pts : []); }); try { mapa.fitBounds(L.latLngBounds(all), { padding: [30, 30] }); } catch (e) {} }
    }
    at.forEach(function (p) { var o = mapa._motos[p.id]; if (o) o.m.setLatLng(JP.pontoNaRota(o.pts, JP.situacao(p).prog)); });
    var r = $('#rotas');
    if (r) r.innerHTML = S.motoboys.map(function (m) {
      var ps = at.filter(function (p) { return p.motoboy === m.id; });
      var info = ps.length ? ps.map(function (p) { var s = JP.situacao(p); return p.id + ' → ' + p.bairro + ' · ' + (s.cod === 'saiu' ? Math.round(s.prog * 100) + '% do trajeto' : 'separando'); }).join('<br>') : 'Livre, aguardando pedido';
      return '<div class="rota"><span class="ponto" style="background:' + CORES[m.id] + '"></span><div><b>' + m.nome + '</b> <small style="display:inline">' + esc(m.moto) + '</small><br><span style="color:var(--suave)">' + info + '</span></div><span class="chip ' + (ps.length ? 'laranja' : 'ok') + '">' + (ps.length ? 'Em rota' : 'Livre') + '</span></div>';
    }).join('');
  }

  /* ---------- Carteira de clientes ---------- */
  function clientes() {
    tela.innerHTML = '<div class="cab"><div><h1>Carteira de clientes</h1><p>Categorias automáticas por frequência, valor e tempo sem comprar.</p></div></div>' +
      '<div class="banner info"><div><b>Regras:</b> Inativo = sem comprar há mais de 45 dias · VIP = R$ 3.000 em compras ou 15 pedidos · Recorrente = 3 pedidos ou mais · Novo = menos de 3 pedidos.</div></div>' +
      '<div class="filtros" id="filtros"></div><div class="painel"><div class="rolagem"><table><thead><tr><th>Cliente</th><th>Bairro</th><th class="num">Pedidos</th><th class="num">Total comprado</th><th class="num">Ticket médio</th><th>Última compra</th><th>Categoria</th></tr></thead><tbody id="corpoCli"></tbody></table></div></div>';
    desenhaClientes();
  }
  function desenhaClientes() {
    var base = S.clientes.map(function (c) { return { c: c, k: categoria(c) }; });
    var cont = { todos: base.length }; base.forEach(function (x) { cont[x.k.cod] = (cont[x.k.cod] || 0) + 1; });
    var fs = [['todos', 'Todos'], ['novo', 'Novos'], ['recorrente', 'Recorrentes'], ['vip', 'VIP'], ['inativo', 'Inativos']];
    $('#filtros').innerHTML = fs.map(function (f) { return '<button class="filtro' + (filtroCli === f[0] ? ' ativo' : '') + '" data-fcli="' + f[0] + '">' + f[1] + '<b>' + (cont[f[0]] || 0) + '</b></button>'; }).join('') +
      '<input type="search" id="buscaCli" placeholder="Buscar cliente ou bairro" value="' + esc(buscaCli) + '" aria-label="Buscar cliente">';
    var lista = base.filter(function (x) { return (filtroCli === 'todos' || x.k.cod === filtroCli) && (!buscaCli || (x.c.nome + ' ' + x.c.bairro).toLowerCase().indexOf(buscaCli.toLowerCase()) >= 0); })
      .sort(function (a, b) { return b.c.total - a.c.total; });
    $('#corpoCli').innerHTML = lista.length ? lista.map(function (x) {
      var c = x.c; return '<tr><td><b>' + esc(c.nome) + '</b><small>' + esc(c.fone) + '</small></td><td>' + esc(c.bairro) + '</td><td class="num">' + c.pedidos + '</td><td class="num">' + JP.brl(c.total) + '</td><td class="num">' + JP.brl(c.total / c.pedidos) + '</td><td>' + ha(c.ultima) + '</td><td><span class="chip ' + x.k.cls + '">' + x.k.rot + '</span></td></tr>';
    }).join('') : '<tr><td colspan="7" class="vazio">Nenhum cliente neste filtro.</td></tr>';
    var b = $('#buscaCli'); if (b && document.activeElement !== b && buscaCli) { /* mantém foco natural */ }
  }

  /* ---------- Nota fiscal ---------- */
  function nf() {
    var elegiveis = S.pedidos.filter(function (p) { return p.confirmado; });
    if (!nfSel || !pedido(nfSel)) nfSel = elegiveis.length ? elegiveis[0].id : null;
    var p = nfSel ? pedido(nfSel) : null;
    tela.innerHTML = '<div class="cab"><div><h1>Nota fiscal</h1><p>Emissão de exemplo a partir de um pedido confirmado.</p></div></div>' +
      '<div class="banner alerta"><b>Demonstração.</b> Esta tela simula a emissão da NF-e. Nenhuma nota é transmitida à SEFAZ e os números gerados não têm valor fiscal.</div>' +
      '<div class="duas"><div class="painel"><h2>Nova nota</h2>' +
      (p ? '<div class="form-grade"><div class="campo largo"><label for="nfPedido">Pedido de origem</label><select id="nfPedido">' + elegiveis.map(function (o) { return '<option value="' + o.id + '"' + (o.id === nfSel ? ' selected' : '') + '>' + o.id + ' — ' + esc(o.cliente) + ' — ' + JP.brl(JP.totalPedido(o)) + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label for="nfDest">Destinatário</label><input id="nfDest" value="' + esc(p.cliente) + '"></div><div class="campo"><label for="nfDoc">CPF/CNPJ</label><input id="nfDoc" placeholder="000.000.000-00"></div>' +
        '<div class="campo"><label>Natureza da operação</label><input value="Venda de mercadoria" readonly></div><div class="campo"><label>CFOP</label><input value="5.102" readonly></div></div>' +
        '<div class="rolagem"><table><thead><tr><th>Produto</th><th>NCM</th><th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Total</th></tr></thead><tbody>' +
        p.itens.map(function (i) { var pr = S.produtos.filter(function (x) { return x.id === i.id; })[0] || {}; return '<tr><td>' + esc(i.nome) + '</td><td>' + (pr.ncm || '—') + '</td><td class="num">' + i.qtd + ' ' + i.un + '</td><td class="num">' + JP.brl(i.preco) + '</td><td class="num">' + JP.brl(i.preco * i.qtd) + '</td></tr>'; }).join('') +
        '</tbody></table></div><p style="text-align:right;font-weight:700;margin:12px 0">Total da nota: ' + JP.brl(JP.subtotal(p)) + ' <small style="font-weight:400;color:var(--suave)">(frete cobrado à parte: ' + JP.brl(p.taxa) + ')</small></p>' +
        '<button class="btn" id="emitirNf">Emitir NF-e (simulação)</button>' : '<p class="vazio">Confirme um pedido primeiro para emitir a nota.</p>') + '</div>' +
      '<div class="painel"><h2>Notas emitidas <small>' + S.notas.length + ' nesta demonstração</small></h2>' +
      (S.notas.length ? S.notas.map(function (n) {
        return '<div class="cartao-nf" style="margin-bottom:14px"><h3>NF-e nº ' + n.numero + ' · série 1</h3><div>' + esc(n.dest) + ' — ' + JP.brl(n.valor) + '</div><div class="chave">Chave de acesso: ' + n.chave + '</div><div style="color:var(--suave)">Protocolo ' + n.protocolo + ' · ' + JP.dataHora(n.quando) + ' · pedido ' + n.pedido + '</div><span class="chip alerta" style="margin-top:8px">Simulada — sem valor fiscal</span></div>';
      }).join('') : '<p class="vazio">Nenhuma nota emitida ainda.</p>') + '</div></div>';
  }
  function emitirNf() {
    var p = pedido(nfSel); if (!p) return;
    var chave = ''; for (var i = 0; i < 44; i++) chave += Math.floor(Math.random() * 10);
    chave = chave.replace(/(.{4})/g, '$1 ').trim();
    S.notas.unshift({ numero: 1200 + S.notas.length + 1, chave: chave, protocolo: '1' + Math.floor(Math.random() * 1e14), dest: $('#nfDest').value || p.cliente, valor: JP.subtotal(p), pedido: p.id, quando: JP.agora() });
    JP.salvar(); toast('NF-e simulada emitida para ' + p.id + '. Sem valor fiscal.'); nf();
  }

  /* ---------- Estoque ---------- */
  function estoque() {
    var baixos = S.produtos.filter(function (p) { return p.estoque <= p.min; });
    tela.innerHTML = '<div class="cab"><div><h1>Estoque</h1><p>A baixa é automática quando o pedido é confirmado.</p></div></div>' +
      (baixos.length ? '<div class="banner alerta"><b>Alerta de estoque baixo:</b> ' + baixos.map(function (p) { return esc(p.nome) + ' (' + p.estoque + ' ' + p.un + ')'; }).join(' · ') + '</div>' : '') +
      '<div class="duas"><div class="painel"><h2>Produtos</h2><div class="rolagem"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Nível</th><th class="num">Saldo</th><th class="num">Mínimo</th><th>Situação</th><th>Entrada</th></tr></thead><tbody>' +
      S.produtos.map(function (p) {
        var cr = p.estoque <= 0 ? 'critico' : p.estoque <= p.min ? 'baixo' : '', pct = Math.min(100, p.estoque / (p.min * 4) * 100);
        var st = p.estoque <= 0 ? '<span class="chip perigo">Esgotado</span>' : p.estoque <= p.min ? '<span class="chip alerta">Baixo</span>' : '<span class="chip ok">Normal</span>';
        return '<tr><td><b>' + esc(p.nome) + '</b></td><td>' + esc(p.cat) + '</td><td><div class="barra ' + cr + '"><i style="width:' + pct + '%"></i></div></td><td class="num"><b>' + p.estoque + '</b> ' + p.un + '</td><td class="num">' + p.min + '</td><td>' + st + '</td>' +
          '<td><div class="acoes"><input class="peq" style="width:64px" type="number" min="1" step="1" placeholder="Qtd" id="ent-' + p.id + '" aria-label="Quantidade de entrada de ' + esc(p.nome) + '"><button class="btn pequeno claro" data-entrada="' + p.id + '">Repor</button></div></td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="painel"><h2>Baixas automáticas <small>geradas pelos pedidos confirmados</small></h2>' +
      (S.baixas.length ? '<div class="rolagem"><table><thead><tr><th>Quando</th><th>Pedido</th><th>Produto</th><th class="num">Saiu</th><th class="num">Saldo</th></tr></thead><tbody>' + S.baixas.slice(0, 14).map(function (b) { return '<tr><td>' + JP.dataHora(b.quando) + '</td><td>' + b.pedido + '</td><td>' + esc(b.produto) + '</td><td class="num">−' + b.qtd + '</td><td class="num">' + b.saldo + '</td></tr>'; }).join('') + '</tbody></table></div>'
        : '<p class="vazio">Nenhuma baixa ainda.<br>Confirme um pedido em “Pedidos e delivery” e veja o saldo cair aqui.</p>') + '</div></div>';
  }

  /* ---------- roteamento ---------- */
  var MODULOS = { visao: visao, pedidos: pedidosTela, conversas: crmTela, funil: crmTela, campanhas: crmTela, receitas: posVendaTela, avaliacoes: posVendaTela, entregas: extrasTela, recompra: extrasTela, espera: extrasTela, atacado: extrasTela, clientes: clientes, nf: nf, estoque: estoque, loja: lojaTela };
  function lojaTela() { LJA.render(tela); }
  function crmTela() { CRM.render(modulo, parametro, tela); }
  function posVendaTela() { PVA.render(modulo, tela); }
  function extrasTela() { EXP.render(modulo, tela); }
  function ir() {
    var h = (location.hash || '#visao').slice(1).split('/'), param = h[1] || '';
    h = h[0]; if (h === 'crm') h = 'funil'; if (h === 'ia') h = 'conversas'; if (!MODULOS[h]) h = 'visao';
    modulo = h; parametro = param; recarrega();
    if (mapa && h !== 'pedidos') { mapa.remove(); mapa = null; }
    document.querySelectorAll('#menu a').forEach(function (a) { a.classList.toggle('ativo', a.dataset.m === h); });
    MODULOS[h](); selos(); window.scrollTo(0, 0);
  }

  /* ---------- PDF ---------- */
  function carregaLogo() {
    if (logoPdf) return Promise.resolve(logoPdf);
    return new Promise(function (ok) {
      var im = new Image(); im.onload = function () { var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); logoPdf = c.toDataURL('image/png'); ok(logoPdf); };
      im.onerror = function () { ok(null); }; im.src = 'img/marca/logo-julia-192.png';
    });
  }
  function sitTexto(p) { var s = JP.situacao(p); return p.tipo === 'retirada' && s.cod === 'chegou' ? 'Pronto para retirada' : s.rotulo; }
  function baixaPdf(qual, id) {
    if (!window.jspdf) { toast('O gerador de PDF não carregou. Verifique a conexão e tente de novo.'); return; }
    recarrega();
    carregaLogo().then(function (logo) {
      var doc, nome;
      if (qual === 'pedido') { var p = pedido(id); if (!p) return; doc = JPPDF.pedido(window.jspdf, p, logo, sitTexto); nome = 'pedido-' + p.id + '-julia-pescados.pdf'; }
      else {
        var hoje = S.pedidos.filter(function (p) { return dias(p.criado) < 1; }), d = new Date(JP.agora());
        if (!hoje.length) { toast('Não há pedidos de hoje para exportar.'); return; }
        var txt = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        doc = JPPDF.lista(window.jspdf, hoje, logo, txt, sitTexto); nome = 'pedidos-do-dia-' + d.toISOString().slice(0, 10) + '-julia-pescados.pdf';
      }
      doc.save(nome); toast('PDF gerado: ' + nome);
    });
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.dataset.itens) { abertos[t.dataset.itens] = !abertos[t.dataset.itens]; desenhaPedidos(); }
    else if (t.dataset.pdf) baixaPdf('pedido', t.dataset.pdf);
    else if (t.id === 'pdfDia') baixaPdf('dia');
    else if (t.dataset.conf) { JP.confirmarPedido(t.dataset.conf); recarrega(); toast('Pedido ' + t.dataset.conf + ' confirmado. Estoque baixado e motoboy atribuído.'); desenhaPedidos(); atualizaMapaAdmin(); selos(); }
    else if (t.dataset.venda) {
      var p = pedido(t.dataset.venda); p.vendaConfirmada = true; JP.salvar();
      recarrega(); toast('Venda de ' + JP.brl(JP.totalPedido(p)) + ' confirmada.'); desenhaPedidos();
    }
    else if (t.dataset.fcli) { filtroCli = t.dataset.fcli; desenhaClientes(); }
    else if (t.dataset.entrada) {
      var inp = $('#ent-' + t.dataset.entrada), q = parseFloat(inp.value);
      if (!(q > 0)) { toast('Informe a quantidade que entrou.'); return; }
      var pr = S.produtos.filter(function (x) { return x.id === t.dataset.entrada; })[0]; pr.estoque = +(pr.estoque + q).toFixed(1); JP.salvar(); toast('Entrada de ' + q + ' ' + pr.un + ' em ' + pr.nome + '.'); estoque(); selos();
    }
    else if (t.id === 'emitirNf') emitirNf();
  });
  document.addEventListener('change', function (e) {
    if (e.target.dataset.moto !== undefined) {
      var p = pedido(e.target.dataset.moto); p.motoboy = e.target.value || null; JP.salvar(); toast(p.motoboy ? 'Motoboy ' + motoboy(p.motoboy).nome + ' atribuído ao ' + p.id + '.' : 'Motoboy removido do ' + p.id + '.'); atualizaMapaAdmin();
    } else if (e.target.id === 'nfPedido') { nfSel = e.target.value; nf(); }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'buscaCli') { buscaCli = e.target.value; var pos = e.target.selectionStart; desenhaClientes(); var b = $('#buscaCli'); b.focus(); b.setSelectionRange(pos, pos); } });

  // pedidos feitos na loja (outra aba) chegam aqui sozinhos
  window.addEventListener('storage', function (e) {
    if (e.key !== 'jp_demo_v1') return;
    recarrega(); selos();
    if (modulo === 'pedidos') { desenhaPedidos(); atualizaMapaAdmin(); } else if (modulo === 'visao') visao();
    else if (modulo === 'estoque') estoque();
    else if (modulo === 'clientes') desenhaClientes();
  });

  // relógio: move os motoboys e atualiza as situações sem recriar a tela
  ticker = setInterval(function () {
    if (modulo === 'pedidos') {
      recarrega();
      document.querySelectorAll('[data-sit]').forEach(function (el) { var p = pedido(el.dataset.sit); if (p) el.outerHTML = chipSit(p); });
      atualizaMapaAdmin();
    }
  }, 1000);

  CRM.init({
    estado: function () { return S; }, salvarEstado: function () { JP.salvar(); }, esc: esc, toast: toast, brl: JP.brl, dataHora: JP.dataHora, ha: ha,
    totalPedido: JP.totalPedido, categoria: categoria, selos: selos, modulo: function () { return modulo; }
  });
  PVA.init({ estado: function () { return S; }, esc: esc, toast: toast, ha: ha, dataHora: JP.dataHora, selos: selos, modulo: function () { return modulo; } });
  EXP.init({ estado: function () { return S; }, recarrega: recarrega, esc: esc, toast: toast, ha: ha, brl: JP.brl, dataHora: JP.dataHora, selos: selos, modulo: function () { return modulo; } });
  LJA.init({ estado: function () { return S; }, esc: esc, toast: toast });
  window.addEventListener('hashchange', ir);
  ir();
})();
